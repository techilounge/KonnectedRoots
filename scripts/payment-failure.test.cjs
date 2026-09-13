const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const {test} = require('node:test');
const assert = require('node:assert/strict');

function loadActions({billingStatus = 'active', familyStatus = billingStatus} = {}) {
  const future = Date.now() + 60_000;
  const docs = new Map([
    ['users/fixture', {
      billing: {
        plan:'family', status:billingStatus, currentPeriodEnd:future,
        stripeCustomerId:'cus_failure_fixture', stripeSubscriptionId:'sub_failure_fixture',
        aiPackItemExists:true, aiPackStatus:'active', aiPackPaidThrough:future,
        addons:{aiPack:true},
      },
      family:{familyId:'family_failure_fixture'},
      usage:{monthKey:new Date().toISOString().slice(0, 7), aiActionsUsed:0, aiActionsAllowance:10},
    }],
    ['users/owner', {
      billing: {
        plan:'family', status:billingStatus, currentPeriodEnd:future,
        stripeCustomerId:'cus_failure_fixture', stripeSubscriptionId:'sub_failure_fixture',
        aiPackItemExists:true, aiPackStatus:'active', aiPackPaidThrough:future,
        addons:{aiPack:true},
      },
    }],
    ['families/family_failure_fixture', {
      ownerUid:'owner',
      workspaceName:'Preserved failure fixture',
      plan: {
        plan:'family', status:familyStatus, currentPeriodEnd:future,
        stripeCustomerId:'cus_failure_fixture', stripeSubscriptionId:'sub_failure_fixture',
        aiPackItemExists:true, aiPackStatus:'active', aiPackPaidThrough:future,
        addons:{aiPack:true},
      },
      usage:{monthKey:new Date().toISOString().slice(0, 7), aiActionsUsed:41, aiActionsAllowance:1600},
    }],
  ]);
  const clone = value => value === undefined ? undefined : structuredClone(value);
  const ref = key => ({
    key,
    get:async () => ({exists:docs.has(key), data:() => clone(docs.get(key))}),
  });
  const adminDb = {collection(name) { return {doc(id) { return ref(`${name}/${id}`); }}; }};
  const adminAuth = {verifyIdToken:async () => ({uid:'fixture'})};
  const cache = new Map();
  function read(file) {
    const target = path.resolve(file);
    if (cache.has(target)) return cache.get(target).exports;
    const module = {exports:{}};
    cache.set(target, module);
    const code = ts.transpileModule(fs.readFileSync(target,'utf8'), {
      compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true},
    }).outputText;
    new Function('require','module','exports',code)((request) => {
      if (request === 'server-only') return {};
      if (request === '@/lib/firebase/admin') return {adminAuth,adminDb};
      if (request.startsWith('@/')) return read(path.join('src',`${request.slice(2)}.ts`));
      if (request.startsWith('./')) return read(path.join(path.dirname(target),`${request}.ts`));
      return require(request);
    },module,module.exports);
    return module.exports;
  }
  return {actions:read('src/app/billing/actions.ts'), docs, future};
}

for (const status of ['past_due', 'unpaid', 'incomplete', 'incomplete_expired', 'paused', 'canceled']) {
  test(`authoritative ${status} state preserves Family data and fails paid entitlement closed`, async () => {
    const fixture = loadActions({billingStatus:status, familyStatus:status});
    const view = await fixture.actions.getAuthoritativeBillingView('fixture-token');
    assert.equal(view.canonicalPlan,'family');
    assert.equal(view.canonicalStatus,status);
    assert.equal(view.plan,'free');
    assert.equal(view.effectivePaidEntitlement,false);
    assert.equal(view.limits.aiActionsAllowance,10);
    assert.equal(view.aiPackEntitlementValid,false);
    assert.equal(view.familyWorkspacePreserved,true);
    assert.equal(view.familyId,'family_failure_fixture');
    assert.equal(view.hasStripeCustomer,true);
    if (['past_due', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'].includes(status)) {
      assert.equal(view.paymentAttentionRequired,true);
      assert.equal(view.entitlementReason,status === 'past_due' ? 'past_due' : status === 'incomplete_expired' ? 'subscription_expired' : 'payment_required');
    } else {
      assert.equal(view.paymentAttentionRequired,false);
      assert.equal(view.entitlementReason,'subscription_canceled');
    }
  });
}

test('authoritative Family recovery restores the paid pooled allowance without a new grant', async () => {
  const fixture = loadActions({billingStatus:'active', familyStatus:'active'});
  const view = await fixture.actions.getAuthoritativeBillingView('fixture-token');
  assert.equal(view.plan,'family');
  assert.equal(view.effectivePaidEntitlement,true);
  assert.equal(view.paymentAttentionRequired,false);
  assert.equal(view.limits.aiActionsAllowance,1600);
  assert.equal(view.aiPackEntitlementValid,true);
  assert.equal(view.aiPackPaidThrough,fixture.future);
  assert.equal(fixture.docs.get('families/family_failure_fixture').usage.aiActionsUsed,41);
});

test('Billing Settings and Pricing expose the payment-attention path', () => {
  const billingPage = fs.readFileSync('src/app/settings/billing/page.tsx','utf8');
  const pricingPage = fs.readFileSync('src/app/pricing/page.tsx','utf8');
  const report = fs.readFileSync('scripts/phase2-emulator-report.mjs','utf8');
  const harness = fs.readFileSync('scripts/phase2-lifecycle.ps1','utf8');
  const lifecycleDocs = fs.readFileSync('docs/billing/LOCAL_STRIPE_LIFECYCLE_TEST.md','utf8');
  assert.match(billingPage,/paymentAttentionRequired/);
  assert.match(billingPage,/Payment required/);
  assert.match(billingPage,/Fix payment method in Stripe Portal/);
  assert.match(pricingPage,/paymentAttentionRequired/);
  assert.match(pricingPage,/Manage Billing in Stripe Portal/);
  assert.match(pricingPage,/router\.push\('\/settings\/billing'\)/);
  assert.match(report,/canonicalPlan/);
  assert.match(report,/paymentAttentionRequired/);
  assert.match(harness,/"PaymentAttention"/);
  assert.match(harness,/"PastDue"/);
  assert.match(harness,/"EntitlementFailClosed"/);
  assert.match(lifecycleDocs,/-Email \$FailureEmail/);
});
