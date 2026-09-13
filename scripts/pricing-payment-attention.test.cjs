const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const {test} = require('node:test');
const assert = require('node:assert/strict');

// Render the actual page with synthetic authoritative views and local callable
// doubles. No Firebase, Stripe, browser network, or emulator API is used.
function pricing(initialView = {}) {
  let view = {
    plan:'free',canonicalPlan:'free',canonicalStatus:'none',paymentAttentionRequired:false,
    loading:false,cancelAtPeriodEnd:false,scheduledDowngrade:null,hasAIPack:false,aiPackItemExists:false,aiPackStatus:'none',
    aiPackPaidThrough:null,aiPackCancelAtPeriodEnd:false,planChangeStatus:'none',
    planChangeFailure:null,...initialView,
  };
  const calls = [];
  const routes = [];
  const browser = {location:{href:''}};
  const cache = new Map();
  const jsx = (type, props) => ({type,props:props || {}});
  const ui = names => Object.fromEntries(names.map(name => [name,name]));
  function read(file) {
    const target = path.resolve(file);
    if (cache.has(target)) return cache.get(target).exports;
    const mod = {exports:{}};
    cache.set(target,mod);
    const code = ts.transpileModule(fs.readFileSync(target,'utf8'), {
      compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},
    }).outputText;
    new Function('require','module','exports','window','console',code)(request => {
      if (request === 'react/jsx-runtime') return {jsx,jsxs:jsx,Fragment:'Fragment'};
      if (request === 'react') return {useEffect(){},useState:value => [value,() => {}]};
      if (request === 'next/navigation') return {useRouter:() => ({push:route => routes.push(route)})};
      if (request === '@/hooks/useAuth') return {useAuth:() => ({user:{uid:'synthetic_pricing_fixture'}})};
      if (request === '@/hooks/useEntitlements') return {useEntitlements:() => ({...view,refresh(){}})};
      if (request === '@/lib/firebase/clients') return {functions:{}};
      if (request === 'firebase/functions') return {httpsCallable:(_functions,name) => async payload => {
        calls.push({name,payload});
        return {data:{success:true,status:'pending',url:'https://example.test/synthetic-checkout'}};
      }};
      if (request === 'next/link') return 'Link';
      if (request === '@/components/billing/FamilyDowngradeControls') return 'FamilyDowngradeControls';
      if (request === '@/components/billing/BillingActionFeedback') return {default:'BillingActionFeedback',useBillingProgress:()=>null};
      if (request === '@/lib/billing/notifications') return {billingError(){},billingRequestRejected:()=>false,billingNotifications:()=>({begin:()=> 'synthetic-operation',accepted(){},failed(){}})};
      if (request === '@/components/billing/PricingComparison') return 'PricingComparison';
      if (request.startsWith('@/components/ui/')) return ui(['Button','Card','CardHeader','CardTitle','CardDescription','CardContent','CardFooter','Badge','Switch','Label']);
      if (request === 'lucide-react') return ui(['AlertCircle','Check','Loader2','Sparkles','Users','Crown','Zap']);
      if (request.startsWith('@/lib/billing/')) return read(`src/lib/billing/${request.split('/').at(-1)}.ts`);
      if (request.startsWith('./')) return read(path.join(path.dirname(target),`${request}.ts`));
      throw new Error(`Unexpected Pricing test import: ${request}`);
    },mod,mod.exports,browser,{error(){}});
    return mod.exports;
  }
  const helpers = read('src/lib/billing/pricingBillingState.ts');
  const Page = read('src/app/pricing/page.tsx').default;
  return {calls,routes,helpers,render:() => Page(),setView:next => {view = {...view,...next};}};
}

function elements(value) {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!value || typeof value !== 'object') return [];
  return [value,...elements(value.props?.children)];
}

function content(value) {
  if (Array.isArray(value)) return value.map(content).join('');
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  if (typeof value === 'object') return content(value.props?.children);
  return String(value);
}

for (const canonicalPlan of ['pro','family']) {
  test(`Pricing blocks all paid controls for payment-attention ${canonicalPlan} without presenting ordinary Free purchase`, () => {
    for (const canonicalStatus of ['past_due','unpaid','incomplete','incomplete_expired','paused']) {
      const fixture = pricing({
        plan:'free',canonicalPlan,canonicalStatus,paymentAttentionRequired:true,
        hasAIPack:true,aiPackStatus:'active',aiPackCancelAtPeriodEnd:true,
        aiPackItemExists:false,aiPackPaidThrough:2_000_000_000_000,
      });
      const page = fixture.render();
      const nodes = elements(page);
      const buttons = nodes.filter(node => node.type === 'Button');
      assert.equal(buttons.filter(node => node.props.onClick).length,0,canonicalStatus);
      assert.equal(buttons.every(node => node.props.disabled),true,canonicalStatus);
      assert.doesNotMatch(content(page),/Upgrade to Pro|Upgrade to Family|Add to Your Plan|Downgrade to Pro|Current Plan|Start free, upgrade|Resume renewal/);
      assert.match(content(page),new RegExp(`Your ${canonicalPlan === 'pro' ? 'Pro' : 'Family'} subscription requires payment`));
      const recovery = nodes.filter(node => node.type === 'Link' && node.props.href === '/settings/billing');
      assert.equal(recovery.length,1);
      assert.equal(nodes.find(node => node.type === 'PricingComparison').props.showCallToAction,false);
      assert.deepEqual(fixture.calls,[]);
    }
  });
}

