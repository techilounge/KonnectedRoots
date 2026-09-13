import { functionsEnv } from './config';
import { resolvePlanPrice } from './billingCatalog';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as functions from 'firebase-functions/v2';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';
import { randomUUID } from 'node:crypto';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
let stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripe) stripe = new Stripe(functionsEnv.stripeSecretKey);
  return stripe;
}

type CheckoutInput = {
  plan?: unknown;
  interval?: unknown;
  addons?: unknown;
  priceId?: unknown;
  successUrl?: unknown;
  cancelUrl?: unknown;
  familyId?: unknown;
};

type FamilyUpgradeInput = {
  plan?: unknown;
  interval?: unknown;
  [key: string]: unknown;
};

const paidStatuses = new Set(['active', 'trialing', 'past_due', 'unpaid', 'incomplete']);
const paymentAttentionStatuses = new Set(['past_due', 'unpaid', 'incomplete', 'incomplete_expired', 'paused']);

function assertBillingPaymentResolved(billing: any): void {
  if (['pro', 'family'].includes(billing?.plan) && paymentAttentionStatuses.has(billing?.status)) {
    throw new HttpsError('failed-precondition', 'Your existing subscription requires payment. Fix your payment method in Stripe Portal before changing your plan or AI Pack.');
  }
  if (billing?.basePlanChangeOperationId || billing?.stripeScheduleId) {
    throw new HttpsError('failed-precondition', 'Keep your Family plan before making another billing change, or wait for the scheduled change to finish.');
  }
}

async function assertAccountBillingPaymentResolved(userData: any): Promise<void> {
  assertBillingPaymentResolved(userData.billing);
  if (typeof userData.family?.familyId === 'string' && userData.family.familyId) {
    const familySnap = await db.collection('families').doc(userData.family.familyId).get();
    assertBillingPaymentResolved(familySnap.data()?.plan);
  }
}

type AIPackStatus = 'none' | 'pending' | 'active';

interface AIPackOperationClaim {
  status: AIPackStatus;
  operationId: string | null;
  shouldCreateItem: boolean;
  alreadyExists: boolean;
}

interface AIPackRemovalClaim {
  status: 'none' | 'removing' | 'scheduled';
  operationId: string | null;
  paidThrough: number | null;
  familyId: string | null;
  shouldDeleteItem: boolean;
}

interface AIPackResumeClaim {
  status: 'resuming' | 'renewing';
  operationId: string | null;
  paidThrough: number;
  familyId: string | null;
  shouldCreateItem: boolean;
}

interface FamilyUpgradeClaim {
  operationId: string;
  familyId: string;
  shouldUpdateSubscription: boolean;
}

function hasAIPackItem(subscription: Stripe.Subscription): boolean {
  const matches = ({ price }: Stripe.SubscriptionItem) =>
    price.id === functionsEnv.prices.ai_pack_monthly || price.metadata?.kr_addon === 'ai_pack';
  return subscription.items.data.some(matches) ||
    subscription.pending_update?.subscription_items?.some(matches) === true;
}

function hasPaidAIPackEntitlement(billing: any, now = Date.now()): boolean {
  const paidThrough = Number(billing?.aiPackPaidThrough || 0);
  const scheduledRemovalAt = Number(billing?.aiPackScheduledRemovalAt || 0);
  const recurringOrPrepaid = billing?.aiPackItemExists === true || (
    billing?.aiPackCancelAtPeriodEnd === true &&
    scheduledRemovalAt === paidThrough &&
    scheduledRemovalAt > now
  );
  return recurringOrPrepaid &&
    billing?.aiPackStatus === 'active' &&
    paidThrough > now &&
    billing?.addons?.aiPack === true;
}

async function aiPackEvaluationTime(billing: any, uid: string): Promise<number> {
  if (!['development', 'test'].includes(process.env.NODE_ENV || '') || process.env.FUNCTIONS_EMULATOR !== 'true' ||
      process.env.GCLOUD_PROJECT !== 'demo-konnectedroots-phase2' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' ||
      !functionsEnv.stripeSecretKey.startsWith('sk_test_') || !billing.stripeSubscriptionId) return Date.now();
  const api=getStripe();
  const subscription=await api.subscriptions.retrieve(billing.stripeSubscriptionId);
  const customer=await api.customers.retrieve(billing.stripeCustomerId);
  const subscriptionCustomerId=typeof subscription.customer==='string'?subscription.customer:subscription.customer.id;
  if (customer.deleted || subscriptionCustomerId!==customer.id || customer.id!==billing.stripeCustomerId || customer.metadata.kr_uid!==uid) throw new HttpsError('permission-denied','AI Pack billing ownership mismatch.');
  const { subscriptionEvaluationTime } = await import('./stripeWebhook');
  return subscriptionEvaluationTime(api,customer,subscription,uid);
}

function metadataAIPackItems(subscription: Stripe.Subscription): Stripe.SubscriptionItem[] {
  return subscription.items.data.filter(({ price }) => price.metadata?.kr_addon === 'ai_pack');
}

function metadataPlanItems(subscription: Stripe.Subscription): Stripe.SubscriptionItem[] {
  return subscription.items.data.filter(({ price }) =>
    price.metadata?.kr_plan === 'pro' || price.metadata?.kr_plan === 'family');
}

function pendingMetadataPlanItems(subscription: Stripe.Subscription): Stripe.SubscriptionItem[] {
  return subscription.pending_update?.subscription_items?.filter(({ price }) =>
    price.metadata?.kr_plan === 'pro' || price.metadata?.kr_plan === 'family') || [];
}

export async function claimAIPackOperation(
  uid: string,
  stripeSubscriptionId: string,
  observedItemExists: boolean,
  proposedOperationId: string,
): Promise<AIPackOperationClaim> {
  const userRef = db.collection('users').doc(uid);
  return db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) throw new HttpsError('not-found', 'User not found');
    const userData = userSnap.data() || {};
    const billing = userData.billing || {};
    const now = await aiPackEvaluationTime(billing, uid);
    assertBillingPaymentResolved(billing);
    if (typeof userData.family?.familyId === 'string' && userData.family.familyId) {
      const familySnap = await transaction.get(db.collection('families').doc(userData.family.familyId));
      assertBillingPaymentResolved(familySnap.data()?.plan);
    }
    if (billing.stripeSubscriptionId !== stripeSubscriptionId || !['pro', 'family'].includes(billing.plan) || !['active', 'trialing'].includes(billing.status)) {
      throw new HttpsError('failed-precondition', 'AI Pack requires an active Pro or Family subscription');
    }
    if (hasPaidAIPackEntitlement(billing, now)) {
      return { status: 'active', operationId: null, shouldCreateItem: false, alreadyExists: true };
    }

    const operationId = typeof billing.aiPackOperationId === 'string' && billing.aiPackOperationId
      ? billing.aiPackOperationId
      : proposedOperationId;
    const itemExists = observedItemExists;
    transaction.set(userRef, {
      billing: {
        ...billing,
        aiPackStatus: 'pending',
        aiPackPaidThrough: null,
        aiPackItemExists: itemExists,
        aiPackOperationId: operationId,
        aiPackRequestedAt: Number(billing.aiPackRequestedAt || 0) || Date.now(),
        addons: { ...(billing.addons || {}), aiPack: false },
      },
    }, { merge: true });
    return {
      status: 'pending',
      operationId,
      shouldCreateItem: !itemExists,
      alreadyExists: itemExists,
    };
  });
}

