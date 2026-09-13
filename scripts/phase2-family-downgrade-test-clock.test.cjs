const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
let helpers;
test('Family downgrade helper stages import without running a Stripe/Firebase operation',async()=>{helpers=await import('./phase2-family-downgrade-test-clock.mjs');assert.deepEqual(helpers.ACTIONS,['create-customer','create-family','status','advance-step','finalize-renewal']);});
test('completed lifecycle accounts and unconfirmed advances are refused',()=>{
  for(const email of ['phase2-billing@example.test','phase2-payment-failure@example.test','phase2-pastdue@example.test'])assert.throws(()=>helpers.parseArgs(['create-customer','--email',email]));
  assert.throws(()=>helpers.parseArgs(['advance-step','--email','phase2-family-downgrade@example.test','--clock','clock_fixture','--customer','cus_fixture','--subscription','sub_fixture','--family','family_fixture']));
});
function scenario(interval='month',pack=false){
  const prices={family_month:'price_family_month',family_year:'price_family_year',pro_month:'price_pro_month',pro_year:'price_pro_year',pack:'price_pack'};
  const args={email:'phase2-family-downgrade@example.test',clock:'clock_fixture',customer:'cus_fixture',subscription:'sub_fixture',family:'family_fixture'};
  const uid='synthetic',clock={id:args.clock,livemode:false,status:'ready',frozen_time:1000};
  const customer={id:args.customer,livemode:false,email:args.email,test_clock:clock.id,metadata:{kr_uid:uid,kr_test_scenario:helpers.SCENARIO}};
  const subscription={id:args.subscription,livemode:false,customer:customer.id,status:'active',schedule:'sub_sched_fixture',metadata:{kr_uid:uid,kr_test_scenario:helpers.SCENARIO,kr_family_id:args.family},items:{data:[{quantity:1,current_period_end:40_000_000,price:{id:prices[`family_${interval}`],metadata:{kr_plan:'family'},recurring:{interval}}},...(pack?[{quantity:1,price:{id:prices.pack,metadata:{kr_addon:'ai_pack'}}}]:[])]}};
  const profile={billing:{stripeCustomerId:customer.id,stripeSubscriptionId:subscription.id},family:{familyId:args.family}};
  const schedule={id:subscription.schedule,status:'active',customer:customer.id,subscription:subscription.id,metadata:{kr_uid:uid,kr_change:'family_to_pro',kr_subscription_id:subscription.id},phases:[{}, {start_date:40_000_000,proration_behavior:'none',items:[{price:prices[`pro_${interval}`],quantity:1},...(pack?[{price:prices.pack,quantity:1}]:[])]}]};
  return {prices,args,uid,clock,customer,subscription,profile,schedule};
}
test('scope validation rejects live mode, wrong owner/customer/subscription/workspace and arbitrary Prices',()=>{
  const s=scenario();helpers.validateScope(s);
  for(const mutate of [v=>v.customer.livemode=true,v=>v.customer.metadata.kr_uid='other',v=>v.customer.test_clock='clock_other',v=>v.subscription.customer='cus_other',v=>v.profile.family.familyId='other',v=>v.subscription.items.data[0].price.id='price_unknown']){const copy=structuredClone(s);mutate(copy);assert.throws(()=>helpers.validateScope(copy));}
});
test('advance requires exact schedule ownership, boundary, and preserved AI Pack item',()=>{
  const s=scenario('month',true);assert.equal(helpers.advanceTarget(s),40_000_001);
  for(const mutate of [v=>v.schedule.metadata.kr_uid='other',v=>v.schedule.phases[1].start_date++,v=>v.schedule.phases[1].items.pop(),v=>v.subscription.status='past_due',v=>v.clock.status='advancing']){const copy=structuredClone(s);mutate(copy);assert.throws(()=>helpers.advanceTarget(copy));}
});
test('mixed yearly base/monthly AI Pack advancement is bounded to one explicit 28-day step',()=>{
  const s=scenario('year',true);assert.equal(helpers.advanceTarget(s),1000+28*86400);assert.equal(helpers.advanceTarget(scenario('year')),40_000_001);
});
test('lifecycle assertion harness remains read-only with all downgrade modes',()=>{
  const src=fs.readFileSync('scripts/phase2-lifecycle.ps1','utf8');assert.doesNotMatch(src,/-Method\s+(Post|Put|Patch|Delete)|test_clocks.+advance|firebase\s+deploy/i);
  for(const name of ['FamilyDowngradeScheduled','FamilyDowngradeCanceled','ProAfterFamilyDowngrade','ProAfterFamilyDowngradeWithAIPack'])assert.ok(src.includes(`"${name}"`));
});

