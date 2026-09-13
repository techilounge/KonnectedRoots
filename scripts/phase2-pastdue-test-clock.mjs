import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {getApps, initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';

const require = createRequire(import.meta.url);
const Stripe = require('../functions/node_modules/stripe');

export const PROJECT_ID = 'demo-konnectedroots-phase2';
export const SCENARIO = 'phase2_pastdue_test_clock';
export const FAILING_PAYMENT_METHOD = 'pm_card_chargeCustomerFail';
export const SUCCESS_PAYMENT_METHOD = 'pm_card_visa';
export const FAILURE_MARKER = 'charge_customer_fail';
export const SUCCESS_MARKER = 'success_visa';
export const ACTIONS = Object.freeze([
  'create',
  'set-failing-method',
  'advance-renewal',
  'advance-collection',
  'set-success-method',
  'retry-invoice',
  'status',
]);

const PROTECTED_EMAILS = new Set([
  'phase2-billing@example.test',
  'phase2-payment-failure@example.test',
]);
const REQUIRED_IDS = {
  'set-failing-method': ['clock', 'customer', 'subscription'],
  'advance-renewal': ['clock', 'customer', 'subscription'],
  'advance-collection': ['clock', 'customer', 'subscription', 'invoice'],
  'set-success-method': ['clock', 'customer', 'subscription'],
  'retry-invoice': ['clock', 'customer', 'subscription', 'invoice'],
  status: ['clock', 'customer', 'subscription'],
};
const ID_PREFIXES = {
  clock: 'clock_',
  customer: 'cus_',
  subscription: 'sub_',
  invoice: 'in_',
};

export function parseArgs(argv) {
  const [action, ...rest] = argv;
  if (!ACTIONS.includes(action)) {
    throw new Error(`Action is required and must be one of: ${ACTIONS.join(', ')}.`);
  }

  const values = {action};
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (!flag?.startsWith('--') || !value || value.startsWith('--')) {
      throw new Error(`Expected --name value arguments after ${action}.`);
    }
    const name = flag.slice(2);
    if (!['email', 'clock', 'customer', 'subscription', 'invoice'].includes(name)) {
      throw new Error(`Unsupported argument: ${flag}.`);
    }
    if (values[name]) throw new Error(`Duplicate argument: ${flag}.`);
    values[name] = value;
  }

  if (!values.email) throw new Error('--email is required for every action.');
  assertDisposableEmail(values.email);
  for (const name of REQUIRED_IDS[action] || []) {
    if (!values[name]) throw new Error(`--${name} is required for ${action}.`);
    assertStripeId(name, values[name]);
  }
  if (values.invoice) assertStripeId('invoice', values.invoice);
  if (action === 'create' && ['clock', 'customer', 'subscription', 'invoice'].some(name => values[name])) {
    throw new Error('create accepts only --email; Stripe IDs are produced by that action.');
  }
  return values;
}

export function assertDisposableEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (PROTECTED_EMAILS.has(email)) {
    throw new Error(`Refusing protected Phase 2 test account: ${email}.`);
  }
  if (!/^phase2-pastdue(?:[+.-][a-z0-9-]+)?@example\.test$/.test(email)) {
    throw new Error('Use an explicit disposable phase2-pastdue account under example.test.');
  }
  return email;
}

export function assertLocalEnvironment(env = process.env) {
  const projectId = env.GCLOUD_PROJECT || env.GOOGLE_CLOUD_PROJECT;
  if (projectId !== PROJECT_ID ||
      env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' ||
      env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') {
    throw new Error(`Refusing to run: use only the exact local Auth/Firestore emulators and ${PROJECT_ID}.`);
  }
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to run with NODE_ENV=production.');
  }
}

export function assertTestSecret(secret) {
  if (typeof secret !== 'string' || !secret.startsWith('sk_test_')) {
    throw new Error('A Stripe test/sandbox secret key beginning with sk_test_ is required.');
  }
  return secret;
}

function assertStripeId(name, value) {
  if (typeof value !== 'string' || !value.startsWith(ID_PREFIXES[name])) {
    throw new Error(`Invalid Stripe ${name} ID.`);
  }
}