async function recordAIPackItemObservation(uid: string, operationId: string, itemExists: boolean): Promise<void> {
  const userRef = db.collection('users').doc(uid);
  await db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) return;
    const billing = userSnap.data()?.billing || {};
    const now = await aiPackEvaluationTime(billing, uid);
    if (billing.aiPackOperationId !== operationId || hasPaidAIPackEntitlement(billing, now)) return;
    transaction.set(userRef, {
      billing: {
        ...billing,
        aiPackStatus: 'pending',
        aiPackPaidThrough: null,
        aiPackItemExists: itemExists,
        addons: { ...(billing.addons || {}), aiPack: false },
      },
    }, { merge: true });
  });
}

export async function claimAIPackRemoval(
  uid: string,
  stripeSubscriptionId: string,
  observedItemExists: boolean,
  proposedOperationId: string,
): Promise<AIPackRemovalClaim> {
  const userRef = db.collection('users').doc(uid);
  return db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) throw new HttpsError('not-found', 'User not found');
    const userData = userSnap.data() || {};
    const billing = userData.billing || {};
    const now = await aiPackEvaluationTime(billing, uid);
    assertBillingPaymentResolved(billing);
    if (billing.stripeSubscriptionId !== stripeSubscriptionId ||
        !['pro', 'family'].includes(billing.plan) ||
        !['active', 'trialing'].includes(billing.status)) {
      throw new HttpsError('failed-precondition', 'AI Pack removal requires an active Pro or Family subscription');
    }

    const familyId = billing.plan === 'family' && typeof userData.family?.familyId === 'string'
      ? userData.family.familyId
      : null;
    const familyRef = familyId ? db.collection('families').doc(familyId) : null;
    const familySnap = familyRef ? await transaction.get(familyRef) : null;
    const familyPlan = familySnap?.data()?.plan || {};
    assertBillingPaymentResolved(familyPlan);
    if (familyRef && (!familySnap?.exists || familySnap.data()?.ownerUid !== uid ||
        familyPlan.stripeSubscriptionId !== stripeSubscriptionId ||
        familyPlan.stripeCustomerId !== billing.stripeCustomerId ||
        familyPlan.plan !== 'family' ||
        !['active', 'trialing'].includes(familyPlan.status))) {
      throw new HttpsError('permission-denied', 'Only the Family billing owner can remove the AI Pack');
    }

    if (!observedItemExists && billing.aiPackCancelAtPeriodEnd === true && hasPaidAIPackEntitlement(billing, now)) {
      return {
        status: 'scheduled',
        operationId: null,
        paidThrough: Number(billing.aiPackScheduledRemovalAt || billing.aiPackPaidThrough),
        familyId,
        shouldDeleteItem: false,
      };
    }
    if (!hasPaidAIPackEntitlement(billing, now)) {
      return { status: 'none', operationId: null, paidThrough: null, familyId, shouldDeleteItem: false };
    }

    const operationId = typeof billing.aiPackRemovalOperationId === 'string' && billing.aiPackRemovalOperationId
      ? billing.aiPackRemovalOperationId
      : proposedOperationId;
    const paidThrough = Number(billing.aiPackPaidThrough);
    if (!observedItemExists) {
      const scheduled = {
        aiPackItemExists: false,
        aiPackStatus: 'active' as const,
        aiPackPaidThrough: paidThrough,
        aiPackCancelAtPeriodEnd: true,
        aiPackScheduledRemovalAt: paidThrough,
        aiPackRemovalOperationId: null,
        aiPackRemovalRequestedAt: null,
        addons: { ...(billing.addons || {}), aiPack: true },
      };
      transaction.set(userRef, { billing: { ...billing, ...scheduled } }, { merge: true });
      if (familyRef && familySnap?.exists) {
        transaction.set(familyRef, {
          plan: { ...familyPlan, ...scheduled, addons: { ...(familyPlan.addons || {}), aiPack: true } },
        }, { merge: true });
      }
      return { status: 'scheduled', operationId: null, paidThrough, familyId, shouldDeleteItem: false };
    }

    const removalClaim = {
      aiPackRemovalOperationId: operationId,
      aiPackRemovalRequestedAt: Number(billing.aiPackRemovalRequestedAt || 0) || Date.now(),
    };
    transaction.set(userRef, { billing: { ...billing, ...removalClaim } }, { merge: true });
    if (familyRef && familySnap?.exists) {
      transaction.set(familyRef, { plan: { ...familyPlan, ...removalClaim } }, { merge: true });
    }
    return { status: 'removing', operationId, paidThrough, familyId, shouldDeleteItem: true };
  });
}

