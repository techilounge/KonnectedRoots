const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const load = file => {
  const mod = {exports:{}};
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  new Function('require','module','exports',code)(require,mod,mod.exports);
  return mod.exports;
};
const {createBillingNotificationTracker} = load('src/lib/billing/notificationTracker.ts');
const end = 2_000_000_000_000;
const free = {
  plan:'free',canonicalStatus:'none',effectivePaidEntitlement:false,paymentAttentionRequired:false,
  aiPackEntitlementValid:false,aiPackItemExists:false,aiPackCancelAtPeriodEnd:false,aiPackPaidThrough:null,
  aiPackRemovalPending:false,aiPackResumePending:false,planChangeStatus:'none',scheduledDowngrade:null,
  billingScheduleCleanupRequired:false,billingScheduleReleaseConfirmed:false,
};
const paid = plan => ({...free,plan,canonicalStatus:'active',effectivePaidEntitlement:true});
const pack = {...paid('pro'),aiPackEntitlementValid:true,aiPackItemExists:true,aiPackPaidThrough:end};
const scheduled = {...paid('family'),scheduledDowngrade:{scheduledPlan:'pro',scheduledInterval:'month',scheduledChangeAt:end,scheduledChangeType:'downgrade',scheduledChangeStatus:'scheduled'}};
function fixture(initial=free,restored=null) {
  let time=100_000,saved=null;
  const notices=[];
  const tracker=createBillingNotificationTracker({emit:n=>notices.push(n),now:()=>time,restored,save:s=>saved=structuredClone(s)});
  const observe=(v,started=time)=>tracker.observe('synthetic_owner',v,started);
  if(initial) observe(initial);
  return {tracker,notices,observe,tick:(n=1)=>time+=n,get saved(){return saved;},
    start(action,withPack=false){const id=tracker.begin('synthetic_owner',action,withPack);time++;tracker.accepted(id);return id;}};
}

