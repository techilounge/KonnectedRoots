import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import Stripe from 'stripe';
import { randomUUID } from 'node:crypto';
import { error as logError } from 'firebase-functions/logger';
import { functionsEnv } from './config';
import { resolvePlanPrice } from './billingCatalog';
import { downgradePhases, inspectDowngradeSchedule, scheduleFingerprint, scheduleConfigurationFingerprint, verifyPartialScheduleOwnership, stripeId } from './billingSchedules';
import { reconcileStripeSubscription } from './stripeWebhook';

function publicChange<T extends { stripeScheduleId: string | null }>(state: T) {
  const { stripeScheduleId: _serverOnlySchedule, ...safe } = state;
  return safe;
}

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
let stripe: Stripe;
function api() { return stripe || (stripe = new Stripe(functionsEnv.stripeSecretKey)); }

function assertInput(data: unknown, cancel: boolean) {
  if (data === undefined) return;
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      Object.keys(data).some(key => cancel || key !== 'plan') ||
      ('plan' in data && data.plan !== 'pro')) {
    throw new HttpsError('invalid-argument', 'This operation accepts only a logical Pro selection, never Stripe identifiers.');
  }
}

function requireEligible(billing: any) {
  if (['past_due', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'].includes(billing.status)) {
    throw new HttpsError('failed-precondition', 'Resolve payment in Stripe Portal before changing your plan.');
  }
  if (billing.plan !== 'family' || billing.status !== 'active' || Number(billing.currentPeriodEnd || 0) <= Date.now() ||
      billing.cancelAtPeriodEnd || Number(billing.scheduledCancellationAt || 0) > 0) {
    throw new HttpsError('failed-precondition', 'An active, renewing Family subscription is required.');
  }
}

async function claim(uid: string, subscriptionId: string, action: 'schedule' | 'cancel', cancelVerifiedPartial = false) {
  const ref = db.collection('users').doc(uid);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const user = snap.data() || {};
    const billing = user.billing || {};
    requireEligible(billing);
    if (billing.stripeSubscriptionId !== subscriptionId) throw new HttpsError('aborted', 'Billing changed; refresh and retry.');
    const familyId = user.family?.familyId;
    const family = familyId ? await tx.get(db.collection('families').doc(familyId)) : null;
    if (!family?.exists || family.data()?.ownerUid !== uid) throw new HttpsError('permission-denied', 'Only the Family billing owner can change the plan.');
    requireEligible(family.data()?.plan || {});
    if (family.data()?.plan?.stripeSubscriptionId !== subscriptionId || family.data()?.plan?.stripeCustomerId !== billing.stripeCustomerId) {
      throw new HttpsError('permission-denied', 'Family subscription ownership mismatch.');
    }
    if (billing.aiPackOperationId || billing.aiPackRemovalOperationId || billing.aiPackResumeOperationId || billing.planChangeStatus === 'pending') {
      throw new HttpsError('failed-precondition', 'Wait for the current billing change to finish before changing your plan.');
    }
    if (billing.basePlanChangeOperationId && billing.basePlanChangeOperation !== action &&
        !(cancelVerifiedPartial && action === 'cancel' && billing.basePlanChangeOperation === 'schedule')) {
      throw new HttpsError('aborted', 'Another plan change is in progress. Retry that operation first.');
    }
    const operationId = billing.basePlanChangeOperationId || randomUUID();
    tx.set(ref, { billing: { ...billing, basePlanChangeOperationId: operationId, basePlanChangeOperation: action, hasBasePlanSchedule: true } }, { merge: true });
    return { operationId, reusedOperation: Boolean(billing.basePlanChangeOperationId), familyId, customerId: String(billing.stripeCustomerId || '') };
  });
}

async function inspectOwned(uid: string, ctx: Awaited<ReturnType<typeof context>>, live: Stripe.Subscription, schedule: Stripe.SubscriptionSchedule) {
  const billing = (await db.collection('users').doc(uid).get()).data()?.billing || {};
  const proof = schedule.phases.length === 1 && await verifyPartialScheduleOwnership(api(), schedule, live, uid, billing,
    ctx.user.family.familyId, functionsEnv.stripeSecretKey.startsWith('sk_live_'));
  return inspectDowngradeSchedule(live, schedule, uid, proof);
}

