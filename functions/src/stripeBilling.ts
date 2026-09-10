import { functionsEnv } from './config';
import { resolvePlanPrice } from './billingCatalog';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as functions from 'firebase-functions/v2';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';

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
  addons?: { aiPack?: unknown };
  priceId?: unknown;
  successUrl?: unknown;
  cancelUrl?: unknown;
  familyId?: unknown;
};

const paidStatuses = new Set(['active', 'trialing', 'past_due', 'unpaid', 'incomplete']);

function assertNoBrowserControlledBillingFields(data: CheckoutInput) {
  if (data.priceId !== undefined || data.successUrl !== undefined || data.cancelUrl !== undefined) {
    throw new HttpsError('invalid-argument', 'Price IDs and redirect URLs are server-controlled.');
  }
  if (data.addons !== undefined && (typeof data.addons !== 'object' || data.addons === null ||
      (data.addons.aiPack !== undefined && typeof data.addons.aiPack !== 'boolean'))) {
    throw new HttpsError('invalid-argument', 'Invalid billing add-on selection.');
  }
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
  const aiPack = data.addons?.aiPack === true;
  const uid = request.auth.uid;
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.exists ? userSnap.data() || {} : {};
  const customerId = await resolveCustomer(uid, userData, request.auth.token?.email);
  await assertNoDuplicateSubscription(customerId, userData.billing);
  const planPrice = resolvePlanPrice(functionsEnv.prices, plan, interval);
  if (!planPrice) throw new HttpsError('failed-precondition', `Price not configured for ${plan}/${interval}.`);

  let familyId: string | undefined;
  if (plan === 'family') {
    const existingFamilyId = userData.family?.familyId as string | undefined;
    if (data.familyId !== undefined && data.familyId !== existingFamilyId) {
      throw new HttpsError('permission-denied', 'The selected family is not owned by this account.');
    }
    familyId = existingFamilyId;
    if (familyId) {
      const familySnap = await db.collection('families').doc(familyId).get();
      if (familySnap.exists && familySnap.data()?.ownerUid !== uid) throw new HttpsError('permission-denied', 'Only the family owner can subscribe.');
    } else {
      const familyRef = db.collection('families').doc();
      familyId = familyRef.id;
      await familyRef.set({ ownerUid: uid, createdAt: Date.now(), plan: { status: 'none', seatLimit: 6, addons: { aiPack: false } }, usage: { monthKey: '', exportsUsed: 0, aiActionsUsed: 0, aiActionsAllowance: 600, storageUsedBytes: 0 } });
      await userRef.set({ family: { familyId, role: 'owner', joinedAt: Date.now() } }, { merge: true });
      await getStripe().customers.update(customerId, { metadata: { kr_uid: uid, kr_family_id: familyId } });
    }
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
  const billing = userSnap.data()?.billing || {};
  if (!billing.stripeSubscriptionId || !['pro', 'family'].includes(billing.plan) || !['active', 'trialing'].includes(billing.status)) {
    throw new HttpsError('failed-precondition', 'AI Pack requires an active Pro or Family subscription');
  }
  if (billing.addons?.aiPack) throw new HttpsError('already-exists', 'You already have AI Pack');
  if (!functionsEnv.prices.ai_pack_monthly) throw new HttpsError('failed-precondition', 'AI Pack price not configured');
  await getStripe().subscriptionItems.create({ subscription: billing.stripeSubscriptionId, price: functionsEnv.prices.ai_pack_monthly, quantity: 1 });
  functions.logger.info(`Added AI Pack subscription item for authenticated account ${uid}`);
  return { success: true };
});
