import { functionsEnv } from './config';
import { isSupportedWebhookType } from './billingCatalog';
import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';
import { sendEmail } from './sendEmail';
import { paymentSuccessEmail, paymentFailedEmail } from './emailTemplates';
import { inspectDowngradeSchedule, ownsAppliedScheduleReceipt, verifyPartialScheduleOwnership, scheduledDowngradeState, stripeId } from './billingSchedules';
import { applyStorageWrites, deriveStorageAuthority, familyStorageWrites } from './storageAuthority';

if (!admin.apps.length) admin.initializeApp();
function getDb() { return admin.firestore(); }
let stripe: Stripe | null = null;
const failureStages = new WeakMap<object, string>();
async function atStage<T>(operation: string, action: () => Promise<T>): Promise<T> {
  try { return await action(); } catch (error) {
    if (error && typeof error === 'object' && !failureStages.has(error)) failureStages.set(error, operation);
    throw error; // Preserve the original exception; never stringify its stack/body.
  }
}

export function safeWebhookFailure(event: Stripe.Event, error: unknown, operation: string) {
  const value = error && typeof error === 'object' ? error as { name?: unknown; code?: unknown; message?: unknown } : {};
  const safeId = (id: unknown) => typeof id === 'string' && /^(evt|sub|sub_sched|in|cs|cus)_[A-Za-z0-9]+$/.test(id) ? id : null;
  const object = event.data.object as any;
  const messages = ['Subscription authority changed.', 'Stripe account ownership mismatch.', 'Family workspace ownership mismatch.',
    'AI Pack payment ownership mismatch.', 'AI Pack invoice lines incomplete.', 'Local billing clock ownership mismatch.', 'Local billing clock evidence invalid.',
    'Billing state transaction unavailable.', 'AI Pack grant transaction unavailable.'];
  const errorCode = typeof value.code === 'number' && Number.isInteger(value.code) && value.code >= 0 && value.code <= 16 ? value.code :
    typeof value.code === 'string' && ['aborted', 'ABORTED', 'deadline-exceeded', 'DEADLINE_EXCEEDED', 'unavailable', 'UNAVAILABLE', 'permission-denied', 'resource-exhausted', 'ETIMEDOUT', 'ECONNRESET', 'lock_timeout', 'idempotency_error'].includes(value.code) ? value.code : 'processing_error';
  return { eventId: safeId(event.id), eventType: isSupportedWebhookType(event.type) ? event.type : 'unsupported',
    objectId: safeId(object?.id), subscriptionId: safeId(event.type.startsWith('customer.subscription.') ? object?.id : stripeId(object?.subscription || object?.released_subscription) || (event.type.startsWith('invoice.') ? invoiceSubscriptionId(object) : null)),
    errorName: typeof value.name === 'string' && ['Error', 'TypeError', 'RangeError', 'FirebaseError', 'StripeError', 'StripeInvalidRequestError', 'StripeAPIError', 'StripeConnectionError', 'StripeIdempotencyError'].includes(value.name) ? value.name : 'Error',
    errorCode, errorMessage: messages.includes(String(value.message)) ? String(value.message) : 'Underlying error details redacted; inspect the failing stage with synthetic diagnostics.',
    operation: error && typeof error === 'object' ? failureStages.get(error) || operation : operation };
}
function getStripe(): Stripe {
  if (!stripe) stripe = new Stripe(functionsEnv.stripeSecretKey);
  return stripe;
}

export function normalizeStripeStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case 'active': return 'active';
    case 'trialing': return 'trialing';
    case 'past_due': return 'past_due';
    case 'unpaid': return 'unpaid';
    case 'canceled': return 'canceled';
    case 'incomplete_expired': return 'incomplete_expired';
    case 'incomplete': return 'incomplete';
    case 'paused': return 'paused';
    default: return 'none';
  }
}

export function shouldApplyBillingEvent(latestProcessed: number, incomingCreated: number): boolean {
  return incomingCreated >= latestProcessed;
}

export function mapSubscriptionToPlan(sub: Stripe.Subscription) {
  let plan: 'free' | 'pro' | 'family' = 'free';
  let interval: 'month' | 'year' | null = null;
  let priceId: string | null = null;
  let aiPackItemExists = false;
  const subscriptionMetadata = (sub.metadata || {}) as Record<string, string>;
  if (subscriptionMetadata.kr_plan === 'pro' || subscriptionMetadata.kr_plan === 'family') plan = subscriptionMetadata.kr_plan;
  if (subscriptionMetadata.kr_interval === 'month' || subscriptionMetadata.kr_interval === 'year') interval = subscriptionMetadata.kr_interval;
  for (const item of sub.items.data) {
    const price = item.price;
    const md = (price.metadata || {}) as Record<string, string>;
    if (md.kr_plan === 'pro' || md.kr_plan === 'family') {
      plan = md.kr_plan;
      interval = (price.recurring?.interval as 'month' | 'year') || interval;
      priceId = price.id;
    }
    if (md.kr_addon === 'ai_pack' || price.id === functionsEnv.prices.ai_pack_monthly) aiPackItemExists = true;
  }
  if (!aiPackItemExists) {
    aiPackItemExists = sub.pending_update?.subscription_items?.some(({ price }) =>
      price.metadata?.kr_addon === 'ai_pack' || price.id === functionsEnv.prices.ai_pack_monthly) === true;
  }
  return { plan, interval, priceId, aiPackItemExists };
}