test('canonical past_due status fails Pricing closed even if a stale payment-attention flag is false', () => {
  const fixture = pricing({plan:'free',canonicalPlan:'pro',canonicalStatus:'past_due',paymentAttentionRequired:false});
  const view = fixture.helpers.resolvePricingBillingState({
    currentPlan:'free',canonicalPlan:'pro',canonicalStatus:'past_due',paymentAttentionRequired:false,loading:false,
  });
  assert.equal(view.canStartProCheckout,false);
  assert.equal(view.canStartFamilyCheckout,false);
  assert.equal(view.canUpgradeToFamily,false);
  assert.equal(view.canMutateAddons,false);
  assert.equal(view.isOrdinaryFree,false);
  assert.match(content(fixture.render()),/Free access while billing is paused/);
});

test('active Pro retains Family upgrade and AI Pack actions while preventing duplicate Pro checkout', async () => {
  const fixture = pricing({plan:'pro',canonicalPlan:'pro',canonicalStatus:'active'});
  const buttons = elements(fixture.render()).filter(node => node.type === 'Button');
  const upgrade = buttons.find(node => content(node) === 'Upgrade to Family');
  const addon = buttons.find(node => content(node) === 'Add to Your Plan');
  assert.equal(upgrade.props.disabled,false);
  assert.equal(addon.props.disabled,false);
  await upgrade.props.onClick();
  await addon.props.onClick();
  assert.deepEqual(fixture.calls.map(call => call.name),['upgradeToFamily','addAIPack']);
  assert.equal(buttons.find(node => content(node) === 'Current Plan').props.disabled,true);
});

test('active Family exposes scheduled downgrade controls to the billing owner and retains AI Pack actions', async () => {
  const fixture = pricing({plan:'family',canonicalPlan:'family',canonicalStatus:'active',canManageFamilyBilling:true});
  const buttons = elements(fixture.render()).filter(node => node.type === 'Button');
  assert.equal(elements(fixture.render()).find(node => node.type === 'FamilyDowngradeControls').props.disabled,false);
  assert.equal(buttons.find(node => content(node) === 'Current Plan').props.disabled,true);
  const addon = buttons.find(node => content(node) === 'Add to Your Plan');
  assert.equal(addon.props.disabled,false);
  await addon.props.onClick();
  assert.deepEqual(fixture.calls.map(call => call.name),['addAIPack']);
});

test('authoritative past_due to active recovery restores Pricing controls on rerender without a refresh', () => {
  for (const plan of ['pro','family']) {
    const fixture = pricing({plan:'free',canonicalPlan:plan,canonicalStatus:'past_due',paymentAttentionRequired:true});
    assert.equal(elements(fixture.render()).some(node => node.type === 'Button' && node.props.onClick),false);
    fixture.setView({plan,canonicalStatus:'active',paymentAttentionRequired:false});
    const recovered = fixture.render();
    assert.doesNotMatch(content(recovered),/subscription requires payment/);
    assert.equal(elements(recovered).some(node => node.type === 'Button' && !node.props.disabled && node.props.onClick),true);
    assert.deepEqual(fixture.calls,[]);
  }
});

test('Pricing handlers cannot call paid mutations during an authoritative billing reload', async () => {
  const fixture = pricing({plan:'pro',canonicalPlan:'pro',canonicalStatus:'active'});
  // A button may have been rendered just before a billing signal starts a reload.
  fixture.setView({loading:true});
  const buttons = elements(fixture.render()).filter(node => node.type === 'Button' && node.props.onClick);
  for (const button of buttons) await button.props.onClick();
  assert.deepEqual(fixture.calls,[]);
});

test('Family upgrade failure copy mentions only an authoritative valid AI Pack', () => {
  const {helpers} = pricing();
  assert.equal(helpers.familyUpgradeFailureMessage('payment_failed',false),
    'The Family upgrade payment failed. Your Pro plan remains active.');
  assert.equal(helpers.familyUpgradeFailureMessage('payment_failed',true),
    'The Family upgrade payment failed. Your Pro plan and AI Pack remain active.');
  for (const failure of ['payment_expired','request_failed']) {
    assert.doesNotMatch(helpers.familyUpgradeFailureMessage(failure,false),/AI Pack/);
    assert.match(helpers.familyUpgradeFailureMessage(failure,true),/AI Pack remain active/);
  }
});