async function recordRecovery(uid: string, ctx: Awaited<ReturnType<typeof context>>, operationId: string, schedule: Stripe.SubscriptionSchedule) {
  const ref = db.collection('users').doc(uid);
  await db.runTransaction(async tx => {
    const user = (await tx.get(ref)).data(); const billing = user?.billing || {};
    if (billing.basePlanChangeOperationId !== operationId || billing.basePlanChangeOperation !== 'schedule' ||
        billing.stripeSubscriptionId !== ctx.subscriptionId || billing.stripeCustomerId !== ctx.customerId ||
        user?.family?.familyId !== ctx.user.family.familyId) throw new HttpsError('aborted', 'Billing changed; refresh before retrying.');
    tx.set(ref, { billing: { ...billing, basePlanScheduleRecovery: { scheduleId: schedule.id, operationId,
      uid, subscriptionId: ctx.subscriptionId, customerId: ctx.customerId, familyId: ctx.user.family.familyId,
      livemode: schedule.livemode, fingerprint: scheduleFingerprint(schedule), configurationFingerprint: scheduleConfigurationFingerprint(schedule), version: 1 } } }, { merge: true });
  });
}

function reportFailure(stage: string, error: unknown) {
  const failure = error as { type?: string; code?: string; param?: string; requestId?: string; statusCode?: number };
  const safe = (value: unknown) => typeof value === 'string' && /^[a-zA-Z0-9_.:[\]-]{1,160}$/.test(value) ? value : null;
  // Do not log raw error messages, bodies, user/customer IDs, keys or recipients.
  logError('Family downgrade operation failed', { stage, type: safe(failure.type), code: safe(failure.code),
    param: safe(failure.param), requestId: safe(failure.requestId), statusCode: Number(failure.statusCode) || null });
}

async function context(uid: string) {
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Billing account not found.');
  const user = snap.data() || {};
  requireEligible(user.billing || {});
  const subscriptionId = String(user.billing.stripeSubscriptionId || '');
  const customerId = String(user.billing.stripeCustomerId || '');
  if (!subscriptionId || !customerId) throw new HttpsError('failed-precondition', 'Subscription mapping is unavailable.');
  const [subscription, customer] = await Promise.all([api().subscriptions.retrieve(subscriptionId), api().customers.retrieve(customerId)]);
  const livemode = functionsEnv.stripeSecretKey.startsWith('sk_live_');
  if (customer.deleted || customer.livemode !== livemode || subscription.livemode !== livemode || customer.metadata.kr_uid !== uid || stripeId(subscription.customer) !== customerId ||
      subscription.metadata.kr_uid !== uid || customer.metadata.kr_family_id !== user.family?.familyId) {
    throw new HttpsError('permission-denied', 'Stripe subscription ownership mismatch.');
  }
  const bases = subscription.items.data.filter(item => ['pro', 'family'].includes(item.price.metadata?.kr_plan));
  const base = bases[0];
  const interval = base?.price.recurring?.interval;
  const familyPrice = resolvePlanPrice(functionsEnv.prices, 'family', interval);
  const proPrice = resolvePlanPrice(functionsEnv.prices, 'pro', interval);
  requireEligible({ plan: base?.price.metadata.kr_plan, status: subscription.status,
    currentPeriodEnd: Number(base?.current_period_end || 0) * 1000,
    cancelAtPeriodEnd: subscription.cancel_at_period_end, scheduledCancellationAt: subscription.cancel_at });
  if (bases.length !== 1 || !proPrice || !familyPrice || base.price.id !== familyPrice ||
      !['month', 'year'].includes(String(interval)) || (base.quantity || 1) !== 1 || subscription.pending_update) {
    throw new HttpsError('failed-precondition', 'The subscription requires reconciliation before a scheduled change.');
  }
  const addons = subscription.items.data.filter(item => item !== base);
  if (addons.length > 1 || addons.some(item => item.price.id !== functionsEnv.prices.ai_pack_monthly ||
      item.price.metadata?.kr_addon !== 'ai_pack' || (item.quantity || 1) !== 1)) {
    throw new HttpsError('failed-precondition', 'The subscription item graph requires reconciliation.');
  }
  const target = await api().prices.retrieve(proPrice);
  if (target.livemode !== livemode || !target.active || target.metadata.kr_plan !== 'pro' || target.currency !== 'usd' ||
      target.recurring?.interval !== interval || target.recurring?.interval_count !== 1 ||
      target.unit_amount !== (interval === 'month' ? 599 : 5999)) {
    throw new HttpsError('failed-precondition', 'The Pro price does not match the approved catalog.');
  }
  return { user, subscription, subscriptionId, customerId, proPrice, interval: interval as 'month' | 'year' };
}