async function claimEvent(event: Stripe.Event): Promise<'claimed' | 'processed' | 'busy'> {
  const ref = getDb().collection('billing_events').doc(event.id);
  const ledger = { eventId: event.id, eventType: event.type, stripeCreated: event.created * 1000, receivedAt: Date.now(), processingLeaseUntil: Date.now() + 120_000, status: 'processing' };
  const database = getDb() as any;
  if (typeof database.runTransaction === 'function') {
    return database.runTransaction(async (tx: any) => {
      const existing = await tx.get(ref);
      if (existing.exists) {
        if (existing.data()?.status === 'failed' || (existing.data()?.status === 'processing' && Number(existing.data()?.processingLeaseUntil || 0) < Date.now())) {
          tx.update(ref, ledger);
          return 'claimed';
        }
        return existing.data()?.status === 'processing' ? 'busy' : 'processed';
      }
      tx.create(ref, ledger);
      return 'claimed';
    });
  }
  const existing = await ref.get();
  if (existing.exists) {
    const data = existing.data?.() || {};
    if (data.status !== 'failed' && !(data.status === 'processing' && Number(data.processingLeaseUntil || 0) < Date.now())) return data.status === 'processing' ? 'busy' : 'processed';
    await ref.set(ledger, { merge: true });
    return 'claimed';
  }
  await ref.set(ledger);
  return 'claimed';
}

async function completeEvent(event: Stripe.Event, fields: Record<string, unknown> = {}) {
  await getDb().collection('billing_events').doc(event.id).update({ ...fields, status: 'processed', processedAt: Date.now() });
}

type LegacySubscriptionPeriod = Stripe.Subscription & { current_period_end?: number };

export interface CanonicalScheduledCancellation {
  cancelAtPeriodEnd: boolean;
  scheduledCancellationAt: number | null;
}

type AIPackStatus = 'none' | 'pending' | 'active';

export async function subscriptionEvaluationTime(api: Stripe, customer: Stripe.Customer, subscription: Stripe.Subscription, uid: string): Promise<number> {
  if (!['development', 'test'].includes(process.env.NODE_ENV || '') || process.env.FUNCTIONS_EMULATOR !== 'true' ||
      process.env.GCLOUD_PROJECT !== 'demo-konnectedroots-phase2' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' ||
      !functionsEnv.stripeSecretKey.startsWith('sk_test_') || !customer.test_clock) return Date.now();
  if (customer.livemode !== false || subscription.livemode !== false || customer.metadata.kr_uid !== uid ||
      !['phase2_family_downgrade', 'phase2_pastdue_test_clock'].includes(customer.metadata.kr_test_scenario)) throw new Error('Local billing clock ownership mismatch.');
  const clockId = stripeId(customer.test_clock);
  const clock = await api.testHelpers.testClocks.retrieve(clockId);
  if (clock.id !== clockId || clock.livemode !== false || !Number.isSafeInteger(clock.frozen_time) || clock.frozen_time <= 0) throw new Error('Local billing clock evidence invalid.');
  return clock.frozen_time * 1000;
}

function stripeSecondsToMilliseconds(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value * 1000 : 0;
}

function resolvePlanItem(subscription: Stripe.Subscription): Stripe.SubscriptionItem | undefined {
  return subscription.items.data.find(({ price }) => {
    const plan = price.metadata?.kr_plan;
    return plan === 'pro' || plan === 'family';
  });
}

export function resolvePlanCurrentPeriodEnd(subscription: Stripe.Subscription): number {
  const planItem = resolvePlanItem(subscription);
  const planItemPeriodEnd = stripeSecondsToMilliseconds(planItem?.current_period_end);
  if (planItemPeriodEnd > 0) return planItemPeriodEnd;

  // Stripe API versions before 2025-03-31 exposed this at subscription level.
  return stripeSecondsToMilliseconds((subscription as LegacySubscriptionPeriod).current_period_end);
}

export function resolveAIPackCurrentPeriodEnd(subscription: Stripe.Subscription): number {
  const aiPackItem = subscription.items.data.find(({ price }) =>
    price.metadata?.kr_addon === 'ai_pack' || price.id === functionsEnv.prices.ai_pack_monthly);
  return stripeSecondsToMilliseconds(aiPackItem?.current_period_end);
}

export function reconcileSubscriptionAIPackState(
  previous: Record<string, any>,
  incoming: Record<string, any>,
  now = Date.now(),
): Record<string, unknown> {
  const itemExists = incoming.aiPackItemExists === true;
  const baseSubscriptionEligible =
    (incoming.plan === 'pro' || incoming.plan === 'family') &&
    (incoming.status === 'active' || incoming.status === 'trialing');
  const previousPaidThrough = Number(previous.aiPackPaidThrough || 0);
  const removalOperationPending = Boolean(previous.aiPackRemovalOperationId);
  const resumeOperationPending = Boolean(previous.aiPackResumeOperationId);
  const resumeConfirmed = itemExists && resumeOperationPending;
  const removalWasRequested = removalOperationPending || previous.aiPackCancelAtPeriodEnd === true;
  const terminalBaseState = incoming.status === 'canceled' || incoming.status === 'incomplete_expired' || incoming.plan === 'free';
  const preservePaidEntitlement = !terminalBaseState &&
    (itemExists || removalWasRequested || resumeOperationPending) &&
    previous.aiPackStatus === 'active' &&
    previous.addons?.aiPack === true &&
    previousPaidThrough > now;
  const scheduledRemoval = preservePaidEntitlement && !resumeConfirmed && (
    previous.aiPackCancelAtPeriodEnd === true || (!itemExists && removalOperationPending)
  );
  const aiPackStatus: AIPackStatus = preservePaidEntitlement
    ? 'active'
    : !baseSubscriptionEligible ? 'none' : itemExists ? 'pending' : 'none';

  return {
    ...incoming,
    aiPackItemExists: itemExists,
    aiPackStatus,
    // Retain historical payment evidence after expiry; the active flag is
    // independently time-gated. Never manufacture a renewal period here.
    aiPackPaidThrough: !terminalBaseState && previousPaidThrough > 0 ? previousPaidThrough : null,
    aiPackOperationId: aiPackStatus === 'pending' ? previous.aiPackOperationId || null : null,
    aiPackRequestedAt: aiPackStatus === 'pending' ? Number(previous.aiPackRequestedAt || 0) || null : null,
    aiPackCancelAtPeriodEnd: scheduledRemoval,
    aiPackScheduledRemovalAt: scheduledRemoval ? previousPaidThrough : null,
    aiPackRemovalOperationId: preservePaidEntitlement && itemExists && !resumeConfirmed
      ? previous.aiPackRemovalOperationId || null
      : null,
    aiPackRemovalRequestedAt: preservePaidEntitlement && itemExists && !resumeConfirmed
      ? Number(previous.aiPackRemovalRequestedAt || 0) || null
      : null,
    aiPackResumeOperationId: preservePaidEntitlement && !itemExists && resumeOperationPending
      ? previous.aiPackResumeOperationId
      : null,
    aiPackResumeRequestedAt: preservePaidEntitlement && !itemExists && resumeOperationPending
      ? Number(previous.aiPackResumeRequestedAt || 0) || null
      : null,
    addons: { ...(incoming.addons || {}), aiPack: aiPackStatus === 'active' },
  };
}