export function parseEnvFile(contents) {
  const entries = {};
  for (const rawLine of String(contents || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equals = line.indexOf('=');
    if (equals <= 0) continue;
    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    entries[key] = value;
  }
  return entries;
}

function readLocalEnv(file) {
  return fs.existsSync(file) ? parseEnvFile(fs.readFileSync(file, 'utf8')) : {};
}

function loadConfiguration(repoRoot, env = process.env) {
  const functionEnv = readLocalEnv(path.join(repoRoot, 'functions', '.env.local'));
  const localSecrets = readLocalEnv(path.join(repoRoot, 'functions', '.secret.local'));
  const explicitKey = env.STRIPE_API_KEY || env.STRIPE_SECRET_KEY;
  const secret = assertTestSecret(explicitKey || localSecrets.STRIPE_SECRET_KEY);
  const proMonthlyPriceId = env.STRIPE_PRICE_PRO_MONTHLY || functionEnv.STRIPE_PRICE_PRO_MONTHLY;
  if (!proMonthlyPriceId?.startsWith('price_')) {
    throw new Error('STRIPE_PRICE_PRO_MONTHLY is missing from the environment or functions/.env.local.');
  }
  return {secret, proMonthlyPriceId};
}

export function validateProMonthlyPrice(price, configuredPriceId) {
  const failures = [];
  if (!price || price.id !== configuredPriceId) failures.push('configured ID mismatch');
  if (price?.livemode !== false) failures.push('price is not test mode');
  if (price?.active !== true) failures.push('price is inactive');
  if (price?.currency !== 'usd') failures.push('currency is not usd');
  if (price?.unit_amount !== 599) failures.push('amount is not 599 cents');
  if (price?.recurring?.interval !== 'month') failures.push('interval is not monthly');
  if (price?.metadata?.kr_plan !== 'pro') failures.push('kr_plan is not pro');
  if (failures.length) {
    throw new Error(`Configured Pro monthly price failed validation: ${failures.join(', ')}.`);
  }
  return price;
}

function objectId(value) {
  return typeof value === 'string' ? value : value?.id || null;
}

export function subscriptionPeriodEnd(subscription) {
  const planItems = subscription?.items?.data?.filter(item => item?.price?.metadata?.kr_plan === 'pro') || [];
  if (planItems.length !== 1) throw new Error('Expected exactly one metadata-tagged Pro subscription item.');
  const current = Number(planItems[0].current_period_end || 0);
  const legacy = Number(subscription.current_period_end || 0);
  const value = current > 0 ? current : legacy;
  if (!Number.isInteger(value) || value <= 0) throw new Error('Subscription has no usable current period end.');
  return value;
}

export function invoiceSubscriptionId(invoice) {
  return objectId(invoice?.parent?.subscription_details?.subscription) || objectId(invoice?.subscription);
}

function subscriptionItems(subscription) {
  return subscription?.items?.data || [];
}

function paymentMethodId(value) {
  return objectId(value);
}

export function paymentMethodMarker({role, uid, customerId, subscriptionId}) {
  return {
    kr_test_scenario: SCENARIO,
    kr_test_role: role,
    kr_uid: uid,
    kr_customer_id: customerId,
    kr_subscription_id: subscriptionId,
  };
}

export function verifyPaymentMethod({
  paymentMethod,
  customerDefaultId,
  subscriptionDefaultId,
  expectedRole,
  uid,
  customerId,
  subscriptionId,
}) {
  if (![FAILURE_MARKER, SUCCESS_MARKER].includes(expectedRole)) {
    throw new Error('PaymentMethod verification requires an explicit helper role.');
  }
  const expectedLast4 = expectedRole === FAILURE_MARKER ? '0341' : '4242';
  const failures = [];
  const methodId = paymentMethod?.id || null;
  const methodCustomerId = objectId(paymentMethod?.customer);
  if (!methodId || customerDefaultId !== methodId || subscriptionDefaultId !== methodId) {
    failures.push('Customer and subscription defaults must match the retrieved PaymentMethod');
  }
  if (paymentMethod?.livemode !== false) failures.push('PaymentMethod must be test mode');
  if (methodCustomerId !== customerId) failures.push('PaymentMethod must belong to the disposable Customer');
  if (paymentMethod?.type !== 'card') failures.push('PaymentMethod type must be card');
  if (paymentMethod?.card?.brand !== 'visa') failures.push('card brand must be visa');
  if (paymentMethod?.card?.last4 !== expectedLast4) {
    failures.push(`card last4 must be ${expectedLast4}`);
  }

  const metadata = paymentMethod?.metadata || {};
  const markerKeys = ['kr_test_scenario', 'kr_test_role', 'kr_uid', 'kr_customer_id', 'kr_subscription_id'];
  const helperMarkerPresent = markerKeys.some(key => Boolean(metadata[key]));
  const expectedMarker = paymentMethodMarker({
    role: expectedRole,
    uid,
    customerId,
    subscriptionId,
  });
  const helperMarkerVerified = markerKeys.every(key => metadata[key] === expectedMarker[key]);
  if (helperMarkerPresent && !helperMarkerVerified) {
    failures.push('helper-owned PaymentMethod marker does not match the disposable scope');
  }
  if (!helperMarkerPresent && expectedRole === SUCCESS_MARKER) {
    failures.push('successful PaymentMethod requires a helper-owned scope marker');
  }

  const legacyUnmarkedFailureVerified = expectedRole === FAILURE_MARKER && !helperMarkerPresent;
  const verified = failures.length === 0 && (helperMarkerVerified || legacyUnmarkedFailureVerified);
  return {
    id: methodId,
    type: paymentMethod?.type || null,
    brand: paymentMethod?.card?.brand || null,
    last4: paymentMethod?.card?.last4 || null,
    livemode: paymentMethod?.livemode ?? null,
    customerId: methodCustomerId,
    helperMarkerPresent,
    helperMarkerVerified,
    markerRole: metadata.kr_test_role || null,
    verified,
    verificationBasis: verified
      ? helperMarkerVerified ? 'helper_marker_and_stripe_test_card' : 'stripe_test_card_last4_0341_legacy_unmarked'
      : 'not_verified',
    failures,
  };
}

function assertVerifiedPaymentMethod(verification, label) {
  if (!verification.verified) {
    throw new Error(`${label} PaymentMethod verification failed: ${verification.failures.join('; ')}.`);
  }
}

async function inspectCurrentPaymentMethod(stripe, scope, args, uid, expectedRole) {
  return verifyRetrievedPaymentMethod(
    await retrieveCurrentPaymentMethod(stripe, scope),
    args,
    uid,
    expectedRole,
  );
}

async function retrieveCurrentPaymentMethod(stripe, scope) {
  const customerDefaultId = paymentMethodId(scope.customer.invoice_settings?.default_payment_method);
  const subscriptionDefaultId = paymentMethodId(scope.subscription.default_payment_method);
  const retrievalId = customerDefaultId || subscriptionDefaultId;
  const paymentMethod = retrievalId?.startsWith('pm_')
    ? await stripe.paymentMethods.retrieve(retrievalId)
    : null;
  return {paymentMethod, customerDefaultId, subscriptionDefaultId};
}

function verifyRetrievedPaymentMethod(retrieved, args, uid, expectedRole) {
  return verifyPaymentMethod({
    ...retrieved,
    expectedRole,
    uid,
    customerId: args.customer,
    subscriptionId: args.subscription,
  });
}

function assertFreshProfile(profile) {
  const billing = profile?.billing || {};
  const familyId = profile?.family?.familyId || billing.planChangeFamilyId;
  if (billing.stripeCustomerId || billing.stripeSubscriptionId || familyId ||
      (billing.plan && billing.plan !== 'free') ||
      (billing.status && billing.status !== 'none')) {
    throw new Error('Disposable emulator profile is not a fresh Free account; no Stripe object was created.');
  }
}

function assertCustomer(customer, {email, uid, clockId}) {
  if (!customer || customer.deleted) throw new Error('Stripe customer is deleted or unavailable.');
  if (customer.livemode !== false) throw new Error('Refusing a live-mode Stripe customer.');
  if (String(customer.email || '').toLowerCase() !== email) throw new Error('Stripe customer email does not match --email.');
  if (customer.metadata?.kr_uid !== uid || customer.metadata?.kr_test_scenario !== SCENARIO) {
    throw new Error('Stripe customer is not owned by this disposable emulator user and scenario.');
  }
  if (objectId(customer.test_clock) !== clockId) throw new Error('Stripe customer is not attached to the supplied Test Clock.');
}

function assertSubscription(subscription, {customerId, uid, configuredPriceId}) {
  if (!subscription || subscription.livemode !== false) throw new Error('Refusing a live-mode or missing Stripe subscription.');
  if (objectId(subscription.customer) !== customerId) throw new Error('Stripe subscription does not belong to the supplied customer.');
  if (subscription.metadata?.kr_uid !== uid || subscription.metadata?.kr_test_scenario !== SCENARIO ||
      subscription.metadata?.kr_plan !== 'pro' || subscription.metadata?.kr_interval !== 'month' ||
      subscription.metadata?.kr_price_id !== configuredPriceId) {
    throw new Error('Stripe subscription metadata does not match the disposable Pro monthly scenario.');
  }
  const items = subscriptionItems(subscription);
  const baseItems = items.filter(item => ['pro', 'family'].includes(item?.price?.metadata?.kr_plan));
  const aiItems = items.filter(item => item?.price?.metadata?.kr_addon === 'ai_pack');
  if (items.length !== 1 || baseItems.length !== 1 || aiItems.length !== 0 || baseItems[0].price.id !== configuredPriceId) {
    throw new Error('Expected exactly one approved Pro monthly item and no AI Pack.');
  }
}

export function assertRenewalInvoice(invoice, {customerId, subscriptionId}) {
  if (!invoice || invoice.livemode !== false) throw new Error('Refusing a live-mode or missing Stripe invoice.');
  if (objectId(invoice.customer) !== customerId || invoiceSubscriptionId(invoice) !== subscriptionId) {
    throw new Error('Invoice is not scoped to the supplied disposable customer and subscription.');
  }
  if (invoice.billing_reason !== 'subscription_cycle') {
    throw new Error('Invoice is not a normal subscription renewal invoice.');
  }
  if (invoice.status !== 'open' || Number(invoice.amount_paid || 0) !== 0 || Number(invoice.amount_remaining || 0) <= 0) {
    throw new Error('Renewal invoice must be open, unpaid, and have a positive remaining balance.');
  }
  return invoice;
}

export function assertDraftRenewalInvoice(invoice, {customerId, subscriptionId}) {
  if (!invoice || invoice.livemode !== false) throw new Error('Refusing a live-mode or missing Stripe invoice.');
  if (objectId(invoice.customer) !== customerId || invoiceSubscriptionId(invoice) !== subscriptionId) {
    throw new Error('Invoice is not scoped to the supplied disposable customer and subscription.');
  }
  if (invoice.billing_reason !== 'subscription_cycle') {
    throw new Error('Invoice is not a normal subscription renewal invoice.');
  }
  if (invoice.status !== 'draft' || Number(invoice.amount_paid || 0) !== 0 || Number(invoice.amount_due || 0) <= 0) {
    throw new Error('Renewal invoice must be draft, unpaid, and have a positive amount due before collection advances.');
  }
  return invoice;
}

function assertFirestoreLink(profile, {customerId, subscriptionId}) {
  const billing = profile?.billing || {};
  if (billing.stripeCustomerId !== customerId || billing.stripeSubscriptionId !== subscriptionId) {
    throw new Error('Firestore Emulator billing IDs do not match the supplied Stripe objects; wait for forwarded webhooks and re-run status.');
  }
}

function idempotencyKey(uid, operation) {
  return `kr-phase2-pastdue:${uid}:${operation}:v1`;
}

async function localUser(email) {
  const app = getApps().find(candidate => candidate.name === 'phase2-pastdue-test-clock') ||
    initializeApp({projectId: PROJECT_ID}, 'phase2-pastdue-test-clock');
  const auth = getAuth(app);
  const db = getFirestore(app);
  const account = await auth.getUserByEmail(email);
  const snapshot = await db.collection('users').doc(account.uid).get();
  if (!snapshot.exists) throw new Error('Disposable user profile was not found in the Firestore Emulator.');
  return {uid: account.uid, profile: snapshot.data() || {}};
}

async function retrieveSubscription(stripe, id) {
  return stripe.subscriptions.retrieve(id, {expand: ['latest_invoice']});
}

async function latestInvoices(stripe, customerId, subscriptionId) {
  return (await stripe.invoices.list({customer: customerId, subscription: subscriptionId, limit: 10})).data;
}

async function waitForClockReady(stripe, clockId, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  let clock;
  do {
    clock = await stripe.testHelpers.testClocks.retrieve(clockId);
    if (clock.status === 'ready') return clock;
    if (clock.status !== 'advancing') throw new Error(`Test Clock entered unexpected status: ${clock.status}.`);
    await new Promise(resolve => setTimeout(resolve, 2_000));
  } while (Date.now() < deadline);
  throw new Error('Timed out waiting for the Test Clock to become ready. Use status before taking another action.');
}

function invoiceSummary(invoice) {
  if (!invoice) return null;
  return {
    id: invoice.id,
    billingReason: invoice.billing_reason,
    status: invoice.status,
    amountDue: invoice.amount_due,
    amountPaid: invoice.amount_paid,
    amountRemaining: invoice.amount_remaining,
    subscriptionId: invoiceSubscriptionId(invoice),
  };
}

function emulatorSummary(profile, expectedIds) {
  const billing = profile?.billing || {};
  const canonicalPlan = billing.plan || 'free';
  const canonicalStatus = billing.status || 'none';
  const accessEnd = billing.cancelAtPeriodEnd && Number(billing.scheduledCancellationAt || 0) > 0
    ? Math.min(Number(billing.currentPeriodEnd || 0), Number(billing.scheduledCancellationAt))
    : Number(billing.currentPeriodEnd || 0);
  const paid = ['active', 'trialing'].includes(canonicalStatus) && accessEnd > Date.now();
  const effectivePlan = paid && ['pro', 'family'].includes(canonicalPlan) ? canonicalPlan : 'free';
  const paymentAttentionRequired = ['pro', 'family'].includes(canonicalPlan) &&
    ['past_due', 'unpaid', 'incomplete', 'incomplete_expired'].includes(canonicalStatus);
  return {
    canonicalPlan,
    canonicalStatus,
    stripeCustomerId: billing.stripeCustomerId || null,
    stripeSubscriptionId: billing.stripeSubscriptionId || null,
    expectedStripeIdsLinked: billing.stripeCustomerId === expectedIds.customerId &&
      billing.stripeSubscriptionId === expectedIds.subscriptionId,
    currentPeriodEnd: Number(billing.currentPeriodEnd || 0),
    effectivePlan,
    effectivePaidEntitlement: effectivePlan !== 'free',
    effectiveAIAllowance: effectivePlan === 'pro' ? 200 : effectivePlan === 'family' ? 600 : 10,
    paymentAttentionRequired,
    entitlementReason: paid ? (canonicalStatus === 'trialing' ? 'trialing' : 'active')
      : canonicalStatus === 'past_due' ? 'past_due'
        : canonicalStatus === 'incomplete_expired' ? 'subscription_expired'
          : paymentAttentionRequired ? 'payment_required'
            : canonicalStatus === 'canceled' ? 'subscription_canceled'
              : canonicalPlan === 'free' ? 'free_plan' : 'paid_entitlement_unavailable',
  };
}

async function verifyScope({stripe, args, uid, profile, configuredPriceId, requireLink = true}) {
  const [clock, customer, subscription, price] = await Promise.all([
    stripe.testHelpers.testClocks.retrieve(args.clock),
    stripe.customers.retrieve(args.customer),
    retrieveSubscription(stripe, args.subscription),
    stripe.prices.retrieve(configuredPriceId),
  ]);
  validateProMonthlyPrice(price, configuredPriceId);
  if (clock.livemode !== false) throw new Error('Refusing a live-mode Test Clock.');
  assertCustomer(customer, {email: args.email, uid, clockId: args.clock});
  assertSubscription(subscription, {customerId: args.customer, uid, configuredPriceId});
  if (clock.status === 'deleted') throw new Error('Test Clock has been deleted.');
  if (requireLink) assertFirestoreLink(profile, {customerId: args.customer, subscriptionId: args.subscription});
  return {clock, customer, subscription};
}

async function createScenario({stripe, args, uid, profile, configuredPriceId}) {
  assertFreshProfile(profile);
  const price = validateProMonthlyPrice(await stripe.prices.retrieve(configuredPriceId), configuredPriceId);
  const existing = (await stripe.customers.list({email: args.email, limit: 100})).data;
  if (existing.length) {
    throw new Error('A Stripe customer already exists for this disposable identity or scenario; inspect it instead of creating a duplicate.');
  }

  const frozenTime = Math.floor(Date.now() / 1000);
  const clock = await stripe.testHelpers.testClocks.create({
    frozen_time: frozenTime,
    name: `KonnectedRoots past_due ${uid.slice(0, 12)}`,
  }, {idempotencyKey: idempotencyKey(uid, 'clock')});
  console.log(`Created Test Clock: ${clock.id}`);

  const customer = await stripe.customers.create({
    email: args.email,
    test_clock: clock.id,
    metadata: {kr_uid: uid, kr_test_scenario: SCENARIO},
  }, {idempotencyKey: idempotencyKey(uid, 'customer')});
  console.log(`Created clock-bound Customer: ${customer.id}`);

  const attached = await stripe.paymentMethods.attach(SUCCESS_PAYMENT_METHOD, {
    customer: customer.id,
  }, {idempotencyKey: idempotencyKey(uid, 'attach-success-initial')});
  await stripe.customers.update(customer.id, {
    invoice_settings: {default_payment_method: attached.id},
  }, {idempotencyKey: idempotencyKey(uid, 'customer-success-initial')});

  const metadata = {
    kr_uid: uid,
    kr_plan: 'pro',
    kr_interval: 'month',
    kr_price_id: price.id,
    kr_test_scenario: SCENARIO,
  };
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{price: price.id, quantity: 1}],
    collection_method: 'charge_automatically',
    default_payment_method: attached.id,
    payment_behavior: 'error_if_incomplete',
    payment_settings: {save_default_payment_method: 'on_subscription'},
    metadata,
    expand: ['latest_invoice'],
  }, {idempotencyKey: idempotencyKey(uid, 'pro-monthly-subscription')});
  console.log(`Created Pro monthly Subscription: ${subscription.id}`);

  console.log(JSON.stringify({
    action: 'create',
    mode: 'MUTATING_STRIPE_TEST_ONLY',
    clockId: clock.id,
    customerId: customer.id,
    subscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    initialInvoice: invoiceSummary(subscription.latest_invoice),
    next: 'Wait for local webhook forwarding, then run status with these exact IDs.',
  }, null, 2));
}