export async function finalizeAIPackRemoval(
  uid: string,
  stripeSubscriptionId: string,
  operationId: string,
  paidThrough: number,
  familyId: string | null,
): Promise<number | null> {
  const userRef = db.collection('users').doc(uid);
  return db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) throw new HttpsError('not-found', 'User not found');
    const billing = userSnap.data()?.billing || {};
    const now = await aiPackEvaluationTime(billing, uid);
    if (billing.stripeSubscriptionId !== stripeSubscriptionId) {
      throw new HttpsError('failed-precondition', 'Billing subscription changed during AI Pack removal');
    }
    if (billing.aiPackRemovalOperationId && billing.aiPackRemovalOperationId !== operationId) {
      throw new HttpsError('aborted', 'A newer AI Pack removal operation is in progress');
    }
    const keepPrepaidAccess =
      ['pro', 'family'].includes(billing.plan) &&
      ['active', 'trialing'].includes(billing.status) &&
      paidThrough > now;
    const familyRef = familyId ? db.collection('families').doc(familyId) : null;
    const familySnap = familyRef ? await transaction.get(familyRef) : null;
    const familyPlan = familySnap?.data()?.plan || {};
    if (familyRef && (!familySnap?.exists || familySnap.data()?.ownerUid !== uid ||
        familyPlan.stripeSubscriptionId !== stripeSubscriptionId ||
        familyPlan.stripeCustomerId !== billing.stripeCustomerId ||
        familyPlan.plan !== 'family' ||
        !['active', 'trialing'].includes(familyPlan.status))) {
      throw new HttpsError('permission-denied', 'Family billing ownership changed during AI Pack removal');
    }
    const scheduled = {
      aiPackItemExists: false,
      aiPackStatus: keepPrepaidAccess ? 'active' as const : 'none' as const,
      aiPackPaidThrough: keepPrepaidAccess ? paidThrough : null,
      aiPackCancelAtPeriodEnd: keepPrepaidAccess,
      aiPackScheduledRemovalAt: keepPrepaidAccess ? paidThrough : null,
      aiPackRemovalOperationId: null,
      aiPackRemovalRequestedAt: null,
      addons: { ...(billing.addons || {}), aiPack: keepPrepaidAccess },
    };
    transaction.set(userRef, { billing: { ...billing, ...scheduled } }, { merge: true });

    if (familyRef && familySnap?.exists) {
      transaction.set(familyRef, {
        plan: { ...familyPlan, ...scheduled, addons: { ...(familyPlan.addons || {}), aiPack: keepPrepaidAccess } },
      }, { merge: true });
    }
    return keepPrepaidAccess ? paidThrough : null;
  });
}

function hasScheduledAIPackRemoval(billing: any, now = Date.now()): boolean {
  const paidThrough = Number(billing?.aiPackPaidThrough || 0);
  return billing?.aiPackItemExists === false &&
    billing?.aiPackStatus === 'active' &&
    billing?.addons?.aiPack === true &&
    billing?.aiPackCancelAtPeriodEnd === true &&
    Number(billing?.aiPackScheduledRemovalAt || 0) === paidThrough &&
    paidThrough > now;
}

export async function claimAIPackResume(
  uid: string,
  stripeSubscriptionId: string,
  observedItemExists: boolean,
  proposedOperationId: string,
): Promise<AIPackResumeClaim> {
  const userRef = db.collection('users').doc(uid);
  return db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) throw new HttpsError('not-found', 'User not found');
    const userData = userSnap.data() || {};
    const billing = userData.billing || {};
    const now = await aiPackEvaluationTime(billing, uid);
    assertBillingPaymentResolved(billing);
    if (billing.stripeSubscriptionId !== stripeSubscriptionId ||
        !['pro', 'family'].includes(billing.plan) ||
        !['active', 'trialing'].includes(billing.status)) {
      throw new HttpsError('failed-precondition', 'AI Pack renewal requires an active Pro or Family subscription');
    }

    const familyId = billing.plan === 'family' && typeof userData.family?.familyId === 'string'
      ? userData.family.familyId
      : null;
    const familyRef = familyId ? db.collection('families').doc(familyId) : null;
    const familySnap = familyRef ? await transaction.get(familyRef) : null;
    const familyPlan = familySnap?.data()?.plan || {};
    assertBillingPaymentResolved(familyPlan);
    if (billing.plan === 'family' && !familyRef) {
      throw new HttpsError('failed-precondition', 'Family billing workspace requires reconciliation before resuming AI Pack renewal');
    }
    if (familyRef && (!familySnap?.exists || familySnap.data()?.ownerUid !== uid ||
        familyPlan.stripeSubscriptionId !== stripeSubscriptionId ||
        familyPlan.stripeCustomerId !== billing.stripeCustomerId ||
        familyPlan.plan !== 'family' ||
        !['active', 'trialing'].includes(familyPlan.status))) {
      throw new HttpsError('permission-denied', 'Only the Family billing owner can resume AI Pack renewal');
    }

    const paidThrough = Number(billing.aiPackPaidThrough || 0);
    if (paidThrough <= now) {
      throw new HttpsError('failed-precondition', 'AI Pack paid access has expired. Add AI Pack again to restart billing.');
    }
    const familyStateMatches = !familyRef || (
      Number(familyPlan.aiPackPaidThrough || 0) === paidThrough &&
      familyPlan.aiPackStatus === 'active' &&
      familyPlan.addons?.aiPack === true
    );
    if (!familyStateMatches) {
      throw new HttpsError('failed-precondition', 'Family AI Pack state requires reconciliation before renewal can resume');
    }

    if (observedItemExists) {
      if (!hasPaidAIPackEntitlement(billing, now) ||
          (familyRef && !hasPaidAIPackEntitlement(familyPlan, now))) {
        throw new HttpsError('failed-precondition', 'AI Pack state requires reconciliation before renewal can resume');
      }
      const renewing = {
        aiPackItemExists: true,
        aiPackStatus: 'active' as const,
        aiPackPaidThrough: paidThrough,
        aiPackCancelAtPeriodEnd: false,
        aiPackScheduledRemovalAt: null,
        aiPackRemovalOperationId: null,
        aiPackRemovalRequestedAt: null,
        aiPackResumeOperationId: null,
        aiPackResumeRequestedAt: null,
        addons: { ...(billing.addons || {}), aiPack: true },
      };
      transaction.set(userRef, { billing: { ...billing, ...renewing } }, { merge: true });
      if (familyRef && familySnap?.exists) {
        transaction.set(familyRef, {
          plan: { ...familyPlan, ...renewing, addons: { ...(familyPlan.addons || {}), aiPack: paidThrough > now } },
        }, { merge: true });
      }
      return { status: 'renewing', operationId: null, paidThrough, familyId, shouldCreateItem: false };
    }

    if (!hasScheduledAIPackRemoval(billing, now) ||
        (familyRef && !hasScheduledAIPackRemoval(familyPlan, now))) {
      throw new HttpsError('failed-precondition', 'AI Pack renewal is not eligible to resume. Add AI Pack again if access has expired.');
    }
    const operationId = typeof billing.aiPackResumeOperationId === 'string' && billing.aiPackResumeOperationId
      ? billing.aiPackResumeOperationId
      : proposedOperationId;
    const resumeClaim = {
      aiPackResumeOperationId: operationId,
      aiPackResumeRequestedAt: Number(billing.aiPackResumeRequestedAt || 0) || Date.now(),
    };
    transaction.set(userRef, { billing: { ...billing, ...resumeClaim } }, { merge: true });
    if (familyRef && familySnap?.exists) {
      transaction.set(familyRef, { plan: { ...familyPlan, ...resumeClaim } }, { merge: true });
    }
    return { status: 'resuming', operationId, paidThrough, familyId, shouldCreateItem: true };
  });
}