/**
 * The Family plan copy is derived state. When it identifies the same Family
 * subscription as the billing owner, project the owner's already-paid AI Pack
 * state instead of interpreting a surviving Stripe item as a new purchase. A
 * present but mismatched owner snapshot clears the add-on projection so a stale
 * Family copy cannot overgrant credits.
 */
export function deriveFamilyAIPackState(
  familyPlan: Record<string, any>,
  ownerBilling: Record<string, any> | null | undefined,
): Record<string, any> {
  if (!ownerBilling) return familyPlan;
  if (ownerBilling.plan !== 'family' ||
      typeof familyPlan.stripeSubscriptionId !== 'string' ||
      !familyPlan.stripeSubscriptionId ||
      typeof familyPlan.stripeCustomerId !== 'string' ||
      !familyPlan.stripeCustomerId ||
      ownerBilling.stripeSubscriptionId !== familyPlan.stripeSubscriptionId ||
      ownerBilling.stripeCustomerId !== familyPlan.stripeCustomerId) {
    return {
      ...familyPlan,
      aiPackItemExists: false,
      aiPackStatus: 'none',
      aiPackPaidThrough: null,
      aiPackOperationId: null,
      aiPackRequestedAt: null,
      aiPackCancelAtPeriodEnd: false,
      aiPackScheduledRemovalAt: null,
      aiPackRemovalOperationId: null,
      aiPackRemovalRequestedAt: null,
      aiPackResumeOperationId: null,
      aiPackResumeRequestedAt: null,
      addons: { ...(familyPlan.addons || {}), aiPack: false },
    };
  }

  return {
    ...familyPlan,
    aiPackItemExists: ownerBilling.aiPackItemExists === true,
    aiPackStatus: ownerBilling.aiPackStatus || 'none',
    aiPackPaidThrough: Number(ownerBilling.aiPackPaidThrough || 0) || null,
    aiPackOperationId: ownerBilling.aiPackOperationId || null,
    aiPackRequestedAt: Number(ownerBilling.aiPackRequestedAt || 0) || null,
    aiPackCancelAtPeriodEnd: ownerBilling.aiPackCancelAtPeriodEnd === true,
    aiPackScheduledRemovalAt: Number(ownerBilling.aiPackScheduledRemovalAt || 0) || null,
    aiPackRemovalOperationId: ownerBilling.aiPackRemovalOperationId || null,
    aiPackRemovalRequestedAt: Number(ownerBilling.aiPackRemovalRequestedAt || 0) || null,
    aiPackResumeOperationId: ownerBilling.aiPackResumeOperationId || null,
    aiPackResumeRequestedAt: Number(ownerBilling.aiPackResumeRequestedAt || 0) || null,
    addons: { ...(familyPlan.addons || {}), aiPack: ownerBilling.addons?.aiPack === true },
  };
}

export function resolveScheduledCancellation(
  subscription: Stripe.Subscription,
  now = Date.now(),
): CanonicalScheduledCancellation {
  const planPeriodEnd = resolvePlanCurrentPeriodEnd(subscription);
  const explicitCancelAt = stripeSecondsToMilliseconds(subscription.cancel_at ?? undefined);
  const futureCancelAt = explicitCancelAt > now ? explicitCancelAt : null;
  const explicitFlag = subscription.cancel_at_period_end === true;
  const cancelAtPlanPeriodEnd = futureCancelAt !== null &&
    planPeriodEnd > 0 &&
    futureCancelAt === planPeriodEnd;

  return {
    cancelAtPeriodEnd: explicitFlag || cancelAtPlanPeriodEnd,
    scheduledCancellationAt: explicitFlag && planPeriodEnd > now
      ? planPeriodEnd
      : futureCancelAt,
  };
}

export function subscriptionBillingState(eventType: Stripe.Event['type'], subscription: Stripe.Subscription) {
  const mapped = mapSubscriptionToPlan(subscription);
  const deleted = eventType === 'customer.subscription.deleted';
  const currentPeriodEnd = deleted ? 0 : resolvePlanCurrentPeriodEnd(subscription);
  const cancellation = deleted
    ? { cancelAtPeriodEnd: false, scheduledCancellationAt: null }
    : resolveScheduledCancellation(subscription);
  if (!deleted && mapped.plan !== 'free' && currentPeriodEnd === 0) {
    logger.warn('Stripe paid-plan item has no usable current period end', {
      operation: 'resolve_subscription_plan_period',
      subscriptionId: subscription.id,
      plan: mapped.plan,
    });
  }
  return {
    status: deleted ? 'canceled' : normalizeStripeStatus(subscription.status),
    currentPeriodEnd,
    ...cancellation,
    interval: deleted ? null : mapped.interval,
    priceId: deleted ? null : mapped.priceId,
    aiPackItemExists: deleted ? false : mapped.aiPackItemExists,
    aiPackStatus: deleted ? 'none' as const : mapped.aiPackItemExists ? 'pending' as const : 'none' as const,
    aiPackPaidThrough: null,
    aiPackOperationId: null,
    aiPackRequestedAt: null,
    aiPackCancelAtPeriodEnd: false,
    aiPackScheduledRemovalAt: null,
    aiPackRemovalOperationId: null,
    aiPackRemovalRequestedAt: null,
    aiPackResumeOperationId: null,
    aiPackResumeRequestedAt: null,
    addons: { aiPack: false },
    plan: deleted ? 'free' as const : mapped.plan,
  };
}

