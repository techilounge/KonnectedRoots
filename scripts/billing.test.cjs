const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const {test} = require('node:test');
const assert = require('node:assert/strict');

function load(file) {
  const cache = new Map();
  function read(name) {
    const target = path.resolve(name);
    if (cache.has(target)) return cache.get(target).exports;
    const module = {exports:{}}; cache.set(target, module);
    const code = ts.transpileModule(fs.readFileSync(target, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
    new Function('require','module','exports',code)((request) => {
      if (request === './constants') return read(path.join(path.dirname(target), 'constants.ts'));
      if (request === './types') return read(path.join(path.dirname(target), 'types.ts'));
      return require(request);
    }, module, module.exports);
    return module.exports;
  }
  return read(path.resolve(file));
}

const plan = load('src/lib/billing/plan.ts');
const {buildCheckoutPayload} = load('src/lib/billing/checkoutPayload.ts');
const {resolveAIUsageDisplay} = load('src/lib/billing/usageDisplay.ts');
const {resolveSubscriptionPeriodDisplay} = load('src/lib/billing/subscriptionDisplay.ts');
const {resolveAIPackPricingState} = load('src/lib/billing/aiPackPricingState.ts');
const {subscribeToBillingSignals} = load('src/lib/billing/liveSync.ts');

for (const [name, selectedPlan, interval] of [
  ['Pro monthly', 'pro', 'month'],
  ['Pro yearly', 'pro', 'year'],
  ['Family monthly', 'family', 'month'],
  ['Family yearly', 'family', 'year'],
]) {
  test(`${name} checkout without AI Pack omits addons`, () => {
    const payload = buildCheckoutPayload(selectedPlan, interval, false);
    assert.deepEqual(payload, {plan: selectedPlan, interval});
    assert.equal(Object.hasOwn(payload, 'addons'), false);
  });
}

test('checkout with AI Pack sends exactly the selected add-on', () => {
  const payload = buildCheckoutPayload('pro', 'month', true);
  assert.deepEqual(payload, {plan: 'pro', interval: 'month', addons: {aiPack: true}});
  assert.deepEqual(Object.keys(payload.addons), ['aiPack']);
});

test('only active and trialing states grant paid access', () => {
  assert.equal(plan.grantsPaidAccess('active', Date.now() + 60_000), true);
  assert.equal(plan.grantsPaidAccess('trialing', Date.now() + 60_000), true);
  for (const status of ['past_due','unpaid','incomplete','incomplete_expired','paused','canceled','none']) {
    assert.equal(plan.grantsPaidAccess(status, Date.now() + 60_000), false, status);
  }
});

test('payment-attention statuses fail closed without changing the canonical plan', () => {
    for (const status of ['past_due', 'unpaid', 'incomplete', 'incomplete_expired', 'paused']) {
    assert.equal(plan.requiresPaymentAttention('pro', status), true, status);
    assert.equal(plan.requiresPaymentAttention('family', status), true, status);
    assert.equal(plan.effectivePlan({plan:'pro', status, currentPeriodEnd:Date.now() + 60_000}), 'free', status);
    assert.equal(plan.effectivePlan({plan:'family', status, currentPeriodEnd:Date.now() + 60_000}), 'free', status);
  }
  assert.equal(plan.requiresPaymentAttention('free', 'none'), false);
});

test('cancel-at-period-end remains paid until the period expires', () => {
  const end = 2_000;
  assert.equal(plan.grantsPaidAccess('active', end, 1_999), true);
  assert.equal(plan.grantsPaidAccess('active', end, 2_000), false);
});

for (const selectedPlan of ['pro', 'family']) {
  test(`${selectedPlan} scheduled cancellation retains paid entitlement until expiration`, () => {
    const expiration = 2_000;
    const billing = {
      plan: selectedPlan,
      status: 'active',
      currentPeriodEnd: 2_500,
      scheduledCancellationAt: expiration,
    };
    assert.equal(plan.effectivePlan(billing, expiration - 1), selectedPlan);
    assert.equal(plan.effectivePlan(billing, expiration), 'free');
  });
}

test('Billing Settings shows Expires On for Clover scheduled-cancellation state', () => {
  const cancellationAt = 1_791_641_272_000;
  const display = resolveSubscriptionPeriodDisplay(cancellationAt, true, cancellationAt);
  assert.deepEqual(display, {
    isCancellationScheduled: true,
    label: 'Expires On',
    timestamp: cancellationAt,
  });
  assert.notEqual(display.label, 'Next Renewal');
});

test('Billing Settings shows Next Renewal only when cancellation is not scheduled', () => {
  const renewalAt = 1_800_000_000_000;
  const display = resolveSubscriptionPeriodDisplay(renewalAt, false, null);
  assert.deepEqual(display, {
    isCancellationScheduled: false,
    label: 'Next Renewal',
    timestamp: renewalAt,
  });
});

test('Billing Settings renders the canonical cancellation label and warning state', () => {
  const source = fs.readFileSync('src/app/settings/billing/page.tsx', 'utf8');
  assert.equal(source.includes('{subscriptionPeriod.label}'), true);
  assert.equal(source.includes('{subscriptionPeriod.isCancellationScheduled && ('), true);
  assert.equal(source.includes('billing?.cancelAtPeriodEnd ? "Expires On" : "Next Renewal"'), false);
});

test('Billing Settings exposes payment attention instead of an Active label for non-entitled paid states', () => {
  const source = fs.readFileSync('src/app/settings/billing/page.tsx', 'utf8');
  assert.equal(source.includes('paymentAttentionRequired'), true);
  assert.equal(source.includes('Payment required'), true);
  assert.equal(source.includes('Fix payment method in Stripe Portal'), true);
  assert.equal(source.includes("subscriptionStatus === 'canceled'"), true);
});

test('Pricing sends payment-attention accounts to Billing Settings and disables new checkout', () => {
  const source = fs.readFileSync('src/app/pricing/page.tsx', 'utf8');
  assert.equal(source.includes('paymentAttentionRequired'), true);
  assert.equal(source.includes("router.push('/settings/billing')"), true);
  assert.equal(source.includes('Manage Billing in Stripe Portal'), true);
  assert.equal(source.includes('disabled={!billingView.canStartProCheckout || loadingPlan !== null || Boolean(billingProgress)}'), true);
});

test('stale paid plan fields resolve to Free', () => {
  assert.equal(plan.effectivePlan({plan:'pro', status:'canceled', currentPeriodEnd:0}), 'free');
  assert.equal(plan.effectivePlan({plan:'family', status:'past_due', currentPeriodEnd:Date.now() + 1_000}), 'free');
  assert.equal(plan.effectivePlan({plan:'pro', status:'active', currentPeriodEnd:0}), 'free');
  assert.equal(plan.effectivePlan({plan:'pro', status:'active', currentPeriodEnd:Date.now() + 1_000}), 'pro');
});

test('a Clover plan-item period grants active Pro limits despite a stale Free usage allowance', () => {
  const validFuturePlanItemPeriod = Date.now() + 60_000;
  const effective = plan.effectivePlan({
    plan: 'pro',
    status: 'active',
    currentPeriodEnd: validFuturePlanItemPeriod,
  });
  const staleUsage = {aiActionsAllowance: 10, aiActionsUsed: 0};
  assert.equal(effective, 'pro');
  assert.equal(plan.limitsForPlan(effective, false).aiActionsAllowance, 200);
  assert.equal(staleUsage.aiActionsAllowance, 10);
});

test('Billing Settings displays active Pro allowance instead of stale stored Free allowance', () => {
  const display = resolveAIUsageDisplay(
    plan.limitsForPlan('pro', false),
    {aiActionsUsed: 0, aiActionsAllowance: 10},
  );
  assert.deepEqual(display, {allowance: 200, used: 0, remaining: 200, percentUsed: 0});
});

test('Billing Settings displays the Free allowance', () => {
  const display = resolveAIUsageDisplay(
    plan.limitsForPlan('free', false),
    {aiActionsUsed: 0, aiActionsAllowance: 200},
  );
  assert.deepEqual(display, {allowance: 10, used: 0, remaining: 10, percentUsed: 0});
});

test('Pro remaining credits and progress use the same authoritative allowance', () => {
  const display = resolveAIUsageDisplay(
    plan.limitsForPlan('pro', false),
    {aiActionsUsed: 50, aiActionsAllowance: 10},
  );
  assert.deepEqual(display, {allowance: 200, used: 50, remaining: 150, percentUsed: 25});
});

test('AI Pack is represented in the authoritative Pro allowance', () => {
  const display = resolveAIUsageDisplay(
    plan.limitsForPlan('pro', true),
    {aiActionsUsed: 200, aiActionsAllowance: 10},
  );
  assert.deepEqual(display, {allowance: 1200, used: 200, remaining: 1000, percentUsed: 17});
});

test('pending AI Pack keeps Pro at its 200-action base allowance', () => {
  const now = 1_800_000_000_000;
  const billing = {
    aiPackItemExists:true,
    aiPackStatus:'pending',
    aiPackPaidThrough:null,
    addons:{aiPack:false},
  };
  assert.equal(plan.hasActiveAIPack(billing, now), false);
  assert.equal(plan.limitsForPlan('pro', plan.hasActiveAIPack(billing, now)).aiActionsAllowance, 200);
});

test('paid-through AI Pack grants 1,200 Pro and 1,600 pooled Family actions', () => {
  const now = 1_800_000_000_000;
  const billing = {
    aiPackItemExists:true,
    aiPackStatus:'active',
    aiPackPaidThrough:now + 60_000,
    addons:{aiPack:true},
  };
  assert.equal(plan.hasActiveAIPack(billing, now), true);
  assert.equal(plan.limitsForPlan('pro', true).aiActionsAllowance, 1200);
  assert.equal(plan.limitsForPlan('family', true).aiActionsAllowance, 1600);
});

test('removed or expired AI Pack returns to the base plan allowance', () => {
  const now = 1_800_000_000_000;
  const removed = {aiPackItemExists:false,aiPackStatus:'none',aiPackPaidThrough:null,addons:{aiPack:false}};
  const expired = {aiPackItemExists:true,aiPackStatus:'active',aiPackPaidThrough:now,addons:{aiPack:true}};
  assert.equal(plan.hasActiveAIPack(removed, now), false);
  assert.equal(plan.hasActiveAIPack(expired, now), false);
  assert.equal(plan.limitsForPlan('pro', false).aiActionsAllowance, 200);
  assert.equal(plan.limitsForPlan('family', false).aiActionsAllowance, 600);
});

test('scheduled AI Pack removal retains prepaid Pro and Family allowance through paid-through', () => {
  const now = 1_800_000_000_000;
  const paidThrough = now + 60_000;
  const scheduled = {
    aiPackItemExists:false,
    aiPackStatus:'active',
    aiPackPaidThrough:paidThrough,
    aiPackCancelAtPeriodEnd:true,
    aiPackScheduledRemovalAt:paidThrough,
    addons:{aiPack:true},
  };
  assert.equal(plan.hasActiveAIPack(scheduled,now),true);
  assert.equal(plan.limitsForPlan('pro',plan.hasActiveAIPack(scheduled,now)).aiActionsAllowance,1200);
  assert.equal(plan.limitsForPlan('family',plan.hasActiveAIPack(scheduled,now)).aiActionsAllowance,1600);
  assert.equal(plan.hasActiveAIPack(scheduled,paidThrough),false);
  assert.equal(plan.limitsForPlan('pro',plan.hasActiveAIPack(scheduled,paidThrough)).aiActionsAllowance,200);
  assert.equal(plan.limitsForPlan('family',plan.hasActiveAIPack(scheduled,paidThrough)).aiActionsAllowance,600);
});

test('scheduled AI Pack access requires matching server-owned removal and paid-through timestamps', () => {
  const now = 1_800_000_000_000;
  const billing = {
    aiPackItemExists:false,
    aiPackStatus:'active',
    aiPackPaidThrough:now + 60_000,
    aiPackCancelAtPeriodEnd:true,
    aiPackScheduledRemovalAt:now + 120_000,
    addons:{aiPack:true},
  };
  assert.equal(plan.hasActiveAIPack(billing,now),false);
});

test('Pricing disables AI Pack actions while payment is pending or active', () => {
  assert.equal(resolveAIPackPricingState('pending', false, false).disabled, true);
  assert.equal(resolveAIPackPricingState('active', false, false).disabled, true);
  assert.equal(resolveAIPackPricingState('pending', false, false).label, 'AI Pack Payment Processing');
  assert.equal(resolveAIPackPricingState('active', false, false).label, 'AI Pack Active');
});

test('Pricing transitions from Add through authoritative pending to active without reload', () => {
  const initial = resolveAIPackPricingState('none', false, false);
  const calling = resolveAIPackPricingState('none', true, false);
  const pending = resolveAIPackPricingState('pending', false, false);
  const active = resolveAIPackPricingState('active', false, false);
  assert.equal(initial.label, 'Add to Your Plan');
  assert.equal(calling.label, 'Adding...');
  assert.equal(pending.label, 'AI Pack Payment Processing');
  assert.equal(active.label, 'AI Pack Active');
  assert.equal(fs.readFileSync('src/app/pricing/page.tsx', 'utf8').includes('window.location.reload()'), false);
});

test('authoritative pending disables duplicate purchase without granting active UI', () => {
  const pending = resolveAIPackPricingState('pending', false, false);
  assert.equal(pending.disabled, true);
  assert.equal(pending.showSpinner, true);
  assert.notEqual(pending.label, 'AI Pack Active');
});

test('failed callable clears transient loading and restores the authoritative Add action', () => {
  assert.equal(resolveAIPackPricingState('none', true, false).disabled, true);
  assert.deepEqual(resolveAIPackPricingState('none', false, false), {
    label:'Add to Your Plan',disabled:false,showSpinner:false,showDelayedMessage:false,
  });
  const source = fs.readFileSync('src/app/pricing/page.tsx', 'utf8');
  assert.equal(source.includes('setLoadingPlan(null);'), true);
  assert.equal(source.includes('setAIPackError('), true);
});

test('AI Pack removal restores Add action from the prior active state', () => {
  assert.equal(resolveAIPackPricingState('active', false, false).disabled, true);
  assert.equal(resolveAIPackPricingState('none', false, false).disabled, false);
});

test('delayed processing stops animation but stays non-actionable and explains live updates', () => {
  const delayed = resolveAIPackPricingState('pending', false, true);
  assert.deepEqual(delayed, {
    label:'AI Pack Payment Still Processing',disabled:true,showSpinner:false,showDelayedMessage:true,
  });
  const source = fs.readFileSync('src/app/pricing/page.tsx', 'utf8');
  assert.equal(source.includes('Payment is still processing. This page will update automatically when Stripe confirms the payment.'), true);
  assert.equal(source.includes('Refresh status'), true);
});

test('billing signal subscriptions invalidate user and Family state and clean up on unmount', () => {
  const subscriptions = [];
  let invalidations = 0;
  const unsubscribe = subscribeToBillingSignals((target, onChange) => {
    const subscription = {target,onChange,stops:0};
    subscriptions.push(subscription);
    return () => { subscription.stops += 1; };
  }, 'user_fixture', 'family_fixture', () => { invalidations += 1; });
  assert.deepEqual(subscriptions.map(value => value.target), [
    {collection:'users',id:'user_fixture'},
    {collection:'families',id:'family_fixture'},
  ]);
  subscriptions[0].onChange();
  subscriptions[1].onChange();
  assert.equal(invalidations, 2);
  unsubscribe();
  unsubscribe();
  assert.deepEqual(subscriptions.map(value => value.stops), [1,1]);
});

test('useEntitlements treats snapshots as invalidation signals and cleans up timers/listeners', () => {
  const source = fs.readFileSync('src/hooks/useEntitlements.ts', 'utf8');
  assert.equal(source.includes('subscribeToBillingSignals('), true);
  assert.equal(source.includes('getAuthoritativeBillingView(token)'), true);
  assert.equal(source.includes('clearTimeout(refreshTimer)'), true);
  assert.equal(source.includes('unsubscribe();'), true);
});

test('Family pooled allowances remain authoritative with and without AI Pack', () => {
  const pooledUsage = {aiActionsUsed: 100, aiActionsAllowance: 10};
  const family = resolveAIUsageDisplay(plan.limitsForPlan('family', false), pooledUsage);
  const familyWithPack = resolveAIUsageDisplay(plan.limitsForPlan('family', true), pooledUsage);
  assert.deepEqual(family, {allowance: 600, used: 100, remaining: 500, percentUsed: 17});
  assert.deepEqual(familyWithPack, {allowance: 1600, used: 100, remaining: 1500, percentUsed: 6});
});

test('Billing Settings copy keeps GEDCOM outside the visual export quota', () => {
  const source = fs.readFileSync('src/app/settings/billing/page.tsx', 'utf8');
  assert.equal(source.includes('High-resolution PDF and PNG tree exports.'), true);
  assert.equal(source.includes('GEDCOM import/export is available on all plans and does not count toward your visual export allowance.'), true);
  assert.equal(source.includes('PDF, PNG canvas exports and GEDCOM files'), false);
});

test('Billing Settings confirms AI Pack removal and waits for authoritative live state', () => {
  const source = fs.readFileSync('src/app/settings/billing/page.tsx','utf8');
  assert.equal(source.includes("httpsCallable(functions, 'removeAIPack')"),true);
  assert.equal(source.includes('<AlertDialogTitle>Stop AI Pack renewal?</AlertDialogTitle>'),true);
  assert.equal(source.includes("'Remove AI Pack'"),true);
  assert.equal(source.includes("'Retry Remove AI Pack'"),true);
  assert.equal(source.includes('AI Pack ends on {aiPackEndDateFormatted}'),true);
  assert.equal(source.includes('Your {isFamily ? \'Family\' : \'Pro\'} subscription remains active.'),true);
  assert.equal(source.includes('refreshEntitlements();'),true);
  assert.equal(source.includes('window.location.reload()'),false);
});

test('resumed AI Pack keeps the existing Pro and pooled Family allowances', () => {
  const now = 1_800_000_000_000;
  const resumed = {
    aiPackItemExists:true,
    aiPackStatus:'active',
    aiPackPaidThrough:now + 60_000,
    aiPackCancelAtPeriodEnd:false,
    aiPackScheduledRemovalAt:null,
    addons:{aiPack:true},
  };
  assert.equal(plan.hasActiveAIPack(resumed,now),true);
  assert.equal(plan.limitsForPlan('pro',plan.hasActiveAIPack(resumed,now)).aiActionsAllowance,1200);
  assert.equal(plan.limitsForPlan('family',plan.hasActiveAIPack(resumed,now)).aiActionsAllowance,1600);
});

test('Billing Settings confirms resume, uses an empty trusted payload, and waits for authority without reload', () => {
  const source = fs.readFileSync('src/app/settings/billing/page.tsx','utf8');
  assert.equal(source.includes("httpsCallable(functions, 'resumeAIPack')"),true);
  assert.equal(source.includes('resumeAIPackFn({})'),true);
  assert.equal(source.includes('<AlertDialogTitle>Keep AI Pack renewing?</AlertDialogTitle>'),true);
  assert.equal(source.includes('You will not be charged today.'),true);
  assert.equal(source.includes("? 'Resuming...'"),true);
  assert.equal(source.includes("notifications.begin(user.uid, 'resume_ai_pack')"),true);
  assert.equal(source.includes('notifications.accepted(operation)'),true);
  assert.equal(source.includes("title: 'AI Pack renewal resumed'"),false); // fresh observer owns success
  assert.equal(source.includes('isAwaitingAIPackResume || aiPackResumePending'),true);
  assert.equal(source.includes('window.setInterval(refreshEntitlements, 5_000)'),true);
  assert.equal(source.includes('window.location.reload()'),false);
});

test('failed resume returns Billing Settings to authoritative stopped-renewal state', () => {
  const source = fs.readFileSync('src/app/settings/billing/page.tsx','utf8');
  assert.equal(source.includes('setIsResumingAIPack(false)'),true);
  assert.equal(source.includes('setIsAwaitingAIPackResume(false)'),true);
  assert.equal(source.includes('Refresh your billing status before trying again.'),true);
  assert.equal(source.includes("aiPackResumePending ? 'Retry Keep AI Pack' : 'Keep AI Pack'"),true);
  assert.equal(source.includes('refreshEntitlements();'),true);
});

test('Pricing shows stopped-renewal access as active through its end date and never exposes Add', () => {
  const stoppedView = resolveAIPackPricingState('active',false,false);
  assert.deepEqual(stoppedView,{
    label:'AI Pack Active',disabled:true,showSpinner:false,showDelayedMessage:false,
  });
  assert.notEqual(stoppedView.label,'Add to Your Plan');
  const source = fs.readFileSync('src/app/pricing/page.tsx','utf8');
  assert.equal(source.includes("const aiPackRenewalStopped = aiPackStatus === 'active'"),true);
  assert.equal(source.includes('aiPackCancelAtPeriodEnd &&'),true);
  assert.equal(source.includes('!aiPackItemExists'),true);
  assert.equal(source.includes('AI Pack Active. Ends {aiPackEndDateFormatted} unless renewal is resumed.'),true);
  assert.equal(source.includes('Resume renewal in Billing Settings'),true);
});