async function finishOperation(uid: string, operationId: string) {
  const ref = db.collection('users').doc(uid);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref); const billing = snap.data()?.billing || {};
    if (billing.basePlanChangeOperationId === operationId) tx.set(ref, { billing: {
      ...billing, basePlanChangeOperationId: null, basePlanChangeOperation: null,
    } }, { merge: true });
  });
}

function assertUnchangedFamily(live: Stripe.Subscription, observed: Stripe.Subscription, customerId: string) {
  const base = live.items.data.find(item => item.price.metadata?.kr_plan === 'family');
  requireEligible({ plan: base?.price.metadata.kr_plan, status: live.status,
    currentPeriodEnd: Number(base?.current_period_end || 0) * 1000,
    cancelAtPeriodEnd: live.cancel_at_period_end, scheduledCancellationAt: live.cancel_at });
  const graph = (sub: Stripe.Subscription) => JSON.stringify(sub.items.data.map(item =>
    `${item.id}:${item.price.id}:${item.quantity || 1}:${item.current_period_end}`).sort());
  if (live.livemode !== observed.livemode || stripeId(live.customer) !== customerId || live.pending_update || graph(live) !== graph(observed)) {
    throw new HttpsError('aborted', 'The live subscription changed. Refresh billing and retry.');
  }
}

export const scheduleDowngradeToPro = onCall({ region: 'us-central1', secrets: ['STRIPE_SECRET_KEY'] }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to change your plan.');
  assertInput(request.data, false);
  const uid = request.auth.uid;
  const ctx = await context(uid);
  const claimed = await claim(uid, ctx.subscriptionId, 'schedule');
  let stage = 'read_current_subscription';
  try {
    // Fetch again after the per-subscription claim; the claim excludes add-on
    // mutations and carries a stable idempotency key across failed requests.
    const live = await api().subscriptions.retrieve(ctx.subscriptionId);
    try { assertUnchangedFamily(live, ctx.subscription, ctx.customerId); }
    catch (error) { await finishOperation(uid, claimed.operationId); throw error; }
    let schedule: Stripe.SubscriptionSchedule;
    if (live.schedule) {
      schedule = await api().subscriptionSchedules.retrieve(stripeId(live.schedule));
      const inspection = await inspectOwned(uid, ctx, live, schedule);
      if (inspection.scheduledDowngradeVerified) {
        const state = await reconcileStripeSubscription(uid, ctx.subscriptionId);
        await finishOperation(uid, claimed.operationId);
        return { success: true, ...publicChange(state) };
      }
      if (!inspection.partialScheduleRepairable) {
        if (!claimed.reusedOperation) await finishOperation(uid, claimed.operationId);
        throw new HttpsError('failed-precondition', 'This schedule has no verified safe recovery path. Contact support.');
      }
    } else {
      stage = 'create_schedule';
      schedule = await api().subscriptionSchedules.create({ from_subscription: ctx.subscriptionId }, {
        idempotencyKey: `kr-family-pro-create:${ctx.subscriptionId}:${claimed.operationId}`,
      });
      // B: retain the same schedule with a server-owned receipt. A lost create
      // response is recovered only through the matching Stripe creation event.
      if (!inspectDowngradeSchedule({ ...live, schedule: schedule.id }, schedule, uid, true).partialScheduleRepairable) {
        throw new HttpsError('failed-precondition', 'The newly created schedule requires support reconciliation.');
      }
    }
    if (stripeId(schedule.customer) !== ctx.customerId || stripeId(schedule.subscription) !== ctx.subscriptionId ||
        schedule.status !== 'active' || schedule.phases.length !== 1) {
      throw new HttpsError('failed-precondition', 'The subscription schedule requires support reconciliation.');
    }
    stage = 'persist_recovery_receipt';
    await recordRecovery(uid, ctx, claimed.operationId, schedule);
    stage = 'recheck_before_configuration';
    const latest = await api().subscriptions.retrieve(ctx.subscriptionId);
    assertUnchangedFamily(latest, live, ctx.customerId);
    if (stripeId(latest.schedule) !== schedule.id) throw new HttpsError('aborted', 'The attached schedule changed. Contact support.');
    const observed = await api().subscriptionSchedules.retrieve(schedule.id);
    if (inspectDowngradeSchedule(latest, observed, uid).scheduledDowngradeVerified) {
      const state = await reconcileStripeSubscription(uid, ctx.subscriptionId);
      await finishOperation(uid, claimed.operationId);
      return { success: true, ...publicChange(state) };
    }
    if (scheduleFingerprint(observed) !== scheduleFingerprint(schedule)) {
      throw new HttpsError('failed-precondition', 'Schedule settings changed before configuration. Contact support.');
    }
    stage = 'construct_phases';
    const phases = downgradePhases(observed, latest, ctx.proPrice, ctx.interval);
    stage = 'configure_phases';
    await api().subscriptionSchedules.update(schedule.id, {
      end_behavior: 'release', proration_behavior: 'none', phases,
      metadata: { ...schedule.metadata, kr_change: 'family_to_pro', kr_uid: uid,
        kr_subscription_id: ctx.subscriptionId, kr_family_id: claimed.familyId, kr_operation_id: claimed.operationId },
    // v2 deliberately differs from the invalid v1 request's cached Stripe key.
    }, { idempotencyKey: `kr-family-pro-configure:v2:${schedule.id}:${claimed.operationId}` });
    stage = 'verify_live_configuration';
    const state = await reconcileStripeSubscription(uid, ctx.subscriptionId);
    if (state.scheduledPlan !== 'pro') throw new HttpsError('unavailable', 'The scheduled change is awaiting reconciliation. Retry safely.');
    await finishOperation(uid, claimed.operationId);
    return { success: true, ...publicChange(state) };
  } catch (error) {
    reportFailure(stage, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('unavailable', 'The scheduled change could not be confirmed. Your current Family entitlement remains unchanged. Retry safely.');
  }
});