export async function updateBillingIfNewer(
  uid: string,
  eventCreated: number,
  billing: Record<string, unknown>,
  eventType?: Stripe.Event['type'],
  now = Date.now(),
) {
  const ref = getDb().collection('users').doc(uid);
  const database = getDb() as any;
  if (typeof database.runTransaction !== 'function') throw new Error('Billing state transaction unavailable.');
  return database.runTransaction(async (transaction: any) => {
    const snap = await transaction.get(ref);
    const previous = snap.data()?.billing || {};
    if (!shouldApplyBillingEvent(Number(previous.latestStripeEventCreated || 0), eventCreated)) return false;
    const next = reconcileSubscriptionAIPackState(previous, billing, now);
    const planChangeApplied = previous.planChangeTarget === 'family' &&
      next.plan === 'family' && (next.status === 'active' || next.status === 'trialing');
    const planChangeExpired = eventType === 'customer.subscription.pending_update_expired';
    const planChangeState = planChangeApplied ? {
      planChangeStatus: 'none',
      planChangeTarget: null,
      planChangeInterval: null,
      planChangeFamilyId: null,
      planChangeOperationId: null,
      planChangeRequestedAt: null,
      planChangeFailure: null,
    } : planChangeExpired && previous.planChangeStatus === 'pending' ? {
      planChangeStatus: 'failed',
      planChangeOperationId: null,
      planChangeFailure: 'payment_expired',
    } : {};
    const user = { ...snap.data(), billing: { ...previous, ...next, ...planChangeState, latestStripeEventCreated: eventCreated, updatedAt: Date.now() } };
    const familyId = user.family?.familyId || previous.planChangeFamilyId;
    const family = typeof familyId === 'string' && familyId
      ? (await transaction.get(database.collection('families').doc(familyId))).data() || {} : {};
    const storageWrites = family.ownerUid === uid
      ? await familyStorageWrites(transaction, database, familyId, family, user, now) : [];
    transaction.set(ref, { billing: user.billing }, { merge: true });
    applyStorageWrites(transaction, storageWrites);
    return true;
  });
}

export async function updateFamilyIfNewer(
  familyId: string,
  eventCreated: number,
  plan: Record<string, unknown>,
  ownerUid?: string,
  now = Date.now(),
) {
  const ref = getDb().collection('families').doc(familyId);
  const database = getDb() as any;
  if (typeof database.runTransaction !== 'function') throw new Error('Billing state transaction unavailable.');
  return database.runTransaction(async (transaction: any) => {
    const snap = await transaction.get(ref);
    const familyData = snap.data() || {};
    const previous = familyData.plan || {};
    if (!shouldApplyBillingEvent(Number(previous.latestStripeEventCreated || 0), eventCreated)) return false;
    const resolvedOwnerUid = ownerUid || (typeof familyData.ownerUid === 'string' ? familyData.ownerUid : '');
    const ownerSnap = resolvedOwnerUid
      ? await transaction.get(getDb().collection('users').doc(resolvedOwnerUid))
      : null;
    const next = reconcileSubscriptionAIPackState(previous, plan, now);
    const derived = deriveFamilyAIPackState(
      { ...previous, ...next },
      ownerSnap?.exists ? ownerSnap.data()?.billing : null,
    );
    const projectedFamily = { ...familyData, plan: { ...derived, latestStripeEventCreated: eventCreated, updatedAt: Date.now() } };
    const storageOwner = familyData.ownerUid === resolvedOwnerUid ? ownerSnap?.data() || {} : {};
    const storageWrites = await familyStorageWrites(transaction, database, familyId, projectedFamily, storageOwner, now);
    transaction.set(ref, { plan: projectedFamily.plan }, { merge: true });
    applyStorageWrites(transaction, storageWrites);
    return true;
  });
}

async function handleSubscription(event: Stripe.Event, subscription: Stripe.Subscription) {
  const customer = await getStripe().customers.retrieve(subscription.customer as string) as Stripe.Customer;
  const uid = (customer.metadata?.kr_uid || '').trim();
  const familyId = (customer.metadata?.kr_family_id || '').trim() || null;
  if (!uid && !familyId) throw new Error('Stripe customer is not mapped to a KonnectedRoots account.');
  const existing = uid ? await getDb().collection('users').doc(uid).get() : null;
  if (uid && (subscription.schedule || existing?.data()?.billing?.hasBasePlanSchedule)) {
    return reconcileStripeSubscription(uid, subscription.id, event.created * 1000, event.type);
  }
  const common = {
    stripeCustomerId: customer.id,
    stripeSubscriptionId: subscription.id,
    ...subscriptionBillingState(event.type, subscription),
  };
  const eventCreated = event.created * 1000;
  const now = await subscriptionEvaluationTime(getStripe(), customer, subscription, uid);
  const updated = uid ? await updateBillingIfNewer(uid, eventCreated, common, event.type, now) : false;
  if (familyId) await updateFamilyIfNewer(familyId, eventCreated, { ...common, seatLimit: 6 }, uid || undefined, now);
  if (updated && familyId && common.plan === 'family' &&
      (common.status === 'active' || common.status === 'trialing') && common.currentPeriodEnd > now) {
    await activateFamilyOwnerMembership(uid, familyId, eventCreated);
  }
  return updated;
}