export async function finalizeAIPackResume(
  uid: string,
  stripeSubscriptionId: string,
  operationId: string,
  paidThrough: number,
  familyId: string | null,
): Promise<void> {
  const userRef = db.collection('users').doc(uid);
  await db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) throw new HttpsError('not-found', 'User not found');
    const billing = userSnap.data()?.billing || {};
    const now = await aiPackEvaluationTime(billing, uid);
    if (billing.stripeSubscriptionId !== stripeSubscriptionId ||
        !['pro', 'family'].includes(billing.plan) ||
        !['active', 'trialing'].includes(billing.status) ||
        Number(billing.aiPackPaidThrough || 0) !== paidThrough) {
      throw new HttpsError('failed-precondition', 'Billing state changed while AI Pack renewal was resuming');
    }
    if (billing.aiPackResumeOperationId && billing.aiPackResumeOperationId !== operationId) {
      throw new HttpsError('aborted', 'A newer AI Pack renewal operation is in progress');
    }
    if (!billing.aiPackResumeOperationId && billing.aiPackItemExists !== true) {
      throw new HttpsError('aborted', 'AI Pack renewal operation is no longer current');
    }

    const familyRef = familyId ? db.collection('families').doc(familyId) : null;
    const familySnap = familyRef ? await transaction.get(familyRef) : null;
    const familyPlan = familySnap?.data()?.plan || {};
    if (familyRef && (!familySnap?.exists || familySnap.data()?.ownerUid !== uid ||
        familyPlan.stripeSubscriptionId !== stripeSubscriptionId ||
        familyPlan.stripeCustomerId !== billing.stripeCustomerId ||
        Number(familyPlan.aiPackPaidThrough || 0) !== paidThrough ||
        !['active', 'trialing'].includes(familyPlan.status))) {
      throw new HttpsError('permission-denied', 'Family billing ownership changed while AI Pack renewal was resuming');
    }

    const renewing = {
      aiPackItemExists: true,
      aiPackStatus: paidThrough > now ? 'active' as const : 'pending' as const,
      aiPackPaidThrough: paidThrough,
      aiPackCancelAtPeriodEnd: false,
      aiPackScheduledRemovalAt: null,
      aiPackRemovalOperationId: null,
      aiPackRemovalRequestedAt: null,
      aiPackResumeOperationId: null,
      aiPackResumeRequestedAt: null,
      addons: { ...(billing.addons || {}), aiPack: paidThrough > now },
    };
    transaction.set(userRef, { billing: { ...billing, ...renewing } }, { merge: true });
    if (familyRef && familySnap?.exists) {
      transaction.set(familyRef, {
        plan: { ...familyPlan, ...renewing, addons: { ...(familyPlan.addons || {}), aiPack: paidThrough > now } },
      }, { merge: true });
    }
  });
}

function assertNoBrowserControlledBillingFields(data: CheckoutInput) {
  if (data.priceId !== undefined || data.successUrl !== undefined || data.cancelUrl !== undefined) {
    throw new HttpsError('invalid-argument', 'Price IDs and redirect URLs are server-controlled.');
  }
  if (data.addons !== undefined) {
    const addons = data.addons;
    if (typeof addons !== 'object' || addons === null || Array.isArray(addons) ||
        Object.keys(addons).length !== 1 || (addons as { aiPack?: unknown }).aiPack !== true) {
      throw new HttpsError('invalid-argument', 'Invalid billing add-on selection.');
    }
  }
}

function assertFamilyUpgradeInput(value: unknown): 'month' | 'year' {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new HttpsError('invalid-argument', 'Family upgrade requires a logical plan and interval.');
  }
  const data = value as FamilyUpgradeInput;
  if (data.plan !== 'family' || (data.interval !== 'month' && data.interval !== 'year')) {
    throw new HttpsError('invalid-argument', 'Family upgrade requires family with a monthly or yearly interval.');
  }
  if (Object.keys(data).some((key) => key !== 'plan' && key !== 'interval')) {
    throw new HttpsError('invalid-argument', 'Family upgrade does not accept Stripe identifiers or add-on fields.');
  }
  return data.interval;
}

async function assertTrustedFamilyPrice(priceId: string, interval: 'month' | 'year'): Promise<void> {
  const price = await getStripe().prices.retrieve(priceId);
  const expectedAmount = interval === 'month' ? 999 : 9900;
  if (!price.active || price.currency !== 'usd' || price.unit_amount !== expectedAmount ||
      price.metadata?.kr_plan !== 'family' || price.recurring?.interval !== interval) {
    throw new HttpsError('failed-precondition', 'The configured Family price does not match the approved billing catalog.');
  }
}

function familyWorkspaceSeed(ownerUid: string, usage: any = {}) {
  return {
    ownerUid,
    createdAt: Date.now(),
    plan: {
      plan: 'family',
      status: 'none',
      seatLimit: 6,
      aiPackItemExists: false,
      aiPackStatus: 'none',
      aiPackPaidThrough: null,
      aiPackCancelAtPeriodEnd: false,
      aiPackScheduledRemovalAt: null,
      aiPackRemovalOperationId: null,
      aiPackRemovalRequestedAt: null,
      aiPackResumeOperationId: null,
      aiPackResumeRequestedAt: null,
      addons: { aiPack: false },
    },
    usage: {
      monthKey: typeof usage.monthKey === 'string' ? usage.monthKey : '',
      exportsUsed: Number(usage.exportsUsed || 0),
      aiActionsUsed: Number(usage.aiActionsUsed || 0),
      aiActionsAllowance: 600,
      storageUsedBytes: Number(usage.storageUsedBytes || 0),
    },
  };
}

async function prepareFamilyWorkspace(uid: string, userData: any): Promise<string> {
  const existingFamilyId = typeof userData.family?.familyId === 'string' && userData.family.familyId
    ? userData.family.familyId
    : null;
  const familyRef = db.collection('families').doc(existingFamilyId || undefined);
  const familySnap = await familyRef.get();
  if (familySnap.exists) {
    if (familySnap.data()?.ownerUid !== uid) {
      throw new HttpsError('permission-denied', 'Only the Family workspace owner can manage its subscription.');
    }
  } else {
    await familyRef.set(familyWorkspaceSeed(uid, userData.usage));
  }
  return familyRef.id;
}