export const cancelScheduledDowngrade = onCall({ region: 'us-central1', secrets: ['STRIPE_SECRET_KEY'] }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to keep your Family plan.');
  assertInput(request.data, true);
  const uid = request.auth.uid;
  const ctx = await context(uid);
  const attached = ctx.subscription.schedule ? await api().subscriptionSchedules.retrieve(stripeId(ctx.subscription.schedule)) : null;
  const partial = attached ? (await inspectOwned(uid, ctx, ctx.subscription, attached)).partialScheduleRepairable : false;
  const claimed = await claim(uid, ctx.subscriptionId, 'cancel', partial);
  try {
    const live = await api().subscriptions.retrieve(ctx.subscriptionId);
    try { assertUnchangedFamily(live, ctx.subscription, ctx.customerId); }
    catch (error) { await finishOperation(uid, claimed.operationId); throw error; }
    if (live.schedule) {
      const schedule = await api().subscriptionSchedules.retrieve(stripeId(live.schedule));
      const inspection = await inspectOwned(uid, ctx, live, schedule);
      if (!inspection.scheduledDowngradeVerified && !inspection.partialScheduleRepairable) {
        await finishOperation(uid, claimed.operationId);
        throw new HttpsError('failed-precondition', 'This schedule cannot be canceled safely. Contact support.');
      }
      // Release, never cancel: cancellation would terminate the subscription.
      await api().subscriptionSchedules.release(schedule.id, { preserve_cancel_date: false }, {
        idempotencyKey: `kr-family-pro-release:${schedule.id}`,
      });
    }
    const state = await reconcileStripeSubscription(uid, ctx.subscriptionId);
    await finishOperation(uid, claimed.operationId);
    return { success: true, ...publicChange(state) };
  } catch (error) {
    reportFailure('keep_family', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('unavailable', 'Keeping Family could not be confirmed. Retry safely or contact support.');
  }
});

/** Scoped, authenticated repair; never a broad reconciliation from a page load. */
export const reconcileScheduledBilling = onCall({ region: 'us-central1', secrets: ['STRIPE_SECRET_KEY'] }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to refresh billing.');
  assertInput(request.data, true);
  const billing = (await db.collection('users').doc(request.auth.uid).get()).data()?.billing;
  if (!billing?.stripeSubscriptionId) throw new HttpsError('failed-precondition', 'No subscription to reconcile.');
  return publicChange(await reconcileStripeSubscription(request.auth.uid, billing.stripeSubscriptionId));
});