async function setDefaultMethod({stripe, args, uid, profile, configuredPriceId, paymentMethod, expectedStatus}) {
  const scope = await verifyScope({stripe, args, uid, profile, configuredPriceId});
  if (!expectedStatus.includes(scope.subscription.status)) {
    throw new Error(`Subscription status ${scope.subscription.status} is not valid for this action.`);
  }
  const attached = await stripe.paymentMethods.attach(paymentMethod, {customer: args.customer}, {
    idempotencyKey: idempotencyKey(uid, `attach-${paymentMethod}`),
  });
  const role = paymentMethod === FAILING_PAYMENT_METHOD ? FAILURE_MARKER : SUCCESS_MARKER;
  const marked = await stripe.paymentMethods.update(attached.id, {
    metadata: paymentMethodMarker({
      role,
      uid,
      customerId: args.customer,
      subscriptionId: args.subscription,
    }),
  }, {idempotencyKey: idempotencyKey(uid, `mark-${role}-${attached.id}`)});
  const [customer, subscription] = await Promise.all([
    stripe.customers.update(args.customer, {
      invoice_settings: {default_payment_method: attached.id},
    }, {idempotencyKey: idempotencyKey(uid, `customer-default-${paymentMethod}`)}),
    stripe.subscriptions.update(args.subscription, {
      default_payment_method: attached.id,
    }, {idempotencyKey: idempotencyKey(uid, `subscription-default-${paymentMethod}`)}),
  ]);
  if (paymentMethodId(customer.invoice_settings?.default_payment_method) !== attached.id ||
      paymentMethodId(subscription.default_payment_method) !== attached.id) {
    throw new Error('Stripe did not persist the selected payment method on both customer and subscription.');
  }
  const verification = verifyPaymentMethod({
    paymentMethod: marked,
    customerDefaultId: paymentMethodId(customer.invoice_settings?.default_payment_method),
    subscriptionDefaultId: paymentMethodId(subscription.default_payment_method),
    expectedRole: role,
    uid,
    customerId: args.customer,
    subscriptionId: args.subscription,
  });
  assertVerifiedPaymentMethod(verification, role === FAILURE_MARKER ? 'Failing' : 'Successful');
  console.log(JSON.stringify({
    action: paymentMethod === FAILING_PAYMENT_METHOD ? 'set-failing-method' : 'set-success-method',
    mode: 'MUTATING_STRIPE_TEST_ONLY',
    clockId: args.clock,
    customerId: args.customer,
    subscriptionId: args.subscription,
    paymentMethodStrategy: paymentMethod,
    generatedPaymentMethod: verification,
    customerDefaultVerified: true,
    subscriptionDefaultVerified: true,
  }, null, 2));
}

