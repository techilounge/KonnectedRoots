const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {test, before} = require('node:test');
const assert = require('node:assert/strict');

let helper;

before(async () => {
  helper = await import(pathToFileURL(path.resolve('scripts/phase2-pastdue-test-clock.mjs')).href);
});

test('Test Clock helper requires an explicit action, disposable email, and scoped IDs', () => {
  assert.throws(() => helper.parseArgs([]), /Action is required/);
  assert.throws(() => helper.parseArgs(['status']), /--email is required/);
  assert.throws(() => helper.parseArgs([
    'status', '--email', 'phase2-pastdue@example.test',
  ]), /--clock is required/);
  const parsed = helper.parseArgs([
    'status',
    '--email', 'phase2-pastdue@example.test',
    '--clock', 'clock_fixture',
    '--customer', 'cus_fixture',
    '--subscription', 'sub_fixture',
    '--invoice', 'in_fixture',
  ]);
  assert.equal(parsed.action, 'status');
  assert.equal(parsed.invoice, 'in_fixture');
});

test('Test Clock helper refuses protected and non-disposable accounts', () => {
  assert.throws(() => helper.assertDisposableEmail('phase2-billing@example.test'), /protected/);
  assert.throws(() => helper.assertDisposableEmail('phase2-payment-failure@example.test'), /protected/);
  assert.throws(() => helper.assertDisposableEmail('owner@example.com'), /explicit disposable/);
  assert.equal(helper.assertDisposableEmail('PHASE2-PASTDUE@example.test'), 'phase2-pastdue@example.test');
});

test('Test Clock helper requires the exact demo emulator boundary', () => {
  const safe = {
    GCLOUD_PROJECT: 'demo-konnectedroots-phase2',
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    NODE_ENV: 'development',
  };
  assert.doesNotThrow(() => helper.assertLocalEnvironment(safe));
  assert.throws(() => helper.assertLocalEnvironment({...safe, GCLOUD_PROJECT: 'konnectedroots-prod'}), /Refusing to run/);
  assert.throws(() => helper.assertLocalEnvironment({...safe, FIRESTORE_EMULATOR_HOST: 'firestore.googleapis.com'}), /Refusing to run/);
  assert.throws(() => helper.assertLocalEnvironment({...safe, NODE_ENV: 'production'}), /NODE_ENV=production/);
});

test('Test Clock helper accepts only Stripe test secret keys', () => {
  assert.equal(helper.assertTestSecret('sk_test_fixture'), 'sk_test_fixture');
  assert.throws(() => helper.assertTestSecret('sk_live_fixture'), /test\/sandbox/);
  assert.throws(() => helper.assertTestSecret(undefined), /test\/sandbox/);
});

test('configured Pro price must be the approved test monthly catalog entry', () => {
  const price = {
    id: 'price_fixture', livemode: false, active: true, currency: 'usd', unit_amount: 599,
    recurring: {interval: 'month'}, metadata: {kr_plan: 'pro'},
  };
  assert.equal(helper.validateProMonthlyPrice(price, 'price_fixture'), price);
  assert.throws(() => helper.validateProMonthlyPrice({...price, livemode: true}, 'price_fixture'), /not test mode/);
  assert.throws(() => helper.validateProMonthlyPrice({...price, unit_amount: 999}, 'price_fixture'), /599 cents/);
  assert.throws(() => helper.validateProMonthlyPrice({...price, metadata: {kr_plan: 'family'}}, 'price_fixture'), /kr_plan is not pro/);
});

function generatedCard({
  id = 'pm_generated_failure',
  customer = 'cus_fixture',
  last4 = '0341',
  livemode = false,
  metadata = {},
} = {}) {
  return {
    id,
    customer,
    livemode,
    type: 'card',
    card: {brand: 'visa', last4},
    metadata,
  };
}

function verifyGeneratedCard(paymentMethod, overrides = {}) {
  return helper.verifyPaymentMethod({
    paymentMethod,
    customerDefaultId: paymentMethod.id,
    subscriptionDefaultId: paymentMethod.id,
    expectedRole: helper.FAILURE_MARKER,
    uid: 'uid_fixture',
    customerId: 'cus_fixture',
    subscriptionId: 'sub_fixture',
    ...overrides,
  });
}

test('generated failure PaymentMethod installed by the helper passes renewal validation', () => {
  const metadata = helper.paymentMethodMarker({
    role: helper.FAILURE_MARKER,
    uid: 'uid_fixture',
    customerId: 'cus_fixture',
    subscriptionId: 'sub_fixture',
  });
  const result = verifyGeneratedCard(generatedCard({metadata}));
  assert.equal(result.id, 'pm_generated_failure');
  assert.equal(result.helperMarkerVerified, true);
  assert.equal(result.verified, true);
  assert.equal(result.verificationBasis, 'helper_marker_and_stripe_test_card');
});