/**
 * Read live Stripe state after the transaction's authoritative document read.
 * A Firestore conflict retries BOTH reads, preventing equal-second events or an
 * explicit reconciliation racing a phase transition from persisting an old graph.
 * No Stripe mutation occurs inside this retryable transaction.
 */
export async function reconcileStripeSubscription(uid: string, subscriptionId: string, eventCreated?: number, eventType?: Stripe.Event['type'], confirmReleaseOnly = false) {
  const database = getDb();
  const userRef = database.collection('users').doc(uid);
  const result = await atStage(confirmReleaseOnly ? 'confirm_schedule_release' : 'reconcile_subscription_transaction', () => database.runTransaction(async transaction => {
    const userSnap = await transaction.get(userRef);
    const userData = userSnap.data() || {};
    const previous = userData.billing || {};
    if (!userSnap.exists || previous.stripeSubscriptionId !== subscriptionId) throw new Error('Subscription authority changed.');
    const api = getStripe();
    const live = await api.subscriptions.retrieve(subscriptionId);
    const customerId = stripeId(live.customer);
    const customer = await api.customers.retrieve(customerId);
    if (customer.deleted || customer.metadata.kr_uid !== uid || previous.stripeCustomerId !== customerId) throw new Error('Stripe account ownership mismatch.');
    const familyId = customer.metadata.kr_family_id || userData.family?.familyId || null;
    const familyRef = familyId ? database.collection('families').doc(familyId) : null;
    const familySnap = familyRef ? await transaction.get(familyRef) : null;
    if (familyRef && (!familySnap?.exists || familySnap.data()?.ownerUid !== uid ||
        (userData.family?.familyId && userData.family.familyId !== familyId))) throw new Error('Family workspace ownership mismatch.');
    const scheduleId = stripeId(live.schedule);
    const retainedId = scheduleId || previous.basePlanScheduleRecovery?.scheduleId || previous.stripeScheduleId;
    const schedule = retainedId ? await api.subscriptionSchedules.retrieve(retainedId) : null;
    const partialProof = Boolean(schedule?.phases.length === 1 && familyId &&
      await verifyPartialScheduleOwnership(api, schedule, live, uid, previous, familyId, functionsEnv.stripeSecretKey.startsWith('sk_live_')));
    const inspection = inspectDowngradeSchedule(live, schedule, uid, partialProof);
    const appliedReleaseScoped = Boolean(familyId && familySnap?.exists &&
      customer.livemode === live.livemode && live.metadata.kr_uid === uid &&
      live.metadata.kr_family_id === familyId && customer.metadata.kr_family_id === familyId && userData.family?.familyId === familyId &&
      familySnap.data()?.plan?.stripeCustomerId === customerId && familySnap.data()?.plan?.stripeSubscriptionId === subscriptionId &&
      ownsAppliedScheduleReceipt(previous, schedule, live, uid, familyId, functionsEnv.stripeSecretKey.startsWith('sk_live_')));
    const scheduled = scheduledDowngradeState(live, schedule, uid);
    const recoveryState = { scheduleReconciliationStatus: inspection.scheduleReconciliationStatus,
      scheduleReleaseConfirmed: !scheduleId && inspection.scheduleReconciliationStatus === 'released' && (partialProof || appliedReleaseScoped),
      partialScheduleDetected: inspection.partialScheduleDetected, partialScheduleRepairable: inspection.partialScheduleRepairable,
      safeToRetryScheduling: inspection.safeToRetryScheduling };
    const now = await subscriptionEvaluationTime(api, customer, live, uid);
    const next = reconcileSubscriptionAIPackState(previous, {
      ...subscriptionBillingState(live.status === 'canceled' ? 'customer.subscription.deleted' : 'customer.subscription.updated', live),
      stripeCustomerId: customerId, stripeSubscriptionId: live.id, ...scheduled, ...recoveryState,
    }, now);
    const latest = Math.max(Number(previous.latestStripeEventCreated || 0), eventCreated || 0);
    const operationFinished = previous.basePlanChangeOperation === 'schedule'
      ? scheduled.scheduledPlan === 'pro' || next.plan !== 'family'
      : previous.basePlanChangeOperation === 'cancel' && !scheduleId;
    const operation = operationFinished ? { basePlanChangeOperationId: null, basePlanChangeOperation: null } : {};
    const billing = { ...previous, ...next, ...operation, hasBasePlanSchedule: true, latestStripeEventCreated: latest, updatedAt: Date.now() };
    if (next.plan === 'family' && ['active', 'trialing'].includes(String(next.status)) && billing.planChangeTarget === 'family') {
      Object.assign(billing, { planChangeStatus: 'none', planChangeTarget: null, planChangeInterval: null,
        planChangeFamilyId: null, planChangeOperationId: null, planChangeRequestedAt: null, planChangeFailure: null });
    }
    // Preserve failed-upgrade semantics for the existing payment lifecycle.
    if (eventType === 'customer.subscription.pending_update_expired' && billing.planChangeStatus === 'pending') {
      billing.planChangeStatus = 'failed'; billing.planChangeFailure = 'payment_expired';
    }
    // Carry forward a conservative storage floor from the retained shared pool.
    // Never reset usage to zero at downgrade. Exact object reconciliation and
    // subsequent byte deltas remain the separately documented Phase 3/4 work.
    const storageFloor = previous.plan === 'family' && next.plan === 'pro' && familySnap?.exists
      ? { usage: { storageUsedBytes: Math.max(Number(userData.usage?.storageUsedBytes || 0), Number(familySnap.data()?.usage?.storageUsedBytes || 0)) } }
      : {};
    const projectedUser = { ...userData, billing, usage: { ...userData.usage, ...storageFloor.usage } };
    const projectedFamily = { ...familySnap?.data(), plan: { ...familySnap?.data()?.plan, ...next } };
    const storageWrites = familyId && familySnap?.exists
      ? await familyStorageWrites(transaction, database, familyId, projectedFamily, projectedUser, now) : [];
    transaction.set(userRef, { billing, ...storageFloor }, { merge: true });
    applyStorageWrites(transaction, storageWrites);
    if (familyRef && familySnap?.exists) {
      const oldPlan = familySnap.data()?.plan || {};
      const paidSeatsActive = next.plan === 'family' && ['active', 'trialing'].includes(String(next.status)) && Number(next.currentPeriodEnd) > now;
      transaction.set(familyRef, { plan: {
        ...oldPlan, ...next, latestStripeEventCreated: Math.max(Number(oldPlan.latestStripeEventCreated || 0), latest),
        seatLimit: next.plan === 'family' ? 6 : 0, paidSeatEntitlementActive: paidSeatsActive, updatedAt: Date.now(),
      } }, { merge: true });
    }
    const releaseScheduleId = scheduleId && inspection.appliedScheduleReleaseEligible && appliedReleaseScoped ? scheduleId : null;
    return { scheduled: { ...scheduled, ...recoveryState }, releaseScheduleId };
  }));
  // Release the now-applied schedule outside the retryable transaction so the
  // Pro subscription is immediately manageable (including add-on renewal).
  if (result.releaseScheduleId && !confirmReleaseOnly) {
    await atStage('release_applied_schedule', () => getStripe().subscriptionSchedules.release(result.releaseScheduleId!, { preserve_cancel_date: true }, {
      idempotencyKey: `kr-family-pro-complete:${result.releaseScheduleId}`,
    }));
    // A successful POST alone is not cleanup confirmation. Reread live Stripe
    // in a second transaction, publish the detached/released authority, and
    // only then allow customer-facing confirmation. Bound this reread even if
    // Stripe still reports attachment; a later safe retry can reconcile it.
    return reconcileStripeSubscription(uid, subscriptionId, eventCreated, eventType, true);
  }
  return result.scheduled;
}