async function advanceRenewal({stripe, args, uid, profile, configuredPriceId}) {
  const scope = await verifyScope({stripe, args, uid, profile, configuredPriceId});
  if (!['active', 'trialing'].includes(scope.subscription.status)) {
    throw new Error('advance-renewal requires an active/trialing baseline subscription.');
  }
  if (scope.clock.status !== 'ready') throw new Error(`Test Clock must be ready, found ${scope.clock.status}.`);
  const failureMethod = await inspectCurrentPaymentMethod(stripe, scope, args, uid, FAILURE_MARKER);
  assertVerifiedPaymentMethod(failureMethod, 'Failing');
  const periodEnd = subscriptionPeriodEnd(scope.subscription);
  if (periodEnd <= Number(scope.clock.frozen_time || 0)) {
    throw new Error('The supplied subscription renewal boundary is not ahead of the Test Clock.');
  }
  const target = periodEnd;
  console.log(`Advancing Test Clock ${args.clock} once to the renewal boundary ${target}.`);
  await stripe.testHelpers.testClocks.advance(args.clock, {frozen_time: target}, {
    idempotencyKey: idempotencyKey(uid, `advance-${periodEnd}`),
  });
  const clock = await waitForClockReady(stripe, args.clock);
  const subscription = await retrieveSubscription(stripe, args.subscription);
  const invoices = await latestInvoices(stripe, args.customer, args.subscription);
  console.log(JSON.stringify({
    action: 'advance-renewal',
    mode: 'MUTATING_STRIPE_TEST_ONLY',
    clockId: clock.id,
    frozenTime: clock.frozen_time,
    customerId: args.customer,
    subscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    latestInvoice: invoiceSummary(invoices[0]),
    next: 'Verify the draft subscription_cycle invoice, then run advance-collection with that exact invoice ID.',
  }, null, 2));
}