export async function claimFamilyUpgrade(
  uid: string,
  stripeSubscriptionId: string,
  interval: 'month' | 'year',
  proposedFamilyId: string,
  proposedOperationId: string,
): Promise<FamilyUpgradeClaim> {
  const userRef = db.collection('users').doc(uid);
  const familyRef = db.collection('families').doc(proposedFamilyId);
  return db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) throw new HttpsError('not-found', 'User not found');
    const userData = userSnap.data() || {};
    const billing = userData.billing || {};
    assertBillingPaymentResolved(billing);
    if (billing.stripeSubscriptionId !== stripeSubscriptionId || billing.plan !== 'pro' ||
        !['active', 'trialing'].includes(billing.status) || Number(billing.currentPeriodEnd || 0) <= Date.now()) {
      throw new HttpsError('failed-precondition', 'Family upgrade requires an active Pro subscription.');
    }
    if (billing.cancelAtPeriodEnd === true || Number(billing.scheduledCancellationAt || 0) > 0) {
      throw new HttpsError('failed-precondition', 'Resume the base subscription before upgrading to Family.');
    }
    if (billing.planChangeStatus === 'pending' && billing.planChangeTarget === 'family' &&
        billing.planChangeInterval === interval && typeof billing.planChangeOperationId === 'string') {
      return {
        operationId: billing.planChangeOperationId,
        familyId: typeof billing.planChangeFamilyId === 'string' ? billing.planChangeFamilyId : proposedFamilyId,
        shouldUpdateSubscription: false,
      };
    }

    const linkedFamilyId = typeof userData.family?.familyId === 'string' && userData.family.familyId
      ? userData.family.familyId
      : null;
    if (linkedFamilyId && linkedFamilyId !== proposedFamilyId) {
      throw new HttpsError('failed-precondition', 'The Family workspace requires reconciliation before upgrading.');
    }
    const familySnap = await transaction.get(familyRef);
    assertBillingPaymentResolved(familySnap.data()?.plan);
    if (familySnap.exists && familySnap.data()?.ownerUid !== uid) {
      throw new HttpsError('permission-denied', 'Only the Family workspace owner can upgrade this subscription.');
    }
    if (!familySnap.exists) transaction.set(familyRef, familyWorkspaceSeed(uid, userData.usage));

    transaction.set(userRef, {
      billing: {
        ...billing,
        planChangeStatus: 'pending',
        planChangeTarget: 'family',
        planChangeInterval: interval,
        planChangeFamilyId: proposedFamilyId,
        planChangeOperationId: proposedOperationId,
        planChangeRequestedAt: Date.now(),
        planChangeFailure: null,
      },
    }, { merge: true });
    return {
      operationId: proposedOperationId,
      familyId: proposedFamilyId,
      shouldUpdateSubscription: true,
    };
  });
}

async function resolveCustomer(uid: string, userData: any, email: string | undefined): Promise<string> {
  const api = getStripe();
  let customerId = userData?.billing?.stripeCustomerId as string | undefined;
  if (customerId) {
    try {
      const customer = await api.customers.retrieve(customerId);
      if ((customer as any).deleted) customerId = undefined;
      else if ((customer as Stripe.Customer).metadata?.kr_uid && (customer as Stripe.Customer).metadata.kr_uid !== uid) {
        throw new HttpsError('failed-precondition', 'The stored Stripe customer belongs to another account.');
      } else if (!(customer as Stripe.Customer).metadata?.kr_uid && typeof api.customers.update === 'function') {
        await api.customers.update(customerId, { metadata: { kr_uid: uid } });
      }
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      if (error?.code === 'resource_missing' || error?.statusCode === 400 || error?.statusCode === 404) customerId = undefined;
      else throw new HttpsError('internal', 'Unable to verify the billing customer.');
    }
  }
  if (!customerId && email && typeof api.customers.list === 'function') {
    const matches = (await api.customers.list({ email, limit: 100 })).data
      .filter((customer) => customer.metadata?.kr_uid === uid);
    if (matches.length > 1) throw new HttpsError('failed-precondition', 'Multiple Stripe customers require manual reconciliation.');
    if (matches.length === 1) customerId = matches[0].id;
  }
  if (!customerId) {
    if (!email) throw new HttpsError('failed-precondition', 'An email address is required to initialize billing.');
    const created = await api.customers.create({ email, metadata: { kr_uid: uid } });
    customerId = created.id;
  }
  const profileRef = db.collection('users').doc(uid) as any;
  if (typeof profileRef.set === 'function') await profileRef.set({ billing: { stripeCustomerId: customerId } }, { merge: true });
  return customerId;
}

async function assertNoDuplicateSubscription(customerId: string, billing: any) {
  if (billing?.status && paidStatuses.has(billing.status)) {
    throw new HttpsError('already-exists', 'You already have an active subscription. Use the billing portal to manage it.');
  }
  const list = (getStripe() as any).subscriptions?.list;
  if (typeof list === 'function') {
    const subscriptions = await list.call((getStripe() as any).subscriptions, { customer: customerId, status: 'all', limit: 100 });
    for (const sub of subscriptions.data) assertBillingPaymentResolved({ plan: 'pro', status: sub.status });
    if (subscriptions.data.some((sub: { status: string }) => paidStatuses.has(sub.status))) {
      throw new HttpsError('already-exists', 'You already have an active subscription. Use the billing portal to manage it.');
    }
  }
}

export const createCheckoutSession = onCall({ region: 'us-central1', secrets: ['STRIPE_SECRET_KEY'] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in to subscribe');
  const data = (request.data || {}) as CheckoutInput;
  assertNoBrowserControlledBillingFields(data);
  const plan = data.plan;
  const interval = data.interval;
  if (plan !== 'pro' && plan !== 'family') throw new HttpsError('invalid-argument', 'Invalid plan');
  if (interval !== 'month' && interval !== 'year') throw new HttpsError('invalid-argument', 'Invalid interval');
  if (data.familyId !== undefined && typeof data.familyId !== 'string') throw new HttpsError('invalid-argument', 'Invalid family selection.');
  const aiPack = (data.addons as { aiPack?: unknown } | undefined)?.aiPack === true;
  const uid = request.auth.uid;
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.exists ? userSnap.data() || {} : {};
  await assertAccountBillingPaymentResolved(userData);
  const customerId = await resolveCustomer(uid, userData, request.auth.token?.email);
  await assertNoDuplicateSubscription(customerId, userData.billing);
  const planPrice = resolvePlanPrice(functionsEnv.prices, plan, interval);
  if (!planPrice) throw new HttpsError('failed-precondition', `Price not configured for ${plan}/${interval}.`);
  if (plan === 'family') await assertTrustedFamilyPrice(planPrice, interval);

  let familyId: string | undefined;
  if (plan === 'family') {
    if (data.familyId !== undefined) {
      throw new HttpsError('invalid-argument', 'Family workspace selection is server-controlled.');
    }
    familyId = await prepareFamilyWorkspace(uid, userData);
    await getStripe().customers.update(customerId, { metadata: { kr_uid: uid, kr_family_id: familyId } });
  }
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [{ price: planPrice, quantity: 1 }];
  if (aiPack) {
    if (!functionsEnv.prices.ai_pack_monthly) throw new HttpsError('failed-precondition', 'AI Pack price not configured.');
    lineItems.push({ price: functionsEnv.prices.ai_pack_monthly, quantity: 1 });
  }
  const metadata = { kr_uid: uid, kr_plan: plan, kr_interval: interval, kr_price_id: planPrice, ...(familyId ? { kr_family_id: familyId } : {}) };
  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    client_reference_id: uid,
    mode: 'subscription',
    line_items: lineItems,
    success_url: `${functionsEnv.appUrl}/dashboard?checkout=success`,
    cancel_url: `${functionsEnv.appUrl}/pricing?checkout=canceled`,
    metadata,
    subscription_data: { metadata },
  });
  functions.logger.info(`Created checkout session ${session.id} for authenticated account ${uid}`);
  return { sessionId: session.id, url: session.url };
});