test('existing unmarked Stripe decline-after-attach card remains safely verifiable', () => {
  const result = verifyGeneratedCard(generatedCard());
  assert.equal(result.helperMarkerPresent, false);
  assert.equal(result.verified, true);
  assert.equal(result.verificationBasis, 'stripe_test_card_last4_0341_legacy_unmarked');
});

test('successful Visa 4242 and arbitrary generated PaymentMethods fail renewal validation', () => {
  const successful = verifyGeneratedCard(generatedCard({id: 'pm_success', last4: '4242'}));
  const arbitrary = verifyGeneratedCard(generatedCard({id: 'pm_arbitrary', last4: '9999'}));
  assert.equal(successful.verified, false);
  assert.match(successful.failures.join(' '), /last4 must be 0341/);
  assert.equal(arbitrary.verified, false);
  assert.match(arbitrary.failures.join(' '), /last4 must be 0341/);
});

test('mismatched Customer and subscription defaults fail renewal validation', () => {
  const paymentMethod = generatedCard();
  const result = verifyGeneratedCard(paymentMethod, {subscriptionDefaultId: 'pm_other'});
  assert.equal(result.verified, false);
  assert.match(result.failures.join(' '), /defaults must match/);
});

test('PaymentMethod attached to the wrong Customer fails renewal validation', () => {
  const result = verifyGeneratedCard(generatedCard({customer: 'cus_other'}));
  assert.equal(result.verified, false);
  assert.match(result.failures.join(' '), /belong to the disposable Customer/);
});

test('helper marker scoped to the wrong subscription fails renewal validation', () => {
  const wrongMarker = helper.paymentMethodMarker({
    role: helper.FAILURE_MARKER,
    uid: 'uid_fixture',
    customerId: 'cus_fixture',
    subscriptionId: 'sub_other',
  });
  const result = verifyGeneratedCard(generatedCard({metadata: wrongMarker}));
  assert.equal(result.verified, false);
  assert.match(result.failures.join(' '), /marker does not match the disposable scope/);
});

test('live-mode PaymentMethod fails renewal validation', () => {
  const result = verifyGeneratedCard(generatedCard({livemode: true}));
  assert.equal(result.verified, false);
  assert.match(result.failures.join(' '), /must be test mode/);
});

test('generated successful PaymentMethod is accepted only for recovery', () => {
  const metadata = helper.paymentMethodMarker({
    role: helper.SUCCESS_MARKER,
    uid: 'uid_fixture',
    customerId: 'cus_fixture',
    subscriptionId: 'sub_fixture',
  });
  const paymentMethod = generatedCard({id: 'pm_generated_success', last4: '4242', metadata});
  const result = helper.verifyPaymentMethod({
    paymentMethod,
    customerDefaultId: paymentMethod.id,
    subscriptionDefaultId: paymentMethod.id,
    expectedRole: helper.SUCCESS_MARKER,
    uid: 'uid_fixture',
    customerId: 'cus_fixture',
    subscriptionId: 'sub_fixture',
  });
  assert.equal(result.verified, true);
  assert.equal(result.helperMarkerVerified, true);
  const unmarked = helper.verifyPaymentMethod({
    paymentMethod: generatedCard({id: 'pm_unmarked_success', last4: '4242'}),
    customerDefaultId: 'pm_unmarked_success',
    subscriptionDefaultId: 'pm_unmarked_success',
    expectedRole: helper.SUCCESS_MARKER,
    uid: 'uid_fixture',
    customerId: 'cus_fixture',
    subscriptionId: 'sub_fixture',
  });
  assert.equal(unmarked.verified, false);
});

test('partial, wrong-role, and unknown helper markers fail closed', () => {
  const partial = verifyGeneratedCard(generatedCard({metadata: {kr_test_scenario: helper.SCENARIO}}));
  const wrongRole = verifyGeneratedCard(generatedCard({metadata: helper.paymentMethodMarker({
    role: helper.SUCCESS_MARKER,
    uid: 'uid_fixture',
    customerId: 'cus_fixture',
    subscriptionId: 'sub_fixture',
  })}));
  assert.equal(partial.verified, false);
  assert.equal(wrongRole.verified, false);
  assert.throws(() => verifyGeneratedCard(generatedCard(), {expectedRole: 'unknown'}), /explicit helper role/);
});