export async function activateFamilyOwnerMembership(uid: string, familyId: string, eventCreated: number): Promise<boolean> {
  const database = getDb() as any;
  if (typeof database.runTransaction !== 'function') throw new Error('Family membership transaction unavailable.');
  const userRef = database.collection('users').doc(uid);
  const familyRef = database.collection('families').doc(familyId);
  const seatRef = familyRef.collection('seats').doc(uid);
  return database.runTransaction(async (transaction: any) => {
    const userSnap = await transaction.get(userRef);
    const familySnap = await transaction.get(familyRef);
    const seatSnap = await transaction.get(seatRef);
    if (!userSnap.exists || !familySnap.exists) throw new Error('Family upgrade authority was not found.');
    const userData = userSnap.data() || {};
    const billing = userData.billing || {};
    const familyData = familySnap.data() || {};
    const familyPlan = familyData.plan || {};
    if (familyData.ownerUid !== uid || billing.plan !== 'family' || familyPlan.plan !== 'family' ||
        !['active', 'trialing'].includes(billing.status) || !['active', 'trialing'].includes(familyPlan.status) ||
        Number(billing.latestStripeEventCreated || 0) !== eventCreated ||
        Number(familyPlan.latestStripeEventCreated || 0) !== eventCreated) {
      return false;
    }
    const linkedFamilyId = typeof userData.family?.familyId === 'string' ? userData.family.familyId : null;
    if (linkedFamilyId && linkedFamilyId !== familyId) {
      throw new Error('User is already linked to a different Family workspace.');
    }
    const membership = {
      familyId,
      role: 'owner',
      joinedAt: Number(userData.family?.joinedAt || 0) || Date.now(),
    };
    transaction.set(userRef, {
      family: membership,
      storageAuthority: deriveStorageAuthority({ ...userData, family: membership }, familyData, userData),
    }, { merge: true });
    if (!seatSnap.exists) {
      transaction.set(seatRef, {
        uid,
        email: typeof userData.email === 'string' ? userData.email : '',
        role: 'owner',
        status: 'active',
        invitedAt: Date.now(),
        joinedAt: Date.now(),
      });
    }
    return true;
  });
}

export async function markFamilyUpgradePaymentFailed(uid: string, eventCreated: number): Promise<boolean> {
  const database = getDb() as any;
  if (typeof database.runTransaction !== 'function') throw new Error('Family upgrade transaction unavailable.');
  const userRef = database.collection('users').doc(uid);
  return database.runTransaction(async (transaction: any) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) return false;
    const userData = userSnap.data() || {};
    const billing = userData.billing || {};
    if (billing.plan !== 'pro' || billing.planChangeStatus !== 'pending' || billing.planChangeTarget !== 'family' ||
        eventCreated < Number(billing.latestPlanChangeFailureEventCreated || 0)) {
      return false;
    }
    transaction.set(userRef, {
      billing: {
        ...billing,
        planChangeStatus: 'failed',
        planChangeOperationId: null,
        planChangeFailure: 'payment_failed',
        latestPlanChangeFailureEventCreated: eventCreated,
      },
    }, { merge: true });
    return true;
  });
}

type LegacyInvoiceSubscription = Stripe.Invoice & { subscription?: string | Stripe.Subscription | null };

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const current = invoice.parent?.subscription_details?.subscription;
  const legacy = (invoice as LegacyInvoiceSubscription).subscription;
  const subscription = current || legacy;
  return typeof subscription === 'string' ? subscription : subscription?.id || null;
}

function invoiceLinePrice(line: Stripe.InvoiceLineItem): string | Stripe.Price | null {
  return line.pricing?.price_details?.price || (line as Stripe.InvoiceLineItem & { price?: string | Stripe.Price }).price || null;
}