export const upgradeToFamily = onCall({ region: 'us-central1', secrets: ['STRIPE_SECRET_KEY'] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in to upgrade.');
  const interval = assertFamilyUpgradeInput(request.data);
  const uid = request.auth.uid;
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'User not found');
  const userData = userSnap.data() || {};
  await assertAccountBillingPaymentResolved(userData);
  const billing = userData.billing || {};
  const subscriptionId = typeof billing.stripeSubscriptionId === 'string' ? billing.stripeSubscriptionId : '';
  const customerId = typeof billing.stripeCustomerId === 'string' ? billing.stripeCustomerId : '';
  if (!subscriptionId || !customerId || billing.plan !== 'pro' ||
      !['active', 'trialing'].includes(billing.status) || Number(billing.currentPeriodEnd || 0) <= Date.now()) {
    throw new HttpsError('failed-precondition', 'Family upgrade requires an active Pro subscription.');
  }
  if (billing.cancelAtPeriodEnd === true || Number(billing.scheduledCancellationAt || 0) > 0) {
    throw new HttpsError('failed-precondition', 'Resume the base subscription before upgrading to Family.');
  }

  const familyPriceId = resolvePlanPrice(functionsEnv.prices, 'family', interval);
  const currentProPriceId = resolvePlanPrice(functionsEnv.prices, 'pro', billing.interval);
  if (!familyPriceId || !currentProPriceId) {
    throw new HttpsError('failed-precondition', 'The requested billing interval is not configured.');
  }
  const api = getStripe();
  const [subscription, customer] = await Promise.all([
    api.subscriptions.retrieve(subscriptionId),
    api.customers.retrieve(customerId),
    assertTrustedFamilyPrice(familyPriceId, interval),
  ]).then(([resolvedSubscription, resolvedCustomer]) => [resolvedSubscription, resolvedCustomer] as const);
  const subscriptionCustomerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;
  if (subscriptionCustomerId !== customerId || (customer as Stripe.DeletedCustomer).deleted === true ||
      (customer as Stripe.Customer).metadata?.kr_uid !== uid) {
    throw new HttpsError('permission-denied', 'The Stripe subscription does not belong to this billing account.');
  }
  assertBillingPaymentResolved({ plan: billing.plan, status: subscription.status, stripeScheduleId: subscription.schedule });
  if (!['active', 'trialing'].includes(subscription.status)) {
    throw new HttpsError('failed-precondition', 'The Pro subscription is not eligible for an upgrade.');
  }
  const planItems = metadataPlanItems(subscription);
  if (planItems.length !== 1 || planItems[0].price.metadata?.kr_plan !== 'pro' ||
      planItems[0].price.id !== currentProPriceId) {
    throw new HttpsError('failed-precondition', 'The base subscription requires billing reconciliation before upgrading.');
  }
  const aiPackItems = metadataAIPackItems(subscription);
  if (aiPackItems.length > 1 || (aiPackItems.length === 0 && subscription.items.data.some(({ price }) =>
    price.id === functionsEnv.prices.ai_pack_monthly))) {
    throw new HttpsError('failed-precondition', 'The AI Pack subscription requires billing reconciliation before upgrading.');
  }
  if (hasPaidAIPackEntitlement(billing) && billing.aiPackItemExists === true && aiPackItems.length !== 1) {
    throw new HttpsError('failed-precondition', 'The paid AI Pack requires billing reconciliation before upgrading.');
  }

  const pendingPlanItems = pendingMetadataPlanItems(subscription);
  if (pendingPlanItems.length > 0) {
    if (pendingPlanItems.length === 1 && pendingPlanItems[0].price.id === familyPriceId) {
      if (billing.planChangeStatus === 'failed') {
        return { success: false, status: 'payment_failed', alreadyPending: true };
      }
      return { success: true, status: 'pending', alreadyPending: true };
    }
    throw new HttpsError('failed-precondition', 'A different Stripe subscription update is already pending.');
  }

  const proposedFamilyId = typeof userData.family?.familyId === 'string' && userData.family.familyId
    ? userData.family.familyId
    : db.collection('families').doc().id;
  const claim = await claimFamilyUpgrade(uid, subscriptionId, interval, proposedFamilyId, randomUUID());
  if (!claim.shouldUpdateSubscription) {
    return { success: true, status: 'pending', alreadyPending: true };
  }

  try {
    const customerMetadata = (customer as Stripe.Customer).metadata || {};
    await api.customers.update(customerId, {
      metadata: { ...customerMetadata, kr_uid: uid, kr_family_id: claim.familyId },
    });
    await api.subscriptions.update(subscriptionId, {
      items: [{ id: planItems[0].id, price: familyPriceId, quantity: planItems[0].quantity || 1 }],
      proration_behavior: 'always_invoice',
      payment_behavior: 'pending_if_incomplete',
    }, {
      idempotencyKey: `kr-family-upgrade:${subscriptionId}:${familyPriceId}:${claim.operationId}`,
    });
    functions.logger.info(`Family upgrade payment initiated for authenticated account ${uid}`);
    return { success: true, status: 'pending', alreadyPending: false };
  } catch (error: any) {
    if (error?.code === 'idempotency_key_in_use' || error?.type === 'StripeIdempotencyError') {
      return { success: true, status: 'pending', alreadyPending: true };
    }
    throw new HttpsError('unavailable', hasPaidAIPackEntitlement(billing)
      ? 'Family upgrade could not be completed. Your current Pro plan and AI Pack remain unchanged.'
      : 'Family upgrade could not be completed. Your current Pro plan remains unchanged.');
  }
});