test('renewal advance uses the Clover item period and retains legacy compatibility', () => {
  const price = {metadata: {kr_plan: 'pro'}};
  assert.equal(helper.subscriptionPeriodEnd({
    current_period_end: 111,
    items: {data: [{price, current_period_end: 222}]},
  }), 222);
  assert.equal(helper.subscriptionPeriodEnd({
    current_period_end: 333,
    items: {data: [{price}]},
  }), 333);
  assert.throws(() => helper.subscriptionPeriodEnd({items: {data: []}}), /exactly one/);
});

test('recovery accepts only the exact open unpaid renewal invoice in scope', () => {
  const invoice = {
    id: 'in_fixture', livemode: false, customer: 'cus_fixture', billing_reason: 'subscription_cycle',
    status: 'open', amount_paid: 0, amount_remaining: 599,
    parent: {subscription_details: {subscription: 'sub_fixture'}},
  };
  assert.equal(helper.assertRenewalInvoice(invoice, {
    customerId: 'cus_fixture', subscriptionId: 'sub_fixture',
  }), invoice);
  assert.throws(() => helper.assertRenewalInvoice({...invoice, billing_reason: 'subscription_update'}, {
    customerId: 'cus_fixture', subscriptionId: 'sub_fixture',
  }), /normal subscription renewal/);
  assert.throws(() => helper.assertRenewalInvoice({...invoice, status: 'paid', amount_remaining: 0}, {
    customerId: 'cus_fixture', subscriptionId: 'sub_fixture',
  }), /open, unpaid/);
  assert.throws(() => helper.assertRenewalInvoice({...invoice, customer: 'cus_other'}, {
    customerId: 'cus_fixture', subscriptionId: 'sub_fixture',
  }), /not scoped/);
});

test('collection advance accepts only a scoped draft renewal invoice', () => {
  const invoice = {
    id: 'in_fixture', livemode: false, customer: 'cus_fixture', billing_reason: 'subscription_cycle',
    status: 'draft', amount_paid: 0, amount_due: 599, created: 100,
    parent: {subscription_details: {subscription: 'sub_fixture'}},
  };
  assert.equal(helper.assertDraftRenewalInvoice(invoice, {
    customerId: 'cus_fixture', subscriptionId: 'sub_fixture',
  }), invoice);
  assert.throws(() => helper.assertDraftRenewalInvoice({...invoice, status: 'open'}, {
    customerId: 'cus_fixture', subscriptionId: 'sub_fixture',
  }), /must be draft/);
});

test('mutating Test Clock stages stay separate from the read-only lifecycle harness', () => {
  const source = fs.readFileSync('scripts/phase2-pastdue-test-clock.mjs', 'utf8');
  const harness = fs.readFileSync('scripts/phase2-lifecycle.ps1', 'utf8');
  const runbook = fs.readFileSync('docs/billing/LOCAL_STRIPE_LIFECYCLE_TEST.md', 'utf8');
  for (const action of ['create', 'set-failing-method', 'advance-renewal', 'advance-collection', 'set-success-method', 'retry-invoice', 'status']) {
    assert.match(source, new RegExp(`'${action}'`));
  }
  assert.match(source, /pm_card_chargeCustomerFail/);
  assert.match(source, /pm_card_visa/);
  assert.match(source, /paymentMethods\.update\(attached\.id/);
  assert.match(source, /inspectCurrentPaymentMethod\(stripe, scope, args, uid, FAILURE_MARKER\)/);
  assert.match(source, /payment_method: successMethod\.id/);
  assert.doesNotMatch(source, /defaults must be[\s\S]*pm_card_chargeCustomerFail/i);
  assert.match(source, /billing_reason !== 'subscription_cycle'/);
  assert.match(harness, /Mode: READ-ONLY/);
  assert.doesNotMatch(harness, /testClocks\.advance|invoices\.pay|paymentMethods\.attach/);
  assert.match(runbook, /true renewal `past_due`/i);
});

test('PaymentMethod verification tests are pure and make no Stripe mutation', () => {
  const marker = helper.paymentMethodMarker({
    role: helper.FAILURE_MARKER,
    uid: 'uid_fixture',
    customerId: 'cus_fixture',
    subscriptionId: 'sub_fixture',
  });
  const before = structuredClone(marker);
  const paymentMethod = generatedCard({metadata: marker});
  const result = verifyGeneratedCard(paymentMethod);
  assert.equal(result.verified, true);
  assert.deepEqual(marker, before);
  assert.equal(typeof paymentMethod.attach, 'undefined');
  assert.equal(typeof paymentMethod.update, 'undefined');
  assert.equal(typeof paymentMethod.advance, 'undefined');
});