export function isQualifyingAIPackInvoice(invoice: Stripe.Invoice): boolean {
  return invoice.lines.data.some((line) => {
    const price = invoiceLinePrice(line);
    return typeof price === 'string'
      ? price === functionsEnv.prices.ai_pack_monthly
      : price?.id === functionsEnv.prices.ai_pack_monthly || price?.metadata?.kr_addon === 'ai_pack';
  });
}

export function isFamilyUpgradeInvoice(invoice: Stripe.Invoice): boolean {
  const familyPrices = new Set([
    functionsEnv.prices.family_monthly,
    functionsEnv.prices.family_yearly,
  ].filter(Boolean));
  return invoice.lines.data.some((line) => {
    const price = invoiceLinePrice(line);
    return typeof price === 'string'
      ? familyPrices.has(price)
      : Boolean(price && (familyPrices.has(price.id) || price.metadata?.kr_plan === 'family'));
  });
}

function invoiceAIPackPaidThrough(invoice: Stripe.Invoice): number {
  const linePeriodEnds = invoice.lines.data
    .filter((line) => {
      const price = invoiceLinePrice(line);
      return typeof price === 'string'
        ? price === functionsEnv.prices.ai_pack_monthly
        : price?.id === functionsEnv.prices.ai_pack_monthly;
    })
    .filter((line) => line.amount > 0 && line.period.start > 0 && line.period.end > line.period.start)
    .map((line) => stripeSecondsToMilliseconds(line.period.end))
    .filter((value) => value > 0);
  return linePeriodEnds.length ? Math.max(...linePeriodEnds) : 0;
}

export async function recordAIPackGrant(event: Stripe.Event, invoice: Stripe.Invoice, customerId: string): Promise<boolean> {
  if (!['invoice.paid', 'invoice.payment_succeeded'].includes(event.type) || invoice.status !== 'paid' ||
      invoice.amount_remaining !== 0 || invoice.amount_paid <= 0 || (invoice as Stripe.Invoice & { paid_out_of_band?: boolean }).paid_out_of_band ||
      stripeId(invoice.customer) !== customerId || !isQualifyingAIPackInvoice(invoice)) return false;
  if (invoice.lines.has_more) throw new Error('AI Pack invoice lines incomplete.');
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return false;
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  if (subscription.id !== subscriptionId) return false;
  const mapped = mapSubscriptionToPlan(subscription);
  if (!mapped.aiPackItemExists || !['pro', 'family'].includes(mapped.plan) || !['active', 'trialing'].includes(subscription.status)) return false;
  const paidThrough = invoiceAIPackPaidThrough(invoice);
  if (!paidThrough || stripeId(subscription.customer) !== customerId) return false;

  const customer = await getStripe().customers.retrieve(customerId) as Stripe.Customer;
  const uid = (customer.metadata?.kr_uid || '').trim();
  const familyId = (customer.metadata?.kr_family_id || '').trim() || null;
  if (!uid || customer.deleted) return false;
  const database = getDb() as any;
  if (typeof database.runTransaction !== 'function') throw new Error('AI Pack grant transaction unavailable.');
  // One grant per paid invoice, including the two payment event aliases.
  // Query existing legacy event-keyed grants inside the same transaction.
  const grants = database.collection('ai_pack_grants');
  const grantRef = grants.doc(`invoice_${invoice.id}`);
  const userRef = database.collection('users').doc(uid);
  const familyRef = familyId ? database.collection('families').doc(familyId) : null;
  return database.runTransaction(async (transaction: any) => {
    const grantSnap = await transaction.get(grantRef);
    if (grantSnap.exists) return false;
    const legacyGrants = await transaction.get(grants.where('invoiceId', '==', invoice.id).limit(1));
    if (!legacyGrants.empty) return false;
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) throw new Error('AI Pack billing account was not found.');
    const familySnap = familyRef ? await transaction.get(familyRef) : null;
    const userBilling = userSnap.data()?.billing || {};
    if (userBilling.stripeCustomerId !== customerId || userBilling.stripeSubscriptionId !== subscriptionId ||
        (subscription.metadata.kr_uid && subscription.metadata.kr_uid !== uid) ||
        (familySnap?.exists && (familySnap.data()?.ownerUid !== uid ||
          familySnap.data()?.plan?.stripeCustomerId !== customerId || familySnap.data()?.plan?.stripeSubscriptionId !== subscriptionId))) throw new Error('AI Pack payment ownership mismatch.');
    // A delayed older payment may be recorded once, but cannot shorten the
    // already-paid boundary or override stopped-renewal state.
    const extendedPaidThrough = Math.max(Number(userBilling.aiPackPaidThrough || 0), paidThrough);
    const now = await subscriptionEvaluationTime(getStripe(), customer, subscription, uid);
    const activated = {
      aiPackItemExists: true,
      aiPackStatus: extendedPaidThrough > now ? 'active' as const : 'pending' as const,
      aiPackPaidThrough: extendedPaidThrough,
      aiPackOperationId: null,
      aiPackRequestedAt: null,
      aiPackCancelAtPeriodEnd: false,
      aiPackScheduledRemovalAt: null,
      aiPackRemovalOperationId: null,
      aiPackRemovalRequestedAt: null,
      aiPackResumeOperationId: null,
      aiPackResumeRequestedAt: null,
      aiPackLastGrantedEventId: event.id,
      latestAIPackPaymentEventCreated: Math.max(Number(userBilling.latestAIPackPaymentEventCreated || 0), event.created * 1000),
      addons: { ...(userBilling.addons || {}), aiPack: extendedPaidThrough > now },
    };
    transaction.create(grantRef, {
      eventId: event.id,
      uid,
      familyId,
      invoiceId: invoice.id,
      subscriptionId,
      actions: 1000,
      paidThrough,
      createdAt: Date.now(),
    });
    transaction.set(userRef, { billing: { ...userBilling, ...activated } }, { merge: true });
    if (familyRef && familySnap?.exists && userBilling.plan === 'family' && familySnap.data()?.plan?.plan === 'family') {
      const familyPlan = familySnap.data()?.plan || {};
      transaction.set(familyRef, {
        plan: {
          ...familyPlan,
          ...activated,
          addons: { ...(familyPlan.addons || {}), aiPack: extendedPaidThrough > now },
        },
      }, { merge: true });
    }
    return true;
  });
}