for(const [action,plan,title] of [['pro_checkout','pro','Welcome to Pro'],['family_checkout','family','Family plan activated'],['family_upgrade','family','Family plan activated']]) {
  test(`authoritative ${action} announces activation once, never on callable acceptance`,()=>{
    const f=fixture(action==='family_upgrade'?paid('pro'):free);f.start(action);
    assert.deepEqual(f.notices,[]);f.observe(action==='family_upgrade'?{...paid('pro'),planChangeStatus:'pending'}:free);
    assert.deepEqual(f.notices,[]);f.tick();f.observe(paid(plan));f.observe(paid(plan));
    assert.equal(f.notices.length,1);assert.equal(f.notices[0].title,title);assert.equal(f.notices[0].variant,'success');
    assert.equal(f.tracker.getProgress(),null);
  });
}
test('AI Pack activation waits for entitlement and emits once despite repeated billing signals',()=>{
  const f=fixture(paid('pro'));f.start('add_ai_pack');f.observe({...paid('pro'),aiPackItemExists:true});assert.deepEqual(f.notices,[]);
  f.tick();f.observe(pack);f.observe(pack);assert.equal(f.notices.length,1);assert.equal(f.notices[0].title,'AI Pack activated');
  assert.equal(f.notices[0].description,'1,000 additional AI actions have been added to your plan.');
});
test('initial checkout with AI Pack independently confirms plan then paid Pack',()=>{
  const f=fixture();f.start('pro_checkout',true);f.observe(paid('pro'));assert.deepEqual(f.notices.map(n=>n.title),['Welcome to Pro']);
  assert.deepEqual(f.tracker.getProgress().remaining,['add_ai_pack']);f.observe(pack);f.observe(pack);
  assert.deepEqual(f.notices.map(n=>n.title),['Welcome to Pro','AI Pack activated']);
});
test('scheduled downgrade waits for authoritative schedule and uses its date',()=>{
  const f=fixture(paid('family'));f.start('schedule_downgrade');f.observe(paid('family'));assert.deepEqual(f.notices,[]);
  f.observe(scheduled);f.observe(scheduled);assert.equal(f.notices.length,1);assert.equal(f.notices[0].title,'Downgrade scheduled');
  const date=new Date(end).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  assert.equal(f.notices[0].description,`Your Family plan remains active until ${date}. Pro begins on ${date}.`);
});
test('Keep Family requires confirmed Stripe schedule release, not just cleared scheduled fields',()=>{
  const f=fixture(scheduled);f.start('keep_family');f.observe(paid('family'));assert.deepEqual(f.notices,[]);
  f.observe({...paid('family'),billingScheduleReleaseConfirmed:true});f.observe({...paid('family'),billingScheduleReleaseConfirmed:true});
  assert.equal(f.notices.length,1);assert.equal(f.notices[0].title,'Family plan retained');
});
test('AI Pack stop renewal preserves paid-through date and waits for completed removal',()=>{
  const f=fixture(pack);f.start('stop_ai_pack');f.observe({...pack,aiPackCancelAtPeriodEnd:true,aiPackRemovalPending:true});assert.deepEqual(f.notices,[]);
  f.observe({...pack,aiPackCancelAtPeriodEnd:true,aiPackItemExists:false});assert.equal(f.notices[0].title,'AI Pack renewal stopped');
  assert.match(f.notices[0].description,/You can continue using your AI Pack through/);
});
test('AI Pack resume waits for authoritative renewing item and no pending resume',()=>{
  const f=fixture({...pack,aiPackCancelAtPeriodEnd:true,aiPackItemExists:false});f.start('resume_ai_pack');
  f.observe({...pack,aiPackResumePending:true});assert.deepEqual(f.notices,[]);f.observe(pack);f.observe(pack);
  assert.equal(f.notices.length,1);assert.equal(f.notices[0].title,'AI Pack renewal resumed');
});
for(const plan of ['pro','family']) test(`${plan} past_due to active announces restored payment once`,()=>{
  const f=fixture({...free,canonicalStatus:'past_due',paymentAttentionRequired:true});f.observe(paid(plan));f.observe(paid(plan));
  assert.deepEqual(f.notices.map(n=>n.title),['Payment received']);
});
test('definitively rejected request produces only static error feedback',()=>{
  const f=fixture(paid('family'));const id=f.tracker.begin('synthetic_owner','schedule_downgrade');f.tracker.failed(id,true);f.observe(paid('family'));
  assert.equal(f.notices.length,1);assert.equal(f.notices[0].variant,'destructive');assert.equal(f.tracker.getProgress(),null);
  assert.doesNotMatch(JSON.stringify(f.notices),/sub_|cus_|Firebase|Stripe|stack/);
});
test('transport error stays safely delayed and can later confirm a successful mutation',()=>{
  const f=fixture(paid('family'));const id=f.tracker.begin('synthetic_owner','schedule_downgrade');f.tracker.failed(id);
  assert.equal(f.tracker.getProgress().phase,'delayed');assert.equal(f.notices[0].variant,'destructive');
  f.observe(paid('family'));assert.equal(f.notices.length,1);f.observe(scheduled);assert.equal(f.notices[1].title,'Downgrade scheduled');
});
test('45 second delay offers confirmation state without false success or failure',()=>{
  const f=fixture();f.start('pro_checkout');f.tick(45_000);f.tracker.delay();f.observe(free);
  assert.equal(f.tracker.getProgress().phase,'delayed');assert.deepEqual(f.notices,[]);
  assert.equal(f.tracker.begin('synthetic_owner','pro_checkout'),null);f.observe(paid('pro'));assert.equal(f.notices.length,1);
});
test('response from a read started before request acceptance cannot confirm an action',()=>{
  const f=fixture(paid('family'));f.start('schedule_downgrade');f.observe(scheduled,100_000);assert.deepEqual(f.notices,[]);
  f.tick();f.observe(scheduled);assert.equal(f.notices.length,1);
});
test('same-millisecond dispatch marks strictly order stale reads and acceptance',()=>{
  const {markBillingReadBoundary}=load('src/lib/billing/notificationFreshness.ts');
  const first=markBillingReadBoundary();const second=markBillingReadBoundary();assert.ok(second>first);
});
test('normal initial paid view, routine usage signals and Portal return do not claim a purchase or payment-method update',()=>{
  const f=fixture(paid('pro'));for(let i=0;i<5;i++)f.observe({...paid('pro'),usage:{aiActionsUsed:i}});
  assert.deepEqual(f.notices,[]);
});
test('current-session major activation is announced without a browser request and duplicates stay quiet',()=>{
  const f=fixture();f.observe(paid('pro'));f.observe(paid('pro'));assert.deepEqual(f.notices.map(n=>n.title),['Welcome to Pro']);
});
test('Family to Pro waits for confirmed detached release and emits one effective transition',()=>{
  const f=fixture(scheduled);f.observe({...paid('pro'),billingScheduleCleanupRequired:true});assert.deepEqual(f.notices,[]);
  f.observe({...paid('pro'),billingScheduleReleaseConfirmed:true});f.observe({...paid('pro'),billingScheduleReleaseConfirmed:true});
  assert.deepEqual(f.notices.map(n=>n.title),['Your plan changed to Pro']);
});
test('already-Pro specimen stays quiet when later cleanup confirms release',()=>{
  const f=fixture({...paid('pro'),billingScheduleCleanupRequired:true});f.observe({...paid('pro'),billingScheduleReleaseConfirmed:true});assert.deepEqual(f.notices,[]);
});
test('session persistence confirms checkout after redirect once and a reload is quiet',()=>{
  const f=fixture();f.start('pro_checkout');const redirected=fixture(null,f.saved);redirected.tick(10);redirected.observe(paid('pro'));
  assert.deepEqual(redirected.notices.map(n=>n.title),['Welcome to Pro']);const reloaded=fixture(paid('pro'),redirected.saved);assert.deepEqual(reloaded.notices,[]);
  assert.doesNotMatch(JSON.stringify(redirected.saved),/token|email|price_|cus_|sub_|invoice/i);
});
test('intent started before global observer baseline still confirms after checkout redirect',()=>{
  const f=fixture(null);f.start('pro_checkout');assert.equal(f.saved.last,null);
  const redirected=fixture(null,f.saved);redirected.tick(10);redirected.observe(paid('pro'));
  assert.deepEqual(redirected.notices.map(n=>n.title),['Welcome to Pro']);
});
test('signed-out reset and account switch cannot leak the preceding account notification',()=>{
  const f=fixture();f.start('pro_checkout');f.tracker.observe('another_synthetic_owner',paid('pro'));assert.deepEqual(f.notices,[]);
  f.tracker.reset();f.observe(paid('pro'));assert.deepEqual(f.notices,[]);assert.equal(f.tracker.getProgress(),null);
});
test('payment-attention guard blocks intents while authoritative failed upgrade produces error only',()=>{
  const f=fixture({...free,canonicalStatus:'past_due',paymentAttentionRequired:true});assert.equal(f.tracker.begin('synthetic_owner','family_upgrade'),null);
  assert.equal(f.notices[0].title,'Action unavailable');
  const upgrade=fixture(paid('pro'));upgrade.start('family_upgrade');upgrade.observe({...paid('pro'),planChangeStatus:'failed'});
  assert.equal(upgrade.notices.length,1);assert.equal(upgrade.notices[0].variant,'destructive');assert.equal(upgrade.tracker.getProgress(),null);
});

test('checkout cancel return ends feedback quietly without granting a plan or abandoning other actions',()=>{
  const f=fixture();f.start('pro_checkout');f.tracker.abandonCheckout();assert.equal(f.tracker.getProgress(),null);assert.deepEqual(f.notices,[]);
  const downgrade=fixture(paid('family'));downgrade.start('schedule_downgrade');downgrade.tracker.abandonCheckout();
  assert.equal(downgrade.tracker.getProgress().action,'schedule_downgrade');assert.deepEqual(downgrade.notices,[]);
});
