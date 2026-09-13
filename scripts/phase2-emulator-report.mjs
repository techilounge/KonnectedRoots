import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseEnvFile } from './phase2-pastdue-test-clock.mjs';
import { renewalPaymentState } from './phase2-family-downgrade-test-clock.mjs';

const PROJECT_ID = 'demo-konnectedroots-phase2';
const TEST_EMAIL = process.env.PHASE2_TEST_EMAIL || 'phase2-billing@example.test';

function assertLocalEmulators() {
  const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (projectId !== PROJECT_ID ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' ||
      process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') {
    throw new Error(`Refusing to report: set the exact local emulator hosts and GCLOUD_PROJECT=${PROJECT_ID}.`);
  }
}

function statusCounts(snapshot) {
  return snapshot.docs.reduce((counts, document) => {
    const status = String(document.data().status || 'unknown');
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
}

assertLocalEmulators();
const app = getApps().find(candidate => candidate.name === 'phase2-billing-report') ||
  initializeApp({projectId: PROJECT_ID}, 'phase2-billing-report');
const auth = getAuth(app);
const db = getFirestore(app);
const account = await auth.getUserByEmail(TEST_EMAIL);
const userSnapshot = await db.collection('users').doc(account.uid).get();
if (!userSnapshot.exists) throw new Error('Disposable billing user profile was not found in the Firestore Emulator.');

const user = userSnapshot.data() || {};
const billing = user.billing || {};
const familyId = typeof user.family?.familyId === 'string' && user.family.familyId
  ? user.family.familyId
  : typeof billing.planChangeFamilyId === 'string' && billing.planChangeFamilyId
    ? billing.planChangeFamilyId
    : null;
const familyRef = familyId ? db.collection('families').doc(familyId) : null;
const [billingEvents, aiPackGrants, familySnapshot, familySeats] = await Promise.all([
  db.collection('billing_events').get(),
  db.collection('ai_pack_grants').where('uid', '==', account.uid).get(),
  familyRef ? familyRef.get() : Promise.resolve(null),
  familyRef ? familyRef.collection('seats').get() : Promise.resolve(null),
]);
const family = familySnapshot?.exists ? familySnapshot.data() || {} : null;
const familyPlan = family?.plan || {};
let now = Date.now(), renewalEvidence = null;
// Explicit local report: GET-only Stripe evidence; missing/invalid sandbox
// evidence fails the report instead of claiming a wall-time Pack entitlement.
if (billing.stripeCustomerId && billing.stripeSubscriptionId) {
  const secretVars = parseEnvFile(fs.readFileSync(path.join(process.cwd(), 'functions/.secret.local'), 'utf8'));
  const secret = process.env.STRIPE_SECRET_KEY || secretVars.STRIPE_SECRET_KEY;
  if (!secret?.startsWith('sk_test_')) throw new Error('Local report requires sandbox configuration.');
  const Stripe = createRequire(import.meta.url)('../functions/node_modules/stripe');
  const stripe = new Stripe(secret);
  const customer = await stripe.customers.retrieve(billing.stripeCustomerId);
  if (customer.deleted || customer.livemode !== false || customer.metadata.kr_uid !== account.uid) throw new Error('Local report customer ownership mismatch.');
  if (customer.test_clock) {
    if (!['phase2_family_downgrade', 'phase2_pastdue_test_clock'].includes(customer.metadata.kr_test_scenario)) throw new Error('Local report clock scope mismatch.');
    const clockId = typeof customer.test_clock === 'string' ? customer.test_clock : customer.test_clock.id;
    const clock = await stripe.testHelpers.testClocks.retrieve(clockId);
    if (clock.id !== clockId || clock.livemode !== false || !Number.isSafeInteger(clock.frozen_time) || clock.frozen_time <= 0) throw new Error('Local report clock evidence invalid.');
    now = clock.frozen_time * 1000;
    const subscription = await stripe.subscriptions.retrieve(billing.stripeSubscriptionId);
    if (subscription.livemode !== false || (typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id) !== customer.id || subscription.metadata.kr_uid !== account.uid) throw new Error('Local report subscription ownership mismatch.');
    const invoices = await stripe.invoices.list({customer:customer.id,subscription:subscription.id,limit:100});
    if (invoices.has_more) throw new Error('Local report invoice listing incomplete.');
    const vars = parseEnvFile(fs.readFileSync(path.join(process.cwd(), 'functions/.env.local'), 'utf8'));
    renewalEvidence = renewalPaymentState({subscription,billing,invoices:invoices.data,now,packPrice:process.env.STRIPE_PRICE_AI_PACK || vars.STRIPE_PRICE_AI_PACK});
  }
}
const accessEnd = value => {
  const periodEnd = Number(value?.currentPeriodEnd || 0);
  const scheduled = Number(value?.scheduledCancellationAt || 0);
  return scheduled > 0 ? Math.min(periodEnd, scheduled) : periodEnd;
};
const isPaid = value => ['active', 'trialing'].includes(value?.status) && accessEnd(value) > now;
const ownerSnapshot = family?.ownerUid
  ? await db.collection('users').doc(family.ownerUid).get()
  : null;
const ownerBilling = family?.ownerUid === account.uid
  ? billing
  : ownerSnapshot?.exists ? ownerSnapshot.data()?.billing || {} : null;
const hasCanonicalFamilyPlan = familyPlan.plan === 'family' && ownerBilling?.plan === 'family';
const ownerBillingMatchesFamily = Boolean(
  hasCanonicalFamilyPlan &&
  ownerBilling &&
  ownerBilling.plan === 'family' &&
  isPaid(ownerBilling) &&
  ownerBilling.stripeSubscriptionId &&
  ownerBilling.stripeCustomerId &&
  ownerBilling.stripeSubscriptionId === familyPlan.stripeSubscriptionId &&
  ownerBilling.stripeCustomerId === familyPlan.stripeCustomerId
);
const familyPaid = hasCanonicalFamilyPlan && isPaid(familyPlan) && ownerBillingMatchesFamily;
const userPlan = ['pro', 'family'].includes(billing.plan) && isPaid(billing) ? billing.plan : 'free';
const canonicalPlan = hasCanonicalFamilyPlan ? 'family' : billing.plan || 'free';
const canonicalStatus = hasCanonicalFamilyPlan ? familyPlan.status || 'none' : billing.status || 'none';
const effectivePlan = hasCanonicalFamilyPlan ? (familyPaid ? 'family' : 'free') : userPlan;
const billingAuthority = familyPaid
  ? ownerBilling
  : billing;
const hasAIPack = effectivePlan !== 'free' &&
  billingAuthority.aiPackStatus === 'active' &&
  billingAuthority.addons?.aiPack === true &&
  Number(billingAuthority.aiPackPaidThrough || 0) > now &&
  (billingAuthority.aiPackItemExists === true || (
    billingAuthority.aiPackCancelAtPeriodEnd === true &&
    Number(billingAuthority.aiPackScheduledRemovalAt || 0) === Number(billingAuthority.aiPackPaidThrough || 0)
  ));
const baseAllowance = {free: 10, pro: 200, family: 600}[effectivePlan];
const effectiveAIAllowance = baseAllowance + (hasAIPack ? 1000 : 0);
const effectiveUsage = familyPaid ? family?.usage || {} : user.usage || {};
const collaboratorLimit = {free: 2, pro: 10, family: 20}[effectivePlan];
const storageEntitlementBytes = {free: 1, pro: 50, family: 100}[effectivePlan] * 1024 * 1024 * 1024;
const effectivePaidEntitlement = effectivePlan !== 'free';
const paymentAttentionRequired = canonicalPlan !== 'free' &&
  ['past_due', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'].includes(canonicalStatus);
const entitlementReason = effectivePaidEntitlement
  ? canonicalStatus === 'trialing' ? 'trialing' : 'active'
  : canonicalStatus === 'past_due' ? 'past_due'
    : canonicalStatus === 'incomplete_expired' ? 'subscription_expired'
      : paymentAttentionRequired ? 'payment_required'
        : canonicalStatus === 'canceled' ? 'subscription_canceled'
          : canonicalPlan === 'free' ? 'free_plan' : 'paid_entitlement_unavailable';
const canonicalBilling = familyPaid ? ownerBilling : billing;

console.log(JSON.stringify({
  renewalEvidence,
  billingEvaluationTime:now,
  uid: account.uid,
  email: TEST_EMAIL,
  plan: canonicalPlan,
  status: canonicalStatus,
  interval: canonicalBilling.interval ?? familyPlan.interval ?? billing.interval ?? null,
  cancelAtPeriodEnd: Boolean(canonicalBilling.cancelAtPeriodEnd ?? familyPlan.cancelAtPeriodEnd),
  scheduledCancellationAt: Number(canonicalBilling.scheduledCancellationAt || familyPlan.scheduledCancellationAt || 0) || null,
  currentPeriodEnd: Number(canonicalBilling.currentPeriodEnd || familyPlan.currentPeriodEnd || 0),
  stripeCustomerId: (canonicalBilling.stripeCustomerId || familyPlan.stripeCustomerId || null),
  stripeSubscriptionId: (canonicalBilling.stripeSubscriptionId || familyPlan.stripeSubscriptionId || null),
  aiPack: Boolean(canonicalBilling.addons?.aiPack),
  aiPackItemExists: Boolean(canonicalBilling.aiPackItemExists),
  aiPackStatus: canonicalBilling.aiPackStatus || 'none',
  aiPackPaidThrough: Number(canonicalBilling.aiPackPaidThrough || 0) || null,
  aiPackRecurringItemExists:renewalEvidence?.aiPackRecurringItemExists ?? Boolean(canonicalBilling.aiPackItemExists),
  aiPackCurrentPaidThroughValid:hasAIPack,
  aiPackRenewalPaymentPending:renewalEvidence?.aiPackRenewalPaymentPending ?? false,
  aiPackCancelAtPeriodEnd: Boolean(canonicalBilling.aiPackCancelAtPeriodEnd),
  aiPackScheduledRemovalAt: Number(canonicalBilling.aiPackScheduledRemovalAt || 0) || null,
  aiPackRemovalPending: Boolean(canonicalBilling.aiPackRemovalOperationId),
  aiPackResumePending: Boolean(canonicalBilling.aiPackResumeOperationId),
  planChange: {
    status: billing.planChangeStatus || 'none',
    target: billing.planChangeTarget || null,
    interval: billing.planChangeInterval || null,
    familyId: billing.planChangeFamilyId || null,
    failure: billing.planChangeFailure || null,
  },
  scheduledDowngrade: {
    plan: canonicalBilling.scheduledPlan || null,
    interval: canonicalBilling.scheduledInterval || null,
    effectiveAt: Number(canonicalBilling.scheduledChangeAt || 0) || null,
    status: canonicalBilling.scheduledChangeStatus || null,
  },
  latestStripeEventCreated: Number(billing.latestStripeEventCreated || 0),
  rawUserUsage: {
    monthKey: user.usage?.monthKey || '',
    exportsUsed: Number(user.usage?.exportsUsed || 0),
    aiActionsUsed: Number(user.usage?.aiActionsUsed || 0),
    aiActionsAllowance: Number(user.usage?.aiActionsAllowance || 0),
    storageUsedBytes: Number(user.usage?.storageUsedBytes || 0),
  },
  authoritativeEntitlements: {
    currentPlan: effectivePlan,
    canonicalPlan,
    canonicalStatus,
    effectivePaidEntitlement,
    paymentAttentionRequired,
    entitlementReason,
    aiPackEntitlementValid: hasAIPack,
    effectiveAIAllowance,
    aiActionsUsed: Number(effectiveUsage.aiActionsUsed || 0),
    aiActionsRemaining: Math.max(0, effectiveAIAllowance - Number(effectiveUsage.aiActionsUsed || 0)),
    allowanceOwnership: familyPaid ? 'family-pooled' : 'user-owned',
    collaboratorLimitPerTree: collaboratorLimit,
    storageEntitlementBytes,
    storageEntitlementGiB: storageEntitlementBytes / (1024 * 1024 * 1024),
  },
  familyWorkspace: {
    id: familyId,
    exists: Boolean(family),
    preserved: Boolean(family),
    ownerUid: family?.ownerUid || null,
    currentUserIsOwner: family?.ownerUid === account.uid,
    linkedToUser: user.family?.familyId === familyId,
    aiPackDerivedFromOwnerBilling: ownerBillingMatchesFamily,
    plan: familyPlan.plan || null,
    status: familyPlan.status || 'none',
    seatCount: familySeats?.size || 0,
    activeSeatCount: familySeats?.docs.filter(document => document.data().status === 'active').length || 0,
    seatLimit: Number(familyPlan.seatLimit ?? 6),
    paidSeatEntitlementActive: familyPaid,
    entitledSeatCount: familyPaid ? familySeats?.docs.filter(document => document.data().status === 'active').length || 0 : 0,
    collaboratorLimitPerTree: collaboratorLimit,
    seatsAreSeparateFromTreeCollaborators: true,
    usage: family ? {
      monthKey: family.usage?.monthKey || '',
      exportsUsed: Number(family.usage?.exportsUsed || 0),
      aiActionsUsed: Number(family.usage?.aiActionsUsed || 0),
      storedAIAllowance: Number(family.usage?.aiActionsAllowance || 0),
      storageUsedBytes: Number(family.usage?.storageUsedBytes || 0),
    } : null,
  },
  billingEvents: {
    count: billingEvents.size,
    statuses: statusCounts(billingEvents),
  },
  aiPackGrants: {count: aiPackGrants.size},
}, null, 2));