async function advanceCollection({stripe, args, uid, profile, configuredPriceId}) {
  const scope = await verifyScope({stripe, args, uid, profile, configuredPriceId});
  if (!['active', 'trialing'].includes(scope.subscription.status)) {
    throw new Error('advance-collection requires the active/trialing state before the renewal charge attempt.');
  }
  if (scope.clock.status !== 'ready') throw new Error(`Test Clock must be ready, found ${scope.clock.status}.`);
  const failureMethod = await inspectCurrentPaymentMethod(stripe, scope, args, uid, FAILURE_MARKER);
  assertVerifiedPaymentMethod(failureMethod, 'Failing');
  const invoice = assertDraftRenewalInvoice(await stripe.invoices.retrieve(args.invoice), {
    customerId: args.customer,
    subscriptionId: args.subscription,
  });
  const finalizesAt = Number(invoice.automatically_finalizes_at || 0) > 0
    ? Number(invoice.automatically_finalizes_at)
    : Number(invoice.created || 0) + 3600;
  const target = Math.max(finalizesAt + 60, Number(scope.clock.frozen_time || 0) + 1);
  console.log(`Advancing Test Clock ${args.clock} once to ${target} (scheduled finalization + 60 seconds).`);
  await stripe.testHelpers.testClocks.advance(args.clock, {frozen_time: target}, {
    idempotencyKey: idempotencyKey(uid, `collect-${invoice.id}-${target}`),
  });
  const clock = await waitForClockReady(stripe, args.clock);
  const [subscription, collectedInvoice] = await Promise.all([
    retrieveSubscription(stripe, args.subscription),
    stripe.invoices.retrieve(args.invoice),
  ]);
  console.log(JSON.stringify({
    action: 'advance-collection',
    mode: 'MUTATING_STRIPE_TEST_ONLY',
    clockId: clock.id,
    frozenTime: clock.frozen_time,
    customerId: args.customer,
    subscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    renewalInvoice: invoiceSummary(collectedInvoice),
    next: subscription.status === 'past_due' && collectedInvoice.status === 'open'
      ? 'Wait for local webhooks, then run status and the read-only PastDue checks.'
      : 'Do not advance or retry automatically. Run status and inspect Stripe event delivery first.',
  }, null, 2));
}