export const stripeWebhook = onRequest({ region: 'us-central1', secrets: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'RESEND_API_KEY'] }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }
  const signature = req.headers['stripe-signature'] as string | undefined;
  let event: Stripe.Event;
  try {
    if (!signature || !(req as any).rawBody) throw new Error('Missing Stripe signature or raw body');
    event = getStripe().webhooks.constructEvent((req as any).rawBody, signature, functionsEnv.stripeWebhookSecret);
  } catch (error) {
    logger.error('Webhook signature verification failed');
    res.status(400).send('Webhook signature verification failed');
    return;
  }
  let claimed: 'claimed' | 'processed' | 'busy';
  try { claimed = await claimEvent(event); } catch (error) { logger.error('Could not claim billing event', safeWebhookFailure(event, error, 'claim_billing_event')); res.status(500).send('Webhook ledger unavailable'); return; }
  if (claimed === 'processed') { res.status(200).send('Already processed'); return; }
  // A busy/crashed worker must not acknowledge away Stripe's next retry.
  if (claimed === 'busy') { res.status(503).send('Webhook processing pending'); return; }
  try {
    if (isSupportedWebhookType(event.type)) {
      switch (event.type) {
        case 'subscription_schedule.created':
        case 'subscription_schedule.updated':
        case 'subscription_schedule.canceled':
        case 'subscription_schedule.released':
        case 'subscription_schedule.completed':
        case 'subscription_schedule.aborted': {
          const schedule = event.data.object as Stripe.SubscriptionSchedule;
          const subscriptionId = stripeId(schedule.subscription || schedule.released_subscription) || schedule.metadata?.kr_subscription_id;
          if (subscriptionId) {
            const customer = await getStripe().customers.retrieve(stripeId(schedule.customer));
            if (!customer.deleted && customer.metadata.kr_uid) {
              await reconcileStripeSubscription(customer.metadata.kr_uid, subscriptionId, event.created * 1000);
            }
          }
          break;
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
        case 'customer.subscription.pending_update_applied':
        case 'customer.subscription.pending_update_expired':
          await handleSubscription(event, event.data.object as Stripe.Subscription);
          break;
        case 'invoice.paid':
        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as Stripe.Invoice;
          await atStage('record_ai_pack_grant', () => recordAIPackGrant(event, invoice, stripeId(invoice.customer)));
          const customer = await getStripe().customers.retrieve(invoice.customer as string) as Stripe.Customer;
          const uid = customer.metadata?.kr_uid;
          if (uid) {
            const billing = (await getDb().collection('users').doc(uid).get()).data()?.billing;
            if (billing?.hasBasePlanSchedule && billing.stripeSubscriptionId) {
              await reconcileStripeSubscription(uid, billing.stripeSubscriptionId, event.created * 1000);
            }
          }
          // Both signed paid aliases can grant; invoice identity deduplicates.
          // Only the existing payment_succeeded event sends notifications.
          if (event.type === 'invoice.paid') break;
          if (uid) {
            const user = await getDb().collection('users').doc(uid).get();
            const data = user.data();
            if (data?.email) {
              const plan = data.billing?.plan === 'family' ? 'Family' : 'Pro';
              const interval = data.billing?.interval === 'year' ? 'Annual' : 'Monthly';
              const amount = (invoice as any).amount_paid ? `$${((invoice as any).amount_paid / 100).toFixed(2)}` : 'Paid';
              const email = paymentSuccessEmail(data.displayName || data.email, `${plan} (${interval})`, amount, 'Next billing cycle', (invoice as any).hosted_invoice_url || undefined);
              await sendEmail({ to: data.email, subject: email.subject, html: email.html });
            }
          }
          break;
        }
        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          const customer = await getStripe().customers.retrieve(invoice.customer as string) as Stripe.Customer;
          const uid = customer.metadata?.kr_uid;
          if (uid) {
            if (isFamilyUpgradeInvoice(invoice)) {
              await markFamilyUpgradePaymentFailed(uid, event.created * 1000);
            }
            const user = await getDb().collection('users').doc(uid).get();
            const data = user.data();
            if (data?.billing?.hasBasePlanSchedule && data.billing.stripeSubscriptionId) {
              await reconcileStripeSubscription(uid, data.billing.stripeSubscriptionId, event.created * 1000);
            }
            if (data?.email) {
              const amount = (invoice as any).amount_due ? `$${((invoice as any).amount_due / 100).toFixed(2)}` : 'your subscription';
              const email = paymentFailedEmail(data.displayName || data.email, amount, new Date(Date.now() + 3 * 86400000).toLocaleDateString('en-US'), `${functionsEnv.appUrl}/settings/billing`);
              await sendEmail({ to: data.email, subject: email.subject, html: email.html });
            }
          }
          break;
        }
        case 'checkout.session.completed':
          logger.info(`Checkout completed for session ${(event.data.object as Stripe.Checkout.Session).id}`);
          break;
      }
    }
    await completeEvent(event, { supported: isSupportedWebhookType(event.type) });
    res.status(200).send('OK');
  } catch (error) {
    const failure = safeWebhookFailure(event, error, `handle_${event.type}`);
    logger.error('Webhook handler error', failure);
    try { await getDb().collection('billing_events').doc(event.id).update({ status: 'failed', failure, errorCode: failure.errorCode, processedAt: Date.now() }); }
    catch (ledgerError) { logger.error('Could not record failed billing event', safeWebhookFailure(event, ledgerError, 'record_failed_event')); }
    res.status(500).send('Webhook handler error');
  }
});