export const createPortalSession = onCall({ region: 'us-central1', secrets: ['STRIPE_SECRET_KEY'] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in to manage billing.');
  const uid = request.auth.uid;
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'User profile not found.');
  const customerId = userSnap.data()?.billing?.stripeCustomerId;
  if (!customerId) throw new HttpsError('failed-precondition', 'No Stripe billing customer exists for this account.');
  try {
    const customer = await getStripe().customers.retrieve(customerId);
    if ((customer as any).deleted) throw new HttpsError('failed-precondition', 'The Stripe customer was deleted; contact support for reconciliation.');
    const ownerUid = (customer as Stripe.Customer).metadata?.kr_uid;
    if (ownerUid && ownerUid !== uid) throw new HttpsError('permission-denied', 'The Stripe customer does not belong to this account.');
    if (!ownerUid) await getStripe().customers.update(customerId, { metadata: { kr_uid: uid } });
  } catch (error: any) {
    if (error instanceof HttpsError) throw error;
    if (error?.code === 'resource_missing' || error?.statusCode === 404) throw new HttpsError('failed-precondition', 'The Stripe customer was deleted; contact support for reconciliation.');
    throw new HttpsError('internal', 'Unable to verify the billing customer.');
  }
  const session = await getStripe().billingPortal.sessions.create({ customer: customerId, return_url: `${functionsEnv.appUrl}/settings/billing` });
  functions.logger.info(`Created billing portal session for authenticated account ${uid}`);
  return { url: session.url };
});

export const addAIPack = onCall({ region: 'us-central1', secrets: ['STRIPE_SECRET_KEY'] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in');
  const uid = request.auth.uid;
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'User not found');
  const userData = userSnap.data() || {};
  await assertAccountBillingPaymentResolved(userData);
  const billing = userData.billing || {};
  if (!billing.stripeSubscriptionId || !['pro', 'family'].includes(billing.plan) || !['active', 'trialing'].includes(billing.status)) {
    throw new HttpsError('failed-precondition', 'AI Pack requires an active Pro or Family subscription');
  }
  if (!functionsEnv.prices.ai_pack_monthly) throw new HttpsError('failed-precondition', 'AI Pack price not configured');
  const api = getStripe();
  const subscription = await api.subscriptions.retrieve(billing.stripeSubscriptionId);
  assertBillingPaymentResolved({ plan: billing.plan, status: subscription.status, stripeScheduleId: subscription.schedule });
  if (!['active', 'trialing'].includes(subscription.status)) {
    throw new HttpsError('failed-precondition', 'AI Pack requires an active Pro or Family subscription');
  }
  const observedItemExists = hasAIPackItem(subscription);
  const claim = await claimAIPackOperation(uid, billing.stripeSubscriptionId, observedItemExists, randomUUID());
  if (claim.status === 'active') return { success: true, status: 'active', alreadyExists: true };
  if (!claim.shouldCreateItem || !claim.operationId) {
    return { success: true, status: 'pending', alreadyExists: claim.alreadyExists };
  }

  try {
    await api.subscriptionItems.create({
      subscription: billing.stripeSubscriptionId,
      price: functionsEnv.prices.ai_pack_monthly,
      quantity: 1,
      proration_behavior: 'always_invoice',
      payment_behavior: 'pending_if_incomplete',
    }, {
      idempotencyKey: `kr-ai-pack:${billing.stripeSubscriptionId}:${claim.operationId}`,
    });
    const refreshed = await api.subscriptions.retrieve(billing.stripeSubscriptionId);
    await recordAIPackItemObservation(uid, claim.operationId, hasAIPackItem(refreshed));
    functions.logger.info(`AI Pack payment initiated for authenticated account ${uid}`);
    return { success: true, status: 'pending', alreadyExists: false };
  } catch (error: any) {
    if (error?.code === 'idempotency_key_in_use' || error?.type === 'StripeIdempotencyError') {
      return { success: true, status: 'pending', alreadyExists: true };
    }
    throw new HttpsError('unavailable', 'AI Pack payment could not be initiated. Retry safely or use the billing portal.');
  }
});

export const removeAIPack = onCall({ region: 'us-central1', secrets: ['STRIPE_SECRET_KEY'] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in');
  const data = request.data === undefined ? {} : request.data;
  if (typeof data !== 'object' || data === null || Array.isArray(data) || Object.keys(data).length !== 0) {
    throw new HttpsError('invalid-argument', 'AI Pack removal does not accept Stripe identifiers or billing fields');
  }

  const uid = request.auth.uid;
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'User not found');
  const userData = userSnap.data() || {};
  await assertAccountBillingPaymentResolved(userData);
  const billing = userData.billing || {};
  const subscriptionId = typeof billing.stripeSubscriptionId === 'string' ? billing.stripeSubscriptionId : '';
  const customerId = typeof billing.stripeCustomerId === 'string' ? billing.stripeCustomerId : '';
  if (!subscriptionId || !customerId || !['pro', 'family'].includes(billing.plan) ||
      !['active', 'trialing'].includes(billing.status)) {
    throw new HttpsError('failed-precondition', 'AI Pack removal requires an active Pro or Family subscription');
  }

  const api = getStripe();
  const subscription = await api.subscriptions.retrieve(subscriptionId);
  assertBillingPaymentResolved({ plan: billing.plan, status: subscription.status, stripeScheduleId: subscription.schedule });
  const subscriptionCustomerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;
  if (subscriptionCustomerId !== customerId || !['active', 'trialing'].includes(subscription.status)) {
    throw new HttpsError('permission-denied', 'The Stripe subscription does not belong to this billing account');
  }
  const customer = await api.customers.retrieve(customerId);
  if ((customer as Stripe.DeletedCustomer).deleted === true ||
      (customer as Stripe.Customer).metadata?.kr_uid !== uid) {
    throw new HttpsError('permission-denied', 'The Stripe customer does not belong to this account');
  }
  const familyId = billing.plan === 'family' && typeof userData.family?.familyId === 'string'
    ? userData.family.familyId
    : null;
  if (billing.plan === 'family' && !familyId) {
    throw new HttpsError('failed-precondition', 'Family billing workspace requires reconciliation before removing AI Pack');
  }
  if (familyId && (customer as Stripe.Customer).metadata?.kr_family_id !== familyId) {
    throw new HttpsError('permission-denied', 'The Stripe customer does not belong to this Family workspace');
  }

  const planItems = metadataPlanItems(subscription);
  if (planItems.length !== 1 || planItems[0].price.metadata?.kr_plan !== billing.plan) {
    throw new HttpsError('failed-precondition', 'The base subscription requires billing reconciliation before removing AI Pack');
  }
  const aiPackItems = metadataAIPackItems(subscription);
  if (aiPackItems.length > 1) {
    throw new HttpsError('failed-precondition', 'Multiple AI Pack items require billing reconciliation');
  }
  if (aiPackItems.length === 0 && subscription.items.data.some(({ price }) =>
    price.id === functionsEnv.prices.ai_pack_monthly)) {
    throw new HttpsError('failed-precondition', 'AI Pack price metadata requires billing reconciliation');
  }

  const claim = await claimAIPackRemoval(
    uid,
    subscriptionId,
    aiPackItems.length === 1,
    randomUUID(),
  );
  if (claim.status === 'none') {
    return { success: true, status: 'none', alreadyRemoved: true, endsAt: null };
  }
  if (!claim.shouldDeleteItem || !claim.operationId || !claim.paidThrough) {
    return { success: true, status: 'scheduled', alreadyRemoved: true, endsAt: claim.paidThrough };
  }

  try {
    await api.subscriptionItems.del(aiPackItems[0].id, {
      proration_behavior: 'none',
    }, {
      idempotencyKey: `kr-ai-pack-remove:${subscriptionId}:${aiPackItems[0].id}:${claim.operationId}`,
    });
  } catch (error: any) {
    if (error?.code !== 'resource_missing' && error?.statusCode !== 404) {
      throw new HttpsError('unavailable', 'AI Pack removal could not be completed. Retry safely.');
    }
  }

  const endsAt = await finalizeAIPackRemoval(
    uid,
    subscriptionId,
    claim.operationId,
    claim.paidThrough,
    claim.familyId,
  );
  functions.logger.info(`AI Pack renewal removed for authenticated account ${uid}`);
  return { success: true, status: endsAt ? 'scheduled' : 'none', alreadyRemoved: false, endsAt };
});