async function retryInvoice({stripe, args, uid, profile, configuredPriceId}) {
  const scope = await verifyScope({stripe, args, uid, profile, configuredPriceId});
  if (scope.subscription.status !== 'past_due') {
    throw new Error(`retry-invoice requires subscription.status=past_due; found ${scope.subscription.status}.`);
  }
  const successMethod = await inspectCurrentPaymentMethod(stripe, scope, args, uid, SUCCESS_MARKER);
  assertVerifiedPaymentMethod(successMethod, 'Successful');
  const invoice = assertRenewalInvoice(await stripe.invoices.retrieve(args.invoice), {
    customerId: args.customer,
    subscriptionId: args.subscription,
  });
  const paid = await stripe.invoices.pay(invoice.id, {payment_method: successMethod.id}, {
    idempotencyKey: idempotencyKey(uid, `pay-${invoice.id}`),
  });
  const subscription = await retrieveSubscription(stripe, args.subscription);
  console.log(JSON.stringify({
    action: 'retry-invoice',
    mode: 'MUTATING_STRIPE_TEST_ONLY',
    clockId: args.clock,
    customerId: args.customer,
    subscriptionId: args.subscription,
    invoice: invoiceSummary(paid),
    subscriptionStatus: subscription.status,
    next: 'Wait for local webhooks, then run status and the read-only RecoveryActive checks.',
  }, null, 2));
}