function partialScenario() {
  const s=scenario();const end=2_000_000_000,start=end-2_592_000;
  s.subscription.items.data[0].current_period_end=end;
  s.profile.billing={...s.profile.billing,plan:'family',status:'active',basePlanChangeOperationId:'trusted',basePlanChangeOperation:'schedule'};
  s.schedule={...s.schedule,livemode:false,metadata:{},end_behavior:'release',current_phase:{start_date:start,end_date:end},
    phases:[{start_date:start,end_date:end,items:[{price:s.prices.family_month,quantity:1}],metadata:{},automatic_tax:{enabled:false,disabled_reason:null,liability:null},add_invoice_items:[]}]};
  s.family={ownerUid:s.uid,plan:{plan:'family',status:'active',stripeCustomerId:s.customer.id,stripeSubscriptionId:s.subscription.id}};
  const creation=structuredClone(s.schedule);
  s.stripe={events:{list:async()=>({data:[{id:'evt_fixture',livemode:false,request:{idempotency_key:`kr-family-pro-create:${s.subscription.id}:trusted`},data:{object:creation}}],has_more:false})},
    prices:{retrieve:async()=>({livemode:false,active:true,currency:'usd',metadata:{kr_plan:'pro'},recurring:{interval:'month',interval_count:1},unit_amount:599})}};
  return s;
}
test('read-only status proves exact legacy partial creation and exposes every retry gate without a mutation API',async()=>{
  const s=partialScenario(),status=await helpers.scheduleStatus(s);
  assert.equal(status.scheduleId,s.schedule.id);assert.equal(status.scheduleStatus,'active');assert.equal(status.scheduleOwnershipVerified,true);
  assert.equal(status.currentPhasePlan,'family');assert.equal(status.currentPhaseInterval,'month');assert.equal(status.futurePhaseCount,0);
  for(const key of ['futurePhasePlan','futurePhaseInterval','futurePhaseStart'])assert.equal(status[key],null);
  assert.equal(status.partialScheduleDetected,true);assert.equal(status.partialScheduleRepairable,true);assert.equal(status.scheduledDowngradeVerified,false);assert.equal(status.safeToRetryScheduling,'YES');
});
test('read-only status refuses missing creation evidence and externally edited schedule settings',async()=>{
  const s=partialScenario();s.stripe.events.list=async()=>({data:[],has_more:false});let status=await helpers.scheduleStatus(s);assert.equal(status.safeToRetryScheduling,'NO');assert.equal(status.scheduleOwnershipVerified,false);
  const edited=partialScenario();edited.schedule.phases[0].automatic_tax.enabled=true;status=await helpers.scheduleStatus(edited);assert.equal(status.partialScheduleDetected,true);assert.equal(status.partialScheduleRepairable,false);
});
test('read-only status refuses unreconciled authoritative state, inactive target catalog and an advancing clock',async()=>{
  for(const change of [s=>s.profile.billing.status='past_due',s=>s.family.plan.stripeSubscriptionId='sub_other',s=>s.clock.status='advancing',s=>s.stripe.prices.retrieve=async()=>({livemode:false,active:false,metadata:{kr_plan:'pro'}})]){
    const s=partialScenario();change(s);const status=await helpers.scheduleStatus(s);assert.equal(status.safeToRetryScheduling,'NO');
  }
});