export const resumeAIPack = onCall({ region: 'us-central1', secrets: ['STRIPE_SECRET_KEY'] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in');
  const data = request.data === undefined ? {} : request.data;
  if (typeof data !== 'object' || data === null || Array.isArray(data) || Object.keys(data).length !== 0) {
    throw new HttpsError('invalid-argument', 'AI Pack renewal does not accept Stripe identifiers or billing fields');
  }

  const uid = request.auth.uid;
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'User not found');
  const userData = userSnap.data() || {};
  await assertAccountBillingPaymentResolved(userData);
  const billing = userData.billing || {};
  const subscriptionId = typeof billing.stripeSubscriptionId === 'string' ? billing.stripeSubscriptionId : '';
  const customerId = typeof billing.stripeCustomerId === 'string' ? billing.stripeCustomerId : '';
  if (!subscriptionId || !customerId || !['pro', 'family'].includes(billing.plan) ||
      !['active', 'trialing'].includes(billing.status)) {
    throw new HttpsError('failed-precondition', 'AI Pack renewal requires an active Pro or Family subscription');
  }
  if (!functionsEnv.prices.ai_pack_monthly) {
    throw new HttpsError('failed-precondition', 'AI Pack price not configured');
  }

  const api = getStripe();
  const [subscription, customer, aiPackPrice] = await Promise.all([
    api.subscriptions.retrieve(subscriptionId),
    api.customers.retrieve(customerId),
    api.prices.retrieve(functionsEnv.prices.ai_pack_monthly),
  ]);
  const subscriptionCustomerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;
  assertBillingPaymentResolved({ plan: billing.plan, status: subscription.status, stripeScheduleId: subscription.schedule });
  if (subscriptionCustomerId !== customerId || !['active', 'trialing'].includes(subscription.status)) {
    throw new HttpsError('permission-denied', 'The Stripe subscription does not belong to this billing account');
  }
  if ((customer as Stripe.DeletedCustomer).deleted === true ||
      (customer as Stripe.Customer).metadata?.kr_uid !== uid) {
    throw new HttpsError('permission-denied', 'The Stripe customer does not belong to this account');
  }
  if (aiPackPrice.metadata?.kr_addon !== 'ai_pack') {
    throw new HttpsError('failed-precondition', 'AI Pack price metadata requires billing reconciliation');
  }
  const familyId = billing.plan === 'family' && typeof userData.family?.familyId === 'string'
    ? userData.family.familyId
    : null;
  if (billing.plan === 'family' && !familyId) {
    throw new HttpsError('failed-precondition', 'Family billing workspace requires reconciliation before resuming AI Pack renewal');
  }
  if (familyId && (customer as Stripe.Customer).metadata?.kr_family_id !== familyId) {
    throw new HttpsError('permission-denied', 'The Stripe customer does not belong to this Family workspace');
  }

  const planItems = metadataPlanItems(subscription);
  if (planItems.length !== 1 || planItems[0].price.metadata?.kr_plan !== billing.plan) {
    throw new HttpsError('failed-precondition', 'The base subscription requires billing reconciliation before resuming AI Pack renewal');
  }
  const aiPackItems = metadataAIPackItems(subscription);
  if (aiPackItems.length > 1) {
    throw new HttpsError('failed-precondition', 'Multiple AI Pack items require billing reconciliation');
  }
  if (aiPackItems.length === 0 && subscription.items.data.some(({ price }) =>
    price.id === functionsEnv.prices.ai_pack_monthly)) {
    throw new HttpsError('failed-precondition', 'AI Pack price metadata requires billing reconciliation');
  }

  const claim = await claimAIPackResume(
    uid,
    subscriptionId,
    aiPackItems.length === 1,
    randomUUID(),
  );
  if (!claim.shouldCreateItem || !claim.operationId) {
    return { success: true, status: 'renewing', alreadyRenewing: true, paidThrough: claim.paidThrough };
  }

  try {
    await api.subscriptionItems.create({
      subscription: subscriptionId,
      price: functionsEnv.prices.ai_pack_monthly,
      quantity: 1,
      proration_behavior: 'none',
    }, {
      idempotencyKey: `kr-ai-pack-resume:${subscriptionId}:${claim.paidThrough}:${claim.operationId}`,
    });
    const refreshed = await api.subscriptions.retrieve(subscriptionId);
    const refreshedAIPackItems = metadataAIPackItems(refreshed);
    if (refreshedAIPackItems.length !== 1) {
      throw new Error('Stripe did not return exactly one trusted AI Pack item after renewal resumed');
    }
    await finalizeAIPackResume(uid, subscriptionId, claim.operationId, claim.paidThrough, claim.familyId);
    functions.logger.info(`AI Pack renewal resumed for authenticated account ${uid}`);
    return { success: true, status: 'renewing', alreadyRenewing: false, paidThrough: claim.paidThrough };
  } catch (error: any) {
    if (error?.code === 'idempotency_key_in_use' || error?.type === 'StripeIdempotencyError') {
      return { success: true, status: 'resuming', alreadyRenewing: false, paidThrough: claim.paidThrough };
    }
    throw new HttpsError('unavailable', 'AI Pack renewal could not be resumed. Your paid access remains active; retry safely.');
  }
});