async function showStatus({stripe, args, uid, profile, configuredPriceId}) {
  const scope = await verifyScope({stripe, args, uid, profile, configuredPriceId, requireLink: false});
  const [invoices, retrievedMethod] = await Promise.all([
    latestInvoices(stripe, args.customer, args.subscription),
    retrieveCurrentPaymentMethod(stripe, scope),
  ]);
  const failureMethod = verifyRetrievedPaymentMethod(retrievedMethod, args, uid, FAILURE_MARKER);
  const successMethod = verifyRetrievedPaymentMethod(retrievedMethod, args, uid, SUCCESS_MARKER);
  let selectedInvoice = null;
  if (args.invoice) {
    selectedInvoice = await stripe.invoices.retrieve(args.invoice);
    if (objectId(selectedInvoice.customer) !== args.customer || invoiceSubscriptionId(selectedInvoice) !== args.subscription) {
      throw new Error('Supplied invoice is outside the disposable customer/subscription scope.');
    }
  }
  const safeToAdvanceRenewal = failureMethod.verified &&
    ['active', 'trialing'].includes(scope.subscription.status) ? 'YES' : 'NO';
  console.log(JSON.stringify({
    action: 'status',
    mode: 'READ_ONLY',
    stripe: {
      clockId: scope.clock.id,
      clockStatus: scope.clock.status,
      frozenTime: scope.clock.frozen_time,
      customerId: args.customer,
      subscriptionId: args.subscription,
      subscriptionStatus: scope.subscription.status,
      currentPeriodEnd: subscriptionPeriodEnd(scope.subscription),
      customerDefaultPaymentMethod: paymentMethodId(scope.customer.invoice_settings?.default_payment_method),
      subscriptionDefaultPaymentMethod: paymentMethodId(scope.subscription.default_payment_method),
      paymentMethodId: failureMethod.id,
      paymentMethodType: failureMethod.type,
      paymentMethodCustomerId: failureMethod.customerId,
      paymentMethodLivemode: failureMethod.livemode,
      paymentMethodTestMode: failureMethod.livemode === false,
      cardBrand: failureMethod.brand,
      cardLast4: failureMethod.last4,
      helperMarkerPresent: failureMethod.helperMarkerPresent || successMethod.helperMarkerPresent,
      helperMarkerVerified: failureMethod.helperMarkerVerified || successMethod.helperMarkerVerified,
      helperMarkerRole: failureMethod.markerRole || successMethod.markerRole,
      failingMethodVerified: failureMethod.verified,
      successfulMethodVerified: successMethod.verified,
      paymentMethodVerificationBasis: failureMethod.verified
        ? failureMethod.verificationBasis
        : successMethod.verified ? successMethod.verificationBasis : 'not_verified',
      paymentMethodVerificationFailures: failureMethod.verified ? [] : failureMethod.failures,
      safeToAdvanceRenewal,
      selectedInvoice: invoiceSummary(selectedInvoice),
      recentInvoices: invoices.slice(0, 5).map(invoiceSummary),
    },
    emulator: emulatorSummary(profile, {customerId: args.customer, subscriptionId: args.subscription}),
  }, null, 2));
  console.log(`Safe to advance renewal: ${safeToAdvanceRenewal}`);
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  args.email = assertDisposableEmail(args.email);
  assertLocalEnvironment();
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const {secret, proMonthlyPriceId} = loadConfiguration(repoRoot);
  const stripe = new Stripe(secret, {maxNetworkRetries: 2});
  const {uid, profile} = await localUser(args.email);
  const common = {stripe, args, uid, profile, configuredPriceId: proMonthlyPriceId};

  switch (args.action) {
    case 'create':
      return createScenario(common);
    case 'set-failing-method':
      return setDefaultMethod({...common, paymentMethod: FAILING_PAYMENT_METHOD, expectedStatus: ['active', 'trialing']});
    case 'advance-renewal':
      return advanceRenewal(common);
    case 'advance-collection':
      return advanceCollection(common);
    case 'set-success-method':
      return setDefaultMethod({...common, paymentMethod: SUCCESS_PAYMENT_METHOD, expectedStatus: ['past_due']});
    case 'retry-invoice':
      return retryInvoice(common);
    case 'status':
      return showStatus(common);
    default:
      throw new Error('Unsupported action.');
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  main().catch(error => {
    console.error(`ERROR: ${error instanceof Error ? error.message : 'Test Clock helper failed.'}`);
    process.exitCode = 1;
  });
}