function appliedScenario(interval='month') {
  const s=partialScenario();
  s.args.family=`${helpers.SCENARIO}_${s.uid}`;s.args.interval=interval;
  s.profile.family.familyId=s.args.family;s.subscription.metadata.kr_family_id=s.args.family;
  s.customer.metadata.kr_family_id=s.args.family;
  const boundary=2_000_000_000,start=boundary-2_592_000,end=boundary+2_592_000;
  s.subscription.items.data[0].price={id:s.prices[`pro_${interval}`],livemode:false,metadata:{kr_plan:'pro'},recurring:{interval,interval_count:1}};
  s.subscription.items.data[0].current_period_end=end;
  s.schedule={...s.schedule,metadata:{kr_uid:s.uid,kr_subscription_id:s.subscription.id,kr_family_id:s.args.family,kr_change:'family_to_pro',kr_operation_id:'trusted'},
    current_phase:{start_date:boundary,end_date:end},phases:[
      {start_date:start,end_date:boundary,items:[{price:s.prices[`family_${interval}`],quantity:1}],metadata:{kr_plan:'family',kr_interval:interval},proration_behavior:'none'},
      {start_date:boundary,end_date:end,items:[{price:s.prices[`pro_${interval}`],quantity:1}],metadata:{kr_plan:'pro',kr_interval:interval},proration_behavior:'none'},
    ]};
  s.profile.billing={...s.profile.billing,plan:'pro',status:'active',basePlanChangeOperationId:null,
    basePlanScheduleRecovery:{scheduleId:s.schedule.id,operationId:'trusted',uid:s.uid,subscriptionId:s.subscription.id,customerId:s.customer.id,familyId:s.args.family,livemode:false}};
  s.family={ownerUid:s.uid,plan:{plan:'pro',status:'active',paidSeatEntitlementActive:false,stripeCustomerId:s.customer.id,stripeSubscriptionId:s.subscription.id}};
  const reads=[];
  s.stripe={prices:{retrieve:async id=>{reads.push(id);const plan=id===s.prices[`pro_${interval}`]?'pro':'family';return {
    id,livemode:false,active:true,currency:'usd',metadata:{kr_plan:plan},recurring:{interval,interval_count:1},
    unit_amount:plan==='pro'?interval==='month'?599:5999:interval==='month'?999:9900};}}};
  s.reads=reads;return s;
}

function renewalScenario(){
  const s=appliedScenario(),boundary=s.schedule.current_phase.start_date,end=s.schedule.current_phase.end_date;
  s.clock.frozen_time=boundary+1;s.subscription.items.data[0].quantity=1;s.subscription.items.data[0].current_period_start=boundary;
  const pack={id:'price_pack',livemode:false,active:true,metadata:{kr_addon:'ai_pack'},recurring:{interval:'month',interval_count:1},currency:'usd',unit_amount:399};
  s.subscription.items.data.push({id:'si_pack',quantity:1,current_period_start:boundary,current_period_end:end,price:pack});
  for(const phase of s.schedule.phases)phase.items.push({price:pack.id,quantity:1});
  s.profile.billing={...s.profile.billing,aiPackItemExists:true,aiPackStatus:'active',aiPackPaidThrough:boundary*1000,addons:{aiPack:true}};
  s.args.action='finalize-renewal';s.args.confirm='yes';s.args.invoice='in_renewal';
  const invoice={id:s.args.invoice,livemode:false,customer:s.customer.id,parent:{subscription_details:{subscription:s.subscription.id}},billing_reason:'subscription_cycle',status:'draft',attempted:false,attempt_count:0,amount_due:998,amount_remaining:998,amount_paid:0,auto_advance:true,collection_method:'charge_automatically',lines:{has_more:false,data:[{amount:599,quantity:1,pricing:{price_details:{price:s.prices.pro_month}},period:{start:boundary,end}},{amount:399,quantity:1,pricing:{price_details:{price:s.prices.pack}},period:{start:boundary,end}}]}};
  const priceRead=s.stripe.prices.retrieve;s.stripe.prices.retrieve=async id=>id===pack.id?pack:priceRead(id);
  s.posts=[];s.stripe.invoices={retrieve:async()=>structuredClone(invoice),finalizeInvoice:async(id,input,opts)=>{s.posts.push({id,input,opts});return {id,status:'open'};}};
  return {...s,invoice,boundary,end};
}
test('draft-window reporting distinguishes recurring item from expired paid-through and reports Pro/200',()=>{
  const s=renewalScenario();const result=helpers.renewalPaymentState({subscription:s.subscription,billing:s.profile.billing,invoices:[s.invoice],now:s.clock.frozen_time*1000,packPrice:s.prices.pack});
  assert.equal(result.aiPackRecurringItemExists,true);assert.equal(result.aiPackCurrentPaidThroughValid,false);assert.equal(result.aiPackRenewalPaymentPending,true);assert.equal(result.aiPackEntitlementValid,false);assert.equal(result.effectiveAIAllowance,200);assert.equal(result.renewalInvoice.status,'draft');assert.equal(result.renewalInvoice.amountRemaining,998);
});
test('explicit finalization only finalizes the verified invoice, never pays/advances/releases/writes DB',async()=>{
  const s=renewalScenario(),snapshot=structuredClone(s.invoice);const result=await helpers.finalizeRenewal(s);
  assert.equal(result.status,'open');assert.deepEqual(s.posts,[{id:'in_renewal',input:{auto_advance:true},opts:{idempotencyKey:'kr-family-pro-finalize:in_renewal'}}]);assert.deepEqual(s.invoice,snapshot);
  assert.equal(s.subscription.schedule,s.schedule.id);assert.equal(s.profile.billing.aiPackPaidThrough,s.boundary*1000);
});
for(const [name,change]of [
  ['confirmation',s=>s.args.confirm='no'],['invoice ID',s=>s.args.invoice='in_other'],['customer',s=>s.invoice.customer='cus_other'],['subscription',s=>s.invoice.parent.subscription_details.subscription='sub_other'],['invoice mode',s=>s.invoice.livemode=true],['paid',s=>s.invoice.status='paid'],['open',s=>s.invoice.status='open'],['amount',s=>s.invoice.amount_due=999],['attempted',s=>s.invoice.attempted=true],['period',s=>s.invoice.lines.data[1].period.end++],['Pack Price',s=>s.invoice.lines.data[1].pricing.price_details.price='price_other'],['future phase',s=>s.schedule.phases.push(s.schedule.phases[1])],['clock advancing',s=>s.clock.status='advancing'],['pending update',s=>s.subscription.pending_update={}],['wrong workspace',s=>s.family.ownerUid='other'],['wrong quantity',s=>s.subscription.items.data[1].quantity=2],['line pagination',s=>s.invoice.lines.has_more=true],['catalog',s=>s.stripe.prices.retrieve=async()=>({active:false})]
])test(`finalize-renewal refuses ${name} before any POST`,async()=>{const s=renewalScenario();change(s);await assert.rejects(helpers.finalizeRenewal(s));assert.equal(s.posts.length,0);});
test('finalize-renewal parser requires exact invoice/confirmation and status rejects invoice mutation selection',()=>{
  const scope=['--email','phase2-family-downgrade+pack@example.test','--clock','clock_test','--customer','cus_test','--subscription','sub_test','--family','family_test'];
  assert.throws(()=>helpers.parseArgs(['finalize-renewal',...scope]));assert.throws(()=>helpers.parseArgs(['status',...scope,'--invoice','in_test']));
  assert.equal(helpers.parseArgs(['finalize-renewal',...scope,'--invoice','in_test','--confirm','yes']).action,'finalize-renewal');
});
for(const interval of ['month','year'])test(`read-only ${interval} applied-Pro gate proves full scope/history/provenance and reports YES without a mutation API`,async()=>{
  const s=appliedScenario(interval),status=await helpers.scheduleStatus(s);
  assert.equal(status.scheduleReconciliationStatus,'applied_pro');assert.equal(status.scheduleOwnershipVerified,true);
  assert.equal(status.appliedDowngradeDetected,true);assert.equal(status.appliedScheduleReleaseEligible,true);
  assert.equal(status.scheduleReleaseNeeded,true);assert.equal(status.safeToReconcileAppliedSchedule,'YES');
  assert.equal(status.futurePhaseCount,0);assert.deepEqual(s.reads.sort(),[s.prices[`pro_${interval}`],s.prices[`family_${interval}`]].sort());
});
const unsafeApplied={
  'external/unknown metadata':s=>s.schedule.metadata.kr_change='external',
  'future phase':s=>s.schedule.phases.push({...s.schedule.phases[1],start_date:s.schedule.phases[1].end_date,end_date:s.schedule.phases[1].end_date+100}),
  'wrong customer':s=>s.args.customer='cus_other',
  'wrong subscription':s=>s.args.subscription='sub_other',
  'wrong workspace':s=>s.family.ownerUid='different_owner',
  'wrong UID':s=>s.uid='different_uid',
  'wrong Price':s=>s.subscription.items.data[0].price.id='price_unexpected',
  'wrong interval':s=>s.args.interval='year',
  'live subscription':s=>s.subscription.livemode=true,
  'live schedule':s=>s.schedule.livemode=true,
  'live Price':s=>s.subscription.items.data[0].price.livemode=true,
  'unattached schedule':s=>s.subscription.schedule='sub_sched_other',
  'pending update':s=>s.subscription.pending_update={expires_at:1234},
  'payment attention':s=>s.subscription.status='past_due',
  'stale authoritative payment attention':s=>s.profile.billing.status='past_due',
  'unexpected base quantity':s=>s.subscription.items.data[0].quantity=2,
  'zero base quantity':s=>s.subscription.items.data[0].quantity=0,
  'zero historical quantity':s=>s.schedule.phases[0].items[0].quantity=0,
  'unexpected item':s=>s.subscription.items.data.push({quantity:1,price:{id:'price_other',livemode:false,metadata:{}}}),
  'altered Family history':s=>s.schedule.phases[0].items[0].price=s.prices.pro_month,
  'missing operation provenance':s=>delete s.schedule.metadata.kr_operation_id,
  'missing receipt':s=>delete s.profile.billing.basePlanScheduleRecovery,
  'wrong receipt subscription':s=>s.profile.billing.basePlanScheduleRecovery.subscriptionId='sub_other',
  'wrong receipt operation':s=>s.profile.billing.basePlanScheduleRecovery.operationId='different_operation',
  'active Family seats':s=>s.family.plan.paidSeatEntitlementActive=true,
  'wrong retained workspace subscription':s=>s.family.plan.stripeSubscriptionId='sub_other',
  'advancing clock':s=>s.clock.status='advancing',
  'pending AI Pack':s=>s.profile.billing.aiPackOperationId='pending_operation',
};
for(const [name,mutate] of Object.entries(unsafeApplied))test(`applied-Pro release refuses ${name}`,async()=>{
  const s=appliedScenario();mutate(s);const status=await helpers.scheduleStatus(s);
  assert.equal(status.appliedScheduleReleaseEligible,false);assert.equal(status.safeToReconcileAppliedSchedule,'NO');
});
test('applied-Pro gate closes on catalog mismatch or unavailable read',async()=>{
  for(const mutation of [price=>({...price,active:false}),price=>({...price,currency:'eur'}),price=>({...price,unit_amount:1}),price=>({...price,livemode:true})]){
    const s=appliedScenario(),retrieve=s.stripe.prices.retrieve;s.stripe.prices.retrieve=async id=>mutation(await retrieve(id));
    assert.equal((await helpers.scheduleStatus(s)).safeToReconcileAppliedSchedule,'NO');
  }
  const s=appliedScenario();s.stripe.prices.retrieve=async()=>{throw Error('read unavailable');};
  assert.equal((await helpers.scheduleStatus(s)).safeToReconcileAppliedSchedule,'NO');
});
test('detached release reports no schedule/no release needed and manual gate NO',async()=>{
  const s=appliedScenario();s.subscription.schedule=null;s.schedule=null;const status=await helpers.scheduleStatus(s);
  assert.equal(status.scheduleId,null);assert.equal(status.scheduleStatus,null);assert.equal(status.scheduleReleaseNeeded,false);
  assert.equal(status.appliedDowngradeDetected,false);assert.equal(status.safeToReconcileAppliedSchedule,'NO');
});
