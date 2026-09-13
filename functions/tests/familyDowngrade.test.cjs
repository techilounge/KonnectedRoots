const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../../node_modules/typescript');

// Real callable/reconciler code, an optimistic Firestore double (including
// conflict retries), and a stateful Stripe double. No network/emulator access.
function fixture(options = {}) {
  const interval = options.interval || 'month';
  const end = options.end || 2_000_000_000;
  const logs=[];
  const testProcess={...process,env:options.clock?{...process.env,NODE_ENV:'test',FUNCTIONS_EMULATOR:'true',GCLOUD_PROJECT:'demo-konnectedroots-phase2',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099'}:process.env};
  const prices = {pro_monthly:'price_pro_month',pro_yearly:'price_pro_year',family_monthly:'price_family_month',family_yearly:'price_family_year',ai_pack_monthly:'price_pack'};
  const price = (plan, period = interval) => ({id:prices[`${plan}_${period === 'month' ? 'monthly' : 'yearly'}`],livemode:false,metadata:{kr_plan:plan},active:true,currency:'usd',unit_amount:plan === 'pro' ? period === 'month' ? 599 : 5999 : period === 'month' ? 999 : 9900,recurring:{interval:period,interval_count:1}});
  const pack = {id:'price_pack',livemode:false,metadata:{kr_addon:'ai_pack'},recurring:{interval:'month',interval_count:1}};
  const subscription = {id:'sub_fixture',customer:'cus_fixture',livemode:false,status:'active',metadata:{kr_uid:'owner',kr_family_id:'family_fixture',kr_plan:'family',kr_interval:interval},schedule:null,cancel_at:null,cancel_at_period_end:false,
    items:{data:[{id:'si_base',quantity:1,current_period_start:end-100_000,current_period_end:end,price:price('family')},
      ...(options.pack === 'recurring' || options.pack === 'pending' ? [{id:'si_pack',quantity:1,current_period_end:end,price:pack}] : [])]}};
  const customer = {id:'cus_fixture',livemode:false,metadata:{kr_uid:'owner',kr_family_id:'family_fixture'}};
  if(options.clock){customer.test_clock='clock_fixture';customer.metadata.kr_test_scenario='phase2_family_downgrade';subscription.metadata.kr_test_scenario='phase2_family_downgrade';}
  const billing = {plan:'family',status:'active',interval,currentPeriodEnd:end*1000,stripeSubscriptionId:subscription.id,stripeCustomerId:customer.id,
    aiPackItemExists:options.pack === 'recurring',aiPackStatus:['recurring','prepaid'].includes(options.pack) ? 'active' : options.pack === 'pending' ? 'pending' : 'none',
    aiPackPaidThrough:['recurring','prepaid'].includes(options.pack) ? (end+200_000)*1000 : null,
    aiPackCancelAtPeriodEnd:options.pack === 'prepaid',aiPackScheduledRemovalAt:options.pack === 'prepaid' ? (end+200_000)*1000 : null,
    addons:{aiPack:['recurring','prepaid'].includes(options.pack)},...options.billing};
  const monthKey = new Date().toISOString().slice(0,7);
  const initial = {
    'users/owner':{billing,family:{familyId:'family_fixture',role:'owner'},usage:{monthKey,aiActionsUsed:3,storageUsedBytes:20}},
    'users/member':{billing:{plan:'free',status:'none'},family:{familyId:'family_fixture',role:'member'},usage:{monthKey,aiActionsUsed:0}},
    'families/family_fixture':{ownerUid:'owner',createdAt:123,plan:{...billing,seatLimit:6},usage:{monthKey,aiActionsUsed:17,storageUsedBytes:60*1024**3}},
    'families/family_fixture/seats/owner':{uid:'owner',status:'active'},
    'families/family_fixture/seats/member':{uid:'member',status:'active'},
    'trees/synthetic':{ownerId:'owner',people:[{name:'Synthetic Person'}],collaborators:Object.fromEntries(Array.from({length:12},(_,i)=>[`member${i}`,'editor']))},
    'invitations/synthetic':{status:'pending'},
  };
  const clone = structuredClone;
  const docs = new Map(Object.entries(initial).map(([key,value]) => [key,{value:clone(value),version:0}]));
  const merge = (old,value) => {const next=clone(old || {});for(const [key,v] of Object.entries(value)) {if(key.includes('.')){const parts=key.split('.');let cursor=next;for(const part of parts.slice(0,-1))cursor=cursor[part] ||= {};cursor[parts.at(-1)]=clone(v);}else next[key]=v && typeof v === 'object' && !Array.isArray(v) ? merge(next[key],v) : clone(v);}return next;};
  const ref = key => ({key,id:key.split('/').at(-1),get:async()=>{const entry=docs.get(key),value=clone(entry?.value);return {exists:Boolean(entry),version:entry?.version,data:()=>clone(value)};},
    set:async(value,opts)=>{const old=docs.get(key);docs.set(key,{value:opts?.merge?merge(old?.value,value):clone(value),version:(old?.version || 0)+1});},
    update:async(value)=>ref(key).set(value,{merge:true}),collection:name=>({doc:id=>ref(`${key}/${name}/${id}`)})});
  let retries=0;
  const db={collection:name=>({doc:id=>ref(`${name}/${id}`),where:(field,op,value)=>({limit:()=>({query:true,name,field,value})})}),runTransaction:async callback=>{
    for(let attempt=0;attempt<20;attempt++) {
      const reads=new Map();const writes=[];
      if(options.transactionFailure?.()) {const error=new Error('Synthetic lock contention');error.code=10;throw error;}
      const result=await callback({get:async r=>{if(r.query){const matching=[...docs].filter(([key,e])=>key.startsWith(r.name+'/') && e.value[r.field]===r.value);for(const [key,e]of matching)reads.set(key,e.version);return {empty:!matching.length};}const snap=await r.get();reads.set(r.key,snap.version);return snap;},set:(...args)=>writes.push(args),update:(r,v)=>writes.push([r,v,{merge:true}]),create:(...args)=>writes.push(args)});
      if([...reads].some(([key,version])=>docs.get(key)?.version!==version)){retries++;continue;}
      // Commit synchronously as a unit.
      for(const [r,v,o] of writes){const old=docs.get(r.key);docs.set(r.key,{value:o?.merge?merge(old?.value,v):clone(v),version:(old?.version || 0)+1});}
      return result;
    }throw Error('Too many conflicts');
  }};
  const schedules=new Map(),keys=new Map(),calls=[],creationEvents=[];
  let sequence=0,event,failConfigure=options.failConfigure || 0,failCreateResponse=options.failCreateResponse || 0;
  const readSubscription=async()=>{
    const observed=clone(subscription);
    if(options.onReadSubscription) await options.onReadSubscription({subscription,observed});
    return observed;
  };
  class Stripe {constructor(){
    this.testHelpers={testClocks:{retrieve:async()=>({id:'clock_fixture',livemode:false,frozen_time:options.clock()})}};
    this.subscriptions={retrieve:readSubscription,update:async(id,input)=>{
      calls.push({method:'subscription.update',id,input:clone(input)});
      subscription.items.data[0].price=price('family',input.items[0].price.endsWith('year')?'year':'month');return clone(subscription);
    }};
    this.customers={retrieve:async()=>clone(customer),update:async(id,input)=>{Object.assign(customer,merge(customer,input));return clone(customer);}};
    this.prices={retrieve:async id=>({...price(id.includes('family')?'family':'pro',id.endsWith('year')?'year':'month'),...options.targetPrice})};
    this.billingPortal={sessions:{create:async()=>({url:'https://example.test/portal'})}};
    this.events={list:async()=>({data:clone(creationEvents),has_more:false})};
    this.subscriptionSchedules={
      retrieve:async id=>{const schedule=schedules.get(id);if(options.onReadSchedule)await options.onReadSchedule(schedule);return clone(schedule);},
      create:async(input,opts)=>{
        calls.push({method:'create',input:clone(input),opts:clone(opts)});
        if(keys.has(opts.idempotencyKey))return clone(schedules.get(keys.get(opts.idempotencyKey)));
        if(subscription.schedule)throw Error('Subscription already has a schedule');
        const id=`sub_sched_${++sequence}`;
        const phase={start_date:subscription.items.data[0].current_period_start,end_date:end,items:subscription.items.data.map(i=>({price:i.price.id,quantity:i.quantity,metadata:{},discounts:[],tax_rates:[],billing_thresholds:null})),metadata:{},discounts:[],automatic_tax:{enabled:false,liability:null,disabled_reason:null},invoice_settings:null,add_invoice_items:[],billing_cycle_anchor:null,proration_behavior:'create_prorations',...options.phaseSettings};
        const schedule={id,livemode:false,subscription:subscription.id,customer:customer.id,status:'active',end_behavior:'release',current_phase:{start_date:phase.start_date,end_date:end},phases:[phase],metadata:{},default_settings:{automatic_tax:{enabled:false,liability:null,disabled_reason:null}}};
        schedules.set(id,schedule);keys.set(opts.idempotencyKey,id);subscription.schedule=id;
        creationEvents.push({id:`evt_creation_${id}`,livemode:false,request:{idempotency_key:opts.idempotencyKey},data:{object:clone(schedule)}});
        if(failCreateResponse-->0)throw Error('Lost create response');
        return clone(schedule);
      },
      update:async(id,input,opts)=>{
        calls.push({method:'update',id,input:clone(input),opts:clone(opts)});
        for(const phase of input.phases || []) {
          assert.equal('disabled_reason' in (phase.automatic_tax || {}),false,'Stripe rejects response-only automatic_tax.disabled_reason');
          assert.ok(!phase.automatic_tax || phase.automatic_tax.liability !== null);
        }
        if(failConfigure-->0)throw Error('Transient configure failure');
        const schedule=schedules.get(id);
        if(keys.has(opts.idempotencyKey))return clone(schedule);
        Object.assign(schedule,clone(input));
        // Real Stripe resolves duration into concrete phase dates.
        schedule.phases[1].end_date=end+(interval==='year'?31_536_000:2_592_000);
        keys.set(opts.idempotencyKey,id);return clone(schedule);
      },
      release:async(id,input,opts)=>{
        calls.push({method:'release',id,input:clone(input),opts:clone(opts)});
        if(keys.has(opts.idempotencyKey))return clone(schedules.get(id));
        if(options.failRelease || options.releaseFailure?.())throw Error('Release unavailable');
        if(options.retainAttachment)return clone(schedules.get(id));
        const schedule=schedules.get(id);schedule.status='released';schedule.released_subscription=schedule.subscription;schedule.subscription=null;subscription.schedule=null;
        keys.set(opts.idempotencyKey,id);
        return clone(schedule);
      },
    };
    this.webhooks={constructEvent:()=>event};
  }}
  class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
  const cache=new Map();
  function load(name){
    const file=path.resolve(__dirname,`../lib/${name}.js`);
    if(cache.has(file))return cache.get(file).exports;
    const mod={exports:{}};cache.set(file,mod);
    new Function('require','module','exports','process',fs.readFileSync(file,'utf8'))(request=>{
      if(request==='firebase-admin')return {apps:[{}],firestore:()=>db};
      if(request==='stripe')return Stripe;
      if(request==='firebase-functions/v2/https')return {onCall:(_,h)=>h,onRequest:(_,h)=>h,HttpsError};
      if(request==='firebase-functions/logger' || request==='firebase-functions/v2')return {info(){},error:(...v)=>logs.push(v),warn(){},logger:{info(){},error:(...v)=>logs.push(v),warn(){}}};
      if(request==='./config')return {functionsEnv:{prices,stripeSecretKey:options.clock?'sk_test_fixture':'fixture',stripeWebhookSecret:'fixture',appUrl:'https://example.test'}};
      if(request==='./sendEmail')return {sendEmail:async()=>{throw Error('No email expected');}};
      if(request==='./emailTemplates')return {};
      if(request.startsWith('./'))return load(request.slice(2));
      return require(request);
    },mod,mod.exports,testProcess);return mod.exports;
  }
  function rootLoad(name,uid){
    const module={exports:{}};
    const target=path.resolve(__dirname,'../..',name);
    const code=ts.transpileModule(fs.readFileSync(target,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
    new Function('require','module','exports','process','fetch',code)(r=>{
      if(r==='server-only')return {};
      if(r==='firebase-admin')return {firestore:{FieldValue:{serverTimestamp:()=> 'SYNTHETIC_TIMESTAMP',increment:v=>v}}};
      if(r==='@/lib/firebase/admin')return {adminDb:db,adminAuth:{verifyIdToken:async()=>({uid})}};
      if(r.startsWith('@/'))return rootLoad(`src/${r.slice(2)}.ts`,uid);
      if(r.startsWith('./'))return rootLoad(path.relative(path.resolve(__dirname,'../..'),path.resolve(path.dirname(target),`${r}.ts`)),uid);
      return require(r);
    },module,module.exports,{...testProcess,env:{...testProcess.env,STRIPE_SECRET_KEY:'sk_test_fixture'}},async url=>({ok:true,json:async()=>String(url).includes('/customers/')?clone(customer):{id:'clock_fixture',livemode:false,frozen_time:options.clock()}}));return module.exports;
  }
  const request={auth:{uid:'owner'},data:{plan:'pro'}};
  return {load,docs,db,subscription,customer,schedules,calls,creationEvents,request,initial,end,price,logs,
    schedule:()=>load('familyDowngrade').scheduleDowngradeToPro(request),
    cancel:()=>load('familyDowngrade').cancelScheduledDowngrade({...request,data:{}}),
    reconcile:(created)=>load('stripeWebhook').reconcileStripeSubscription('owner',subscription.id,created),
    view:(uid='owner')=>rootLoad('src/app/billing/actions.ts',uid).getAuthoritativeBillingView('synthetic-token'),
    debit:(uid='owner')=>rootLoad('src/lib/billing/serverUsage.ts',uid).verifyAuthAndDeductAICredits('synthetic-token','generate_biography'),
    data:key=>clone(docs.get(key)?.value),get retries(){return retries;},
    transition:()=>{subscription.items.data[0].price=price('pro');subscription.items.data[0].current_period_end=end+31_536_000;subscription.metadata.kr_plan='pro';const s=schedules.get(subscription.schedule);if(s)s.current_phase={start_date:end,end_date:end+31_536_000};},
    webhook:async(type,payload,created,id=`evt_${type}_${created}`,expectedStatus=200)=>{
      event={id,type,created,data:{object:clone(payload)}};let status;
      await load('stripeWebhook').stripeWebhook({method:'POST',headers:{'stripe-signature':'fixture'},rawBody:Buffer.from('fixture')},{status(value){status=value;return this;},send(){}});
      assert.equal(status,expectedStatus);
    },
  };
}

async function renewalFixture(options={}) {
  let time=1_791_818_569,releaseFailures=options.releaseFailures || 0;
  const f=fixture({end:time+1,pack:'recurring',clock:()=>time,releaseFailure:()=>releaseFailures-->0,...options,billing:{aiPackPaidThrough:(time+1)*1000,...options.billing}});
  f.docs.set('ai_pack_grants/evt_original',{version:0,value:{invoiceId:'in_original',uid:'owner',paidThrough:f.end*1000,actions:1000}});
  await f.schedule();
  const before=await f.view();assert.equal(before.limits.aiActionsAllowance,1600);
  const savedPack=structuredClone(f.subscription.items.data[1]);
  const transition=()=>{time=f.end+1;f.transition();const end=[...f.schedules.values()][0].phases[1].end_date;
    for(const item of f.subscription.items.data){item.current_period_start=f.end;item.current_period_end=end;}
    f.schedules.get(f.subscription.schedule).current_phase={start_date:f.end,end_date:end};};
  const invoice=(status='draft',id='in_renewal')=>({id,livemode:false,customer:f.customer.id,status,billing_reason:'subscription_cycle',collection_method:'charge_automatically',amount_due:998,amount_remaining:status==='paid'?0:998,amount_paid:status==='paid'?998:0,attempted:status==='paid',attempt_count:status==='paid'?1:0,auto_advance:true,parent:{subscription_details:{subscription:f.subscription.id}},lines:{has_more:false,data:[{amount:599,quantity:1,pricing:{price_details:{price:'price_pro_month'}},period:{start:f.end,end:f.subscription.items.data[0].current_period_end}},{amount:399,quantity:1,pricing:{price_details:{price:'price_pack'}},period:{start:f.end,end:f.subscription.items.data[1].current_period_end}}]}});
  return {...f,transition,invoice,savedPack,setTime:t=>{time=t;},grantCount:()=>[...f.docs.keys()].filter(k=>k.startsWith('ai_pack_grants/')).length};
}

test('real draft-boundary sequence: Family/1600 -> Pro/200 -> paid Pro/1200, exactly one renewal grant',async()=>{
  const f=await renewalFixture();f.transition();const invoice=f.invoice();const snapshot=structuredClone(invoice);
  await f.webhook('customer.subscription.updated',f.subscription,1789229310);
  assert.equal(f.subscription.schedule,null);
  assert.equal((await f.view()).limits.aiActionsAllowance,200);
  assert.equal(f.data('users/owner').billing.aiPackPaidThrough,f.end*1000);
  assert.equal(f.data('users/owner').billing.aiPackStatus,'pending');assert.equal(f.grantCount(),1);
  assert.equal(f.subscription.items.data[1].id,f.savedPack.id);assert.equal(f.subscription.items.data[1].price.id,f.savedPack.price.id);
  assert.deepEqual(invoice,snapshot);assert.equal(f.calls.filter(c=>c.method==='release').length,1);
  assert.deepEqual(f.calls.map(c=>c.method),['create','update','release']); // No invoice/pay/refund API in reconciler.
  for(const type of ['invoice.created','invoice.finalized']){await f.webhook(type,{...invoice,status:type==='invoice.created'?'draft':'open'},1789229311);assert.equal((await f.view()).limits.aiActionsAllowance,200);assert.equal(f.grantCount(),1);}
  await f.webhook('invoice.paid',f.invoice('paid'),1789229312,'evt_paid');
  assert.equal((await f.view()).limits.aiActionsAllowance,1200);assert.equal(f.grantCount(),2);
  assert.equal(f.data('users/owner').billing.aiPackPaidThrough,f.invoice('paid').lines.data[1].period.end*1000);
  await f.webhook('invoice.paid',f.invoice('paid'),1789229312,'evt_paid');
  await f.webhook('invoice.payment_succeeded',f.invoice('paid'),1789229312,'evt_paid_alias');
  await f.webhook('customer.subscription.updated',f.subscription,1789229310,'evt_old_duplicate');
  assert.equal(f.grantCount(),2);assert.equal((await f.view()).limits.aiActionsAllowance,1200);
  assert.equal(f.data('users/owner').usage.aiActionsUsed,3);assert.deepEqual(f.data('families/family_fixture').usage,f.initial['families/family_fixture'].usage);
  assert.equal(f.data('families/family_fixture').plan.paidSeatEntitlementActive,false);
  assert.equal((await f.view('member')).plan,'free');
  for(const key of ['trees/synthetic','invitations/synthetic','families/family_fixture/seats/owner'])assert.deepEqual(f.data(key),f.initial[key]);
  assert.equal(f.data('users/owner').billing.stripeCustomerId,'cus_fixture');assert.equal(f.data('users/owner').billing.stripeSubscriptionId,'sub_fixture');
});

for(const status of ['draft','open','uncollectible','void'])test(`${status} invoice cannot grant or extend Pack even when presented as a paid event`,async()=>{
  const f=await renewalFixture();f.transition();await f.reconcile();const invoice=f.invoice(status);
  await f.webhook('invoice.paid',invoice,1789229311);
  assert.equal(f.grantCount(),1);assert.equal((await f.view()).limits.aiActionsAllowance,200);assert.equal(f.data('users/owner').billing.aiPackPaidThrough,f.end*1000);
});

for(const mutation of [i=>{i.amount_remaining=1;},i=>{i.amount_paid=0;},i=>{i.customer='cus_foreign';},i=>{i.parent.subscription_details.subscription='sub_foreign';},i=>{i.lines.data[1].pricing.price_details.price='price_foreign';},i=>{i.lines.data[1].amount=0;}])test(`malformed/foreign payment evidence fails Pack closed (${mutation.toString()})`,async()=>{
  const f=await renewalFixture();f.transition();await f.reconcile();const invoice=f.invoice('paid');mutation(invoice);
  await f.webhook('invoice.paid',invoice,1789229311);
  assert.equal(f.grantCount(),1);assert.equal((await f.view()).limits.aiActionsAllowance,200);
});

test('payment grant is bounded by its own invoice line, never a later live item period',async()=>{
  const f=await renewalFixture();f.transition();await f.reconcile();const paid=f.invoice('paid');const expected=paid.lines.data[1].period.end*1000;
  f.subscription.items.data[1].current_period_end+=9_000_000;
  await f.webhook('invoice.paid',paid,1789229312);
  assert.equal(f.data('users/owner').billing.aiPackPaidThrough,expected);assert.equal(f.grantCount(),2);
});

test('legacy event-keyed invoice grant remains deduplicated and an older paid invoice cannot shorten paid-through',async()=>{
  const f=await renewalFixture();f.transition();await f.reconcile();const paid=f.invoice('paid');await f.webhook('invoice.paid',paid,1789229312);
  const through=f.data('users/owner').billing.aiPackPaidThrough;
  const old=f.invoice('paid','in_original');old.lines.data[1].period={start:f.end-2_592_000,end:f.end};
  await f.webhook('invoice.paid',old,1789229300,'evt_legacy_alias');
  assert.equal(f.grantCount(),2);assert.equal(f.data('users/owner').billing.aiPackPaidThrough,through);
});

test('failed renewal does not grant; base active retains Pro/200, past_due resolves Free/10',async()=>{
  const f=await renewalFixture();f.transition();await f.webhook('invoice.payment_failed',f.invoice('open'),1789229312);
  assert.equal((await f.view()).limits.aiActionsAllowance,200);assert.equal(f.grantCount(),1);
  f.subscription.status='past_due';await f.webhook('customer.subscription.updated',f.subscription,1789229313);
  assert.equal((await f.view()).plan,'free');assert.equal((await f.view()).limits.aiActionsAllowance,10);assert.equal(f.grantCount(),1);
});

test('failed applied release retains retryable ledger and Pro/200; same event retry converges without payment',async()=>{
  const f=await renewalFixture({releaseFailures:1});f.transition();const event=structuredClone(f.subscription);
  await f.webhook('customer.subscription.updated',event,1789229310,'evt_retry',500);
  assert.equal(f.data('billing_events/evt_retry').status,'failed');assert.equal(f.data('billing_events/evt_retry').failure.operation,'release_applied_schedule');
  assert.equal((await f.view()).limits.aiActionsAllowance,200);assert.notEqual(f.subscription.schedule,null);assert.equal(f.grantCount(),1);
  await f.webhook('customer.subscription.updated',event,1789229310,'evt_retry');
  assert.equal(f.subscription.schedule,null);assert.equal(f.data('billing_events/evt_retry').status,'processed');
  const calls=f.calls.length;await f.webhook('customer.subscription.updated',event,1789229310,'evt_retry');assert.equal(f.calls.length,calls);assert.equal(f.grantCount(),1);
  assert.equal(f.logs[0][1].errorMessage.includes('Release unavailable'),false); // Unknown original messages are not emitted.
});

test('concurrent schedule/subscription/paid/draft signals converge to Pro/1200 with two lifetime grants',async()=>{
  const f=await renewalFixture();f.transition();const staleSchedule=structuredClone([...f.schedules.values()][0]);
  await Promise.all([f.webhook('customer.subscription.updated',f.subscription,1789229310,'evt_sub'),f.webhook('subscription_schedule.updated',staleSchedule,1789229311,'evt_schedule'),f.webhook('invoice.paid',f.invoice('paid'),1789229312,'evt_invoice'),f.webhook('invoice.created',f.invoice(),1789229310,'evt_draft')]);
  await f.webhook('subscription_schedule.updated',staleSchedule,1789229300,'evt_stale');
  assert.equal((await f.view()).limits.aiActionsAllowance,1200);assert.equal(f.grantCount(),2);assert.equal(f.subscription.schedule,null);
  assert.equal(f.data('users/owner').billing.scheduledPlan,null);assert.equal(f.data('families/family_fixture').plan.seatLimit,0);
});

test('Family renewal has equivalent pooled payment gate, retaining usage and workspace',async()=>{
  let time=1_791_818_569;const f=fixture({end:time+1,pack:'recurring',clock:()=>time,billing:{aiPackPaidThrough:(time+1)*1000}});
  assert.equal((await f.view('member')).limits.aiActionsAllowance,1600);
  time=f.end+1;for(const item of f.subscription.items.data){item.current_period_start=f.end;item.current_period_end=f.end+2_592_000;}
  await f.webhook('customer.subscription.updated',f.subscription,1789229310);
  assert.equal((await f.view('member')).limits.aiActionsAllowance,600);assert.equal(f.data('families/family_fixture').usage.aiActionsUsed,17);
  const invoice={id:'in_familyrenewal',status:'paid',customer:f.customer.id,amount_paid:1398,amount_remaining:0,parent:{subscription_details:{subscription:f.subscription.id}},lines:{has_more:false,data:[{amount:399,pricing:{price_details:{price:'price_pack'}},period:{start:f.end,end:f.end+2_592_000}}]}};
  await f.webhook('invoice.paid',invoice,1789229312);
  assert.equal((await f.view('member')).limits.aiActionsAllowance,1600);assert.equal((await f.view('member')).usage.aiActionsUsed,17);
  assert.deepEqual(f.data('families/family_fixture').usage,f.initial['families/family_fixture'].usage);
});

test('stopped renewal retains only prepaid time and expires without granting or resetting usage',async()=>{
  let time=1_791_818_569;const f=fixture({end:time+1,pack:'prepaid',clock:()=>time,billing:{aiPackPaidThrough:(time+1)*1000,aiPackScheduledRemovalAt:(time+1)*1000}});
  assert.equal((await f.view()).limits.aiActionsAllowance,1600);
  const billing=f.data('users/owner').billing;
  await f.db.collection('users').doc('owner').set({billing:{...billing,plan:'pro',currentPeriodEnd:(f.end+2_592_000)*1000}},{merge:true});
  time=f.end+1;assert.equal((await f.view()).limits.aiActionsAllowance,200);assert.equal((await f.view()).aiPackEntitlementValid,false);
  assert.equal(f.data('users/owner').usage.aiActionsUsed,3);assert.equal([...f.docs.keys()].some(k=>k.startsWith('ai_pack_grants/')),false);
});

test('transaction abort after claim records safe failure, applies no partial mutation, and succeeds on same-event retry',async()=>{
  let abort=false;const f=await renewalFixture({transactionFailure:()=>{if(!abort)return false;abort=false;return true;}});f.transition();
  const original=f.db.runTransaction;let transactions=0;
  f.db.runTransaction=async callback=>{transactions++;if(transactions===2)abort=true;return original(callback);};
  await f.webhook('customer.subscription.updated',f.subscription,1789229310,'evt_abort',500);
  assert.equal(f.data('billing_events/evt_abort').status,'failed');assert.equal(f.data('billing_events/evt_abort').failure.errorCode,10);
  assert.equal(f.data('billing_events/evt_abort').failure.operation,'reconcile_subscription_transaction');assert.equal(f.data('users/owner').billing.plan,'family');
  await f.webhook('customer.subscription.updated',f.subscription,1789229310,'evt_abort');
  assert.equal(f.data('users/owner').billing.plan,'pro');assert.equal((await f.view()).limits.aiActionsAllowance,200);assert.equal(f.grantCount(),1);
});

test('expired processing lease recovers a lost failed-ledger write; live processing lease and processed duplicate stay quiet',async()=>{
  const f=await renewalFixture();f.transition();
  for(const [id,status,lease]of [['evt_live','processing',Date.now()+120000],['evt_expired','processing',Date.now()-1],['evt_processed','processed',0]]){
    f.docs.set('billing_events/'+id,{version:0,value:{status,processingLeaseUntil:lease}});
    const before=f.calls.length;await f.webhook('customer.subscription.updated',f.subscription,1789229310,id,id==='evt_live'?503:200);
    if(id!=='evt_expired')assert.equal(f.calls.length,before);else assert.equal(f.data('billing_events/'+id).status,'processed');
  }
  assert.equal((await f.view()).limits.aiActionsAllowance,200);assert.equal(f.grantCount(),1);
});

test('concurrent paid aliases create one invoice-keyed grant and out-of-order different paid periods never regress paid-through',async()=>{
  const f=await renewalFixture();f.transition();await f.reconcile();const invoice=f.invoice('paid');
  await Promise.all([f.webhook('invoice.paid',invoice,1789229312,'evt_alias1'),f.webhook('invoice.payment_succeeded',invoice,1789229312,'evt_alias2')]);
  const through=f.data('users/owner').billing.aiPackPaidThrough;assert.equal(f.grantCount(),2);
  const old=f.invoice('paid','in_older');old.lines.data[1].period={start:f.end-2_592_000,end:f.end};
  await f.webhook('invoice.paid',old,1789229300,'evt_older');assert.equal(f.data('users/owner').billing.aiPackPaidThrough,through);assert.equal(f.grantCount(),3); // A different historic paid invoice, not a duplicate renewal.
  assert.equal((await f.view()).limits.aiActionsAllowance,1200);
});

test('AI debit enforces Pro/200 in draft window using the same commercial clock as the view',async()=>{
  const f=await renewalFixture();f.transition();await f.reconcile();
  await f.db.collection('users').doc('owner').set({usage:{aiActionsUsed:200}},{merge:true});
  assert.equal((await f.view()).limits.aiActionsAllowance,200);assert.equal((await f.debit()).success,false);
  await f.webhook('invoice.paid',f.invoice('paid'),1789229312);assert.equal((await f.debit()).success,true);
  assert.equal(f.data('users/owner').usage.aiActionsUsed,201);
  assert.equal(f.data('families/family_fixture').usage.aiActionsUsed,17);assert.equal(f.grantCount(),2);
});

test('late pre-boundary Family schedule payload and late failure cannot undo live paid Pro state',async()=>{
  const f=await renewalFixture(),oldSchedule=structuredClone([...f.schedules.values()][0]);f.transition();await f.reconcile();
  await f.webhook('invoice.paid',f.invoice('paid'),1789229312);
  await f.webhook('subscription_schedule.updated',oldSchedule,1789229300,'evt_oldfamily');
  await f.webhook('invoice.payment_failed',f.invoice('open'),1789229301,'evt_oldfailure');
  assert.equal(f.data('users/owner').billing.plan,'pro');assert.equal(f.data('users/owner').billing.scheduledPlan,null);
  assert.equal((await f.view()).limits.aiActionsAllowance,1200);assert.equal(f.grantCount(),2);assert.equal(f.data('families/family_fixture').plan.seatLimit,0);
});

test('failed-ledger write still returns safe HTTP500 and a leased same-event retry later recovers',async()=>{
  const f=await renewalFixture({releaseFailures:1});f.transition();const collection=f.db.collection;let failRecord=true;
  f.db.collection=name=>{const c=collection(name),doc=c.doc;return {...c,doc:id=>{const ref=doc(id),update=ref.update;return {...ref,update:async patch=>{if(name==='billing_events' && id==='evt_writefailed' && patch.status==='failed' && failRecord){failRecord=false;throw new Error('fixture-secret-ledger-error');}return update(patch);}};}};};
  await f.webhook('customer.subscription.updated',f.subscription,1789229310,'evt_writefailed',500);
  assert.equal(f.data('billing_events/evt_writefailed').status,'processing');assert.equal(f.logs.at(-1)[1].operation,'record_failed_event');assert.equal(JSON.stringify(f.logs).includes('fixture-secret-ledger-error'),false);
  await f.webhook('customer.subscription.updated',f.subscription,1789229310,'evt_writefailed',503); // Still retryable before lease expiry, not an incorrect 200 acknowledgement.
  f.docs.get('billing_events/evt_writefailed').value.processingLeaseUntil=Date.now()-1;
  await f.webhook('customer.subscription.updated',f.subscription,1789229310,'evt_writefailed');assert.equal(f.data('billing_events/evt_writefailed').status,'processed');assert.equal(f.grantCount(),1);
});

test('expired recurring Pack cannot be resumed as already-paid, and add observation stays pending',async()=>{
  const f=await renewalFixture();f.transition();await f.reconcile();
  const billing=f.load('stripeBilling');
  await assert.rejects(billing.claimAIPackResume('owner',f.subscription.id,true,'synthetic_operation'),/expired/);
  const claim=await billing.claimAIPackOperation('owner',f.subscription.id,true,'synthetic_operation');
  assert.equal(claim.status,'pending');assert.equal(claim.shouldCreateItem,false);assert.equal(f.data('users/owner').billing.addons.aiPack,false);assert.equal((await f.view()).limits.aiActionsAllowance,200);assert.equal(f.grantCount(),1);
});

for(const interval of ['month','year'])test(`Family ${interval} schedules Pro on same interval without changing current entitlement or creating immediate billing adjustments`,async()=>{
  const f=fixture({interval});const result=await f.schedule();
  assert.equal('stripeScheduleId' in result,false);
  assert.equal(result.scheduledInterval,interval);assert.equal(result.scheduledChangeAt,f.end*1000);
  const s=[...f.schedules.values()][0];
  assert.equal(s.end_behavior,'release');assert.equal(s.proration_behavior,'none');assert.equal(s.phases.length,2);
  assert.equal(s.phases[0].items[0].price,`price_family_${interval}`);assert.equal(s.phases[1].items[0].price,`price_pro_${interval}`);
  assert.equal(s.phases[0].end_date,f.end);assert.equal(s.phases[1].start_date,f.end);assert.equal(s.phases[1].duration.interval,interval);
  assert.equal(s.phases.every(p=>p.proration_behavior==='none'),true);
  const view=await f.view();assert.equal(view.plan,'family');assert.equal(view.limits.aiActionsAllowance,600);
  assert.equal(view.limits.maxCollaboratorsPerTree,20);assert.equal(view.limits.storageQuotaBytes,100*1024**3);
  assert.equal(f.data('families/family_fixture').plan.seatLimit,6);
  assert.deepEqual(f.calls.map(c=>c.method),['create','update']); // no invoice/refund/subscription mutation API
});

test('concurrent/repeated scheduling uses exactly one schedule and future phase',async()=>{
  const f=fixture();const results=await Promise.all([f.schedule(),f.schedule(),f.schedule()]);await f.schedule();
  assert.equal(f.schedules.size,1);assert.equal([...f.schedules.values()][0].phases.length,2);
  assert.equal(results.every(r=>r.scheduledChangeAt===f.end*1000),true);assert.ok(f.retries>0);
});

for(const failure of ['failConfigure','failCreateResponse'])test(`retry recovers a ${failure} without duplicating a schedule`,async()=>{
  const f=fixture({[failure]:1});await assert.rejects(f.schedule());await f.schedule();
  assert.equal(f.schedules.size,1);assert.equal((await f.view()).scheduledDowngrade.scheduledPlan,'pro');
});

test('Keep Family releases, is idempotent, and a later new downgrade creates one fresh schedule',async()=>{
  const f=fixture({pack:'recurring'});await f.schedule();const packBefore=structuredClone(f.subscription.items.data[1]);
  await f.cancel();await f.cancel();
  assert.equal(f.calls.filter(c=>c.method==='release').length,1);assert.equal(f.subscription.schedule,null);
  assert.equal(f.data('users/owner').billing.scheduledPlan,null);assert.equal((await f.view()).limits.aiActionsAllowance,1600);
  assert.equal((await f.view()).billingScheduleReleaseConfirmed,true);
  assert.deepEqual(f.subscription.items.data[1],packBefore);await f.schedule();assert.equal(f.schedules.size,2);
});

for(const pack of [undefined,'recurring','prepaid','pending'])test(`effective downgrade preserves workspace/data/seats and resolves the correct Pro allowance (${pack || 'no pack'})`,async()=>{
  const f=fixture({pack});await f.schedule();assert.equal((await f.view('member')).plan,'family');
  const paidThrough=f.data('users/owner').billing.aiPackPaidThrough;
  f.transition();await f.reconcile(3000);
  const view=await f.view();assert.equal(view.plan,'pro');assert.equal(view.canonicalPlan,'pro');assert.equal(view.scheduledDowngrade,null);
  assert.equal(view.billingScheduleCleanupRequired,false);assert.equal(view.billingScheduleReleaseConfirmed,true);
  assert.equal(view.effectivePaidEntitlement,true);assert.equal(view.limits.aiActionsAllowance,['recurring','prepaid'].includes(pack)?1200:200);
  assert.equal(view.limits.maxCollaboratorsPerTree,10);assert.equal(view.limits.storageQuotaBytes,50*1024**3);
  assert.equal(view.usage.storageUsedBytes,60*1024**3); // known overage remains and blocks growth via existing quota rule
  const member=await f.view('member');assert.equal(member.plan,'free');assert.equal(member.limits.aiActionsAllowance,10);assert.equal(member.isFamily,false);
  assert.equal(member.familyWorkspacePreserved,true);assert.equal(view.familyId,'family_fixture');
  const family=f.data('families/family_fixture');assert.equal(family.ownerUid,'owner');assert.equal(family.plan.seatLimit,0);assert.equal(family.plan.paidSeatEntitlementActive,false);
  for(const key of ['families/family_fixture/seats/owner','families/family_fixture/seats/member','trees/synthetic','invitations/synthetic'])assert.deepEqual(f.data(key),f.initial[key]);
  assert.deepEqual(family.usage,f.initial['families/family_fixture'].usage);
  assert.equal(f.data('users/owner').billing.aiPackPaidThrough,paidThrough);
  const policy=f.load('collaborationPolicy').validateCollaboratorAdd(f.data('trees/synthetic'),'viewer',f.data('users/owner'),'new_member');
  assert.equal(policy.allowed,false); // excess existing collaborators preserved; new mutation blocked
});

test('failed applied-Pro release does not publish cleanup confirmation',async()=>{
  const f=fixture({failRelease:true});await f.schedule();f.transition();await assert.rejects(f.reconcile());
  const view=await f.view();assert.equal(view.plan,'pro');assert.equal(view.billingScheduleReleaseConfirmed,false);
  assert.equal(view.billingScheduleCleanupRequired,true);assert.equal(f.subscription.schedule!==null,true);
});

test('release response without fresh detachment remains unconfirmed and reread is bounded',async()=>{
  const f=fixture({retainAttachment:true});await f.schedule();f.transition();await f.reconcile();
  assert.equal(f.calls.filter(c=>c.method==='release').length,1);
  const view=await f.view();assert.equal(view.billingScheduleReleaseConfirmed,false);assert.equal(view.billingScheduleCleanupRequired,true);
});

test('Keep Family release failure preserves authoritative schedule and withholds confirmation',async()=>{
  const f=fixture({failRelease:true});await f.schedule();await assert.rejects(f.cancel());
  const view=await f.view();assert.equal(view.plan,'family');assert.equal(view.scheduledDowngrade.scheduledPlan,'pro');
  assert.equal(view.billingScheduleReleaseConfirmed,false);
});

test('prepaid AI Pack expires without being recreated by the downgrade',async()=>{
  const f=fixture({pack:'prepaid'});await f.schedule();f.transition();await f.reconcile();
  const b=f.data('users/owner').billing;b.aiPackPaidThrough=Date.now()-1;b.aiPackScheduledRemovalAt=b.aiPackPaidThrough;
  await f.db.collection('users').doc('owner').set({billing:b},{merge:true});await f.reconcile();
  assert.equal((await f.view()).limits.aiActionsAllowance,200);assert.equal(f.subscription.items.data.length,1);
});

test('ownership, current base allowlist, malformed requests and foreign schedules fail closed',async()=>{
  for(const mutate of [f=>{f.customer.metadata.kr_uid='other';},f=>{f.subscription.customer='cus_other';},f=>{f.subscription.metadata.kr_uid='other';},f=>{f.subscription.items.data[0].price.id='price_untrusted';}]){
    const f=fixture();mutate(f);await assert.rejects(f.schedule());assert.equal(f.calls.length,0);
  }
  for(const data of [{priceId:'price_arbitrary'},{plan:'pro',interval:'year'},{uid:'other'},null,{plan:'family'}]){
    const f=fixture();await assert.rejects(f.load('familyDowngrade').scheduleDowngradeToPro({...f.request,data}),e=>e.code==='invalid-argument');assert.equal(f.calls.length,0);
  }
  const f=fixture();f.subscription.schedule='sub_sched_foreign';f.schedules.set('sub_sched_foreign',{id:'sub_sched_foreign',customer:f.customer.id,subscription:f.subscription.id,metadata:{},status:'active',phases:[]});
  await assert.rejects(f.schedule());await assert.rejects(f.cancel());assert.equal(f.calls.length,0);
});

for(const status of ['past_due','unpaid','incomplete','incomplete_expired','paused'])test(`${status} blocks scheduling/canceling while leaving Portal available`,async()=>{
  const f=fixture();await f.schedule();
  const b=f.data('users/owner').billing;b.status=status;await f.db.collection('users').doc('owner').set({billing:b},{merge:true});f.subscription.status=status;
  const before=f.calls.length;await assert.rejects(f.schedule());await assert.rejects(f.cancel());assert.equal(f.calls.length,before);
  const portal=await f.load('stripeBilling').createPortalSession({auth:{uid:'owner'}});assert.equal(portal.url,'https://example.test/portal');
});

test('schedule blocks add/remove/resume AI Pack operations without changing existing add-on state',async()=>{
  const f=fixture({pack:'recurring'});await f.schedule();const before=f.data('users/owner');
  for(const name of ['addAIPack','removeAIPack','resumeAIPack'])await assert.rejects(f.load('stripeBilling')[name]({auth:{uid:'owner'},data:{}}));
  assert.deepEqual(f.data('users/owner'),before);
});

test('out-of-order/equal-second webhook events reconstruct live Pro and do not resurrect scheduled Family',async()=>{
  const f=fixture();await f.schedule();const old=structuredClone(f.subscription);f.transition();
  await f.webhook('customer.subscription.updated',f.subscription,4000);
  await f.webhook('customer.subscription.updated',old,3000);
  await f.webhook('customer.subscription.updated',old,4000,'evt_equal');
  assert.equal(f.data('users/owner').billing.plan,'pro');assert.equal(f.data('families/family_fixture').plan.plan,'pro');
  assert.equal((await f.view()).scheduledDowngrade,null);
});

test('all schedule lifecycle events and invoice.paid reconcile stale fields, independent of delivery order',async()=>{
  for(const type of ['subscription_schedule.created','subscription_schedule.updated','subscription_schedule.released','subscription_schedule.completed','subscription_schedule.canceled','subscription_schedule.aborted','invoice.paid']){
    const f=fixture();await f.schedule();const s=structuredClone([...f.schedules.values()][0]);f.transition();
    const payload=type==='invoice.paid'?{id:'in_fixture',customer:f.customer.id,lines:{data:[]}}:s;
    await f.webhook(type,payload,5000);await f.webhook(type,payload,5000); // duplicate event ledger
    assert.equal(f.data('users/owner').billing.plan,'pro',type);assert.equal(f.data('users/owner').billing.scheduledPlan,null,type);
  }
});

test('explicit scoped reconciliation repairs stale schedule creation/cancellation after restart',async()=>{
  const f=fixture();await f.schedule();let b=f.data('users/owner').billing;b.scheduledPlan=null;
  await f.db.collection('users').doc('owner').set({billing:b},{merge:true});
  await f.load('familyDowngrade').reconcileScheduledBilling({auth:{uid:'owner'},data:{}});assert.equal((await f.view()).scheduledDowngrade.scheduledPlan,'pro');
  f.subscription.schedule=null;await f.reconcile();assert.equal((await f.view()).scheduledDowngrade,null);assert.equal((await f.view()).plan,'family');
});

test('explicit applied-Pro reconciliation releases once, confirms fresh authority and is idempotent',async()=>{
  const f=fixture();await f.schedule();const customer=f.customer.id,subscription=f.subscription.id,workspace=f.data('users/owner').family.familyId;
  const preserved=Object.fromEntries(['families/family_fixture/seats/owner','families/family_fixture/seats/member','trees/synthetic','invitations/synthetic'].map(key=>[key,f.data(key)]));
  f.transition();const run=()=>f.load('familyDowngrade').reconcileScheduledBilling({auth:{uid:'owner'},data:{}});
  const state=await run();assert.equal(state.scheduleReleaseConfirmed,true);assert.equal(f.subscription.schedule,null);
  assert.equal('stripeScheduleId' in state,false);await run();assert.equal(f.calls.filter(c=>c.method==='release').length,1);
  const release=f.calls.find(c=>c.method==='release');assert.equal(release.opts.idempotencyKey,`kr-family-pro-complete:${release.id}`);
  assert.deepEqual(release.input,{preserve_cancel_date:true});assert.equal(f.calls.filter(c=>c.method!=='release').length,2); // original create/configure only
  const view=await f.view();assert.equal(view.plan,'pro');assert.equal(view.limits.aiActionsAllowance,200);assert.equal(view.limits.maxCollaboratorsPerTree,10);
  assert.equal(view.limits.storageQuotaBytes,50*1024**3);assert.equal(view.familyId,workspace);assert.equal(view.familyWorkspacePreserved,true);
  assert.equal(f.customer.id,customer);assert.equal(f.subscription.id,subscription);assert.equal(f.data('users/owner').billing.stripeSubscriptionId,subscription);
  const family=f.data('families/family_fixture');assert.equal(family.plan.paidSeatEntitlementActive,false);assert.equal(family.plan.seatLimit,0);
  for(const [key,value] of Object.entries(preserved))assert.deepEqual(f.data(key),value);
  assert.deepEqual(family.usage,f.initial['families/family_fixture'].usage);
});
test('explicit cleanup POST without detachment withholds persisted confirmation',async()=>{
  const f=fixture({retainAttachment:true});await f.schedule();f.transition();const state=await f.load('familyDowngrade').reconcileScheduledBilling({auth:{uid:'owner'},data:{}});
  assert.equal(state.scheduleReleaseConfirmed,false);assert.equal((await f.view()).billingScheduleCleanupRequired,true);
  assert.equal(f.calls.filter(c=>c.method==='release').length,1);assert.equal(f.subscription.schedule!==null,true);
});
test('explicit reconciliation authenticates and rejects browser identifiers before any Stripe call',async()=>{
  const f=fixture();for(const request of [{data:{}},{auth:{uid:'owner'},data:{subscriptionId:'sub_other'}},{auth:{uid:'owner'},data:null}]){
    await assert.rejects(f.load('familyDowngrade').reconcileScheduledBilling(request));
  }assert.deepEqual(f.calls,[]);
});
for(const [name,mutate] of Object.entries({
  'past_due':f=>f.subscription.status='past_due',
  'unpaid':f=>f.subscription.status='unpaid',
  'pending update':f=>f.subscription.pending_update={expires_at:1234},
  'foreign schedule':f=>[...f.schedules.values()][0].metadata.kr_uid='other',
  'future phase':f=>{const s=[...f.schedules.values()][0];s.phases.push({...s.phases[1],start_date:s.phases[1].end_date,end_date:s.phases[1].end_date+100});},
  'missing receipt':f=>f.docs.get('users/owner').value.billing.basePlanScheduleRecovery=null,
  'wrong receipt operation':f=>f.docs.get('users/owner').value.billing.basePlanScheduleRecovery.operationId='external',
  'wrong workspace mapping':f=>f.customer.metadata.kr_family_id='other_workspace',
}))test(`explicit applied-Pro cleanup cannot release ${name}`,async()=>{
  const f=fixture();await f.schedule();f.transition();mutate(f);
  try{await f.load('familyDowngrade').reconcileScheduledBilling({auth:{uid:'owner'},data:{}});}catch{}
  assert.equal(f.calls.filter(c=>c.method==='release').length,0);assert.equal(f.subscription.schedule!==null,true);
  assert.equal((await f.view()).billingScheduleReleaseConfirmed,false);
});
for(const type of ['customer.subscription.updated','subscription_schedule.updated','invoice.paid'])test(`future ${type} webhook automatically releases applied Pro and duplicate delivery is a no-op`,async()=>{
  const f=fixture();await f.schedule();f.transition();const schedule=structuredClone([...f.schedules.values()][0]);
  const payload=type==='invoice.paid'?{id:'in_renewal_fixture',customer:f.customer.id,lines:{data:[]}}:type==='subscription_schedule.updated'?schedule:f.subscription;
  await f.webhook(type,payload,7000);await f.webhook(type,payload,7000);
  assert.equal(f.calls.filter(c=>c.method==='release').length,1);assert.equal(f.subscription.schedule,null);
  assert.equal((await f.view()).billingScheduleReleaseConfirmed,true);assert.equal((await f.view()).limits.aiActionsAllowance,200);
  assert.equal(f.data('families/family_fixture').plan.paidSeatEntitlementActive,false);
});

test('transaction retries re-fetch Stripe when reconciliation races an actual phase transition',async()=>{
  let release,first=true;const gate=new Promise(r=>release=r);
  const f=fixture({onReadSubscription:async({observed})=>{if(first&&observed.items.data[0].price.metadata.kr_plan==='family'&&observed.schedule){first=false;await gate;}}});
  // Install the schedule without the read barrier enabled.
  first=false;await f.schedule();first=true;
  const old=f.reconcile(7000);await new Promise(r=>setImmediate(r));f.transition();await f.reconcile(7000);release();await old;
  assert.ok(f.retries>0);assert.equal(f.data('users/owner').billing.plan,'pro');assert.equal(f.data('families/family_fixture').plan.plan,'pro');
});

test('downgrade APIs require authentication and live payment eligibility even when Firestore is stale',async()=>{
  const f=fixture();for(const name of ['scheduleDowngradeToPro','cancelScheduledDowngrade','reconcileScheduledBilling'])await assert.rejects(f.load('familyDowngrade')[name]({data:{}}),e=>e.code==='unauthenticated');
  f.subscription.status='past_due';await assert.rejects(f.schedule());assert.equal(f.calls.length,0);
});

test('persisted downgrade claim excludes add-on claims, and an existing add-on operation excludes scheduling',async()=>{
  const f=fixture();const b=f.data('users/owner').billing;b.basePlanChangeOperationId='synthetic-operation';b.basePlanChangeOperation='schedule';
  await f.db.collection('users').doc('owner').set({billing:b},{merge:true});const before=f.data('users/owner');
  await assert.rejects(f.load('stripeBilling').claimAIPackOperation('owner','sub_fixture',false,'addon_operation'));
  assert.deepEqual(f.data('users/owner'),before);
  const g=fixture({billing:{aiPackOperationId:'pending-addon'}});await assert.rejects(g.schedule());assert.equal(g.calls.length,0);
});

test('phase-boundary renewal failure and recovery preserve canonical Pro, workspace and valid AI Pack',async()=>{
  const f=fixture({pack:'recurring'});await f.schedule();f.transition();f.subscription.status='past_due';
  const invoice={id:'in_fixture',customer:f.customer.id,lines:{data:[]}};
  await f.webhook('invoice.payment_failed',invoice,8000);
  let view=await f.view();assert.equal(view.canonicalPlan,'pro');assert.equal(view.plan,'free');assert.equal(view.paymentAttentionRequired,true);assert.equal(view.limits.aiActionsAllowance,10);
  f.subscription.status='active';await f.webhook('invoice.paid',invoice,8001);view=await f.view();
  assert.equal(view.plan,'pro');assert.equal(view.limits.aiActionsAllowance,1200);assert.equal(view.familyWorkspacePreserved,true);
});

for(const pack of [undefined,'recurring','prepaid'])test(`returning to Family reuses the preserved workspace and seat records (${pack || 'no pack'})`,async()=>{
  const f=fixture({pack});await f.schedule();f.transition();await f.reconcile();assert.equal(f.subscription.schedule,null);
  const ids=[...f.docs.keys()];const through=f.data('users/owner').billing.aiPackPaidThrough;
  await f.load('stripeBilling').upgradeToFamily({auth:{uid:'owner'},data:{plan:'family',interval:'month'}});
  await f.reconcile();const view=await f.view();assert.equal(view.plan,'family');assert.equal((await f.view('member')).plan,'family');
  assert.equal(view.limits.aiActionsAllowance,pack?1600:600);assert.equal(f.data('users/owner').billing.planChangeStatus,'none');
  assert.equal(f.data('users/owner').billing.aiPackPaidThrough,through);
  assert.deepEqual([...f.docs.keys()],ids);assert.deepEqual(f.data('families/family_fixture/seats/member'),f.initial['families/family_fixture/seats/member']);
});

test('real Clover migrated phase response is converted to writable fields with the v2 configuration key',async()=>{
  const f=fixture({phaseSettings:{automatic_tax:{disabled_reason:null,enabled:true,liability:{type:'account',account:{id:'acct_fixture'}}},
    invoice_settings:{account_tax_ids:[{id:'txi_fixture'}],days_until_due:null,issuer:{type:'self'},custom_fields:null,description:null,footer:null}}});
  await f.schedule();const call=f.calls.find(c=>c.method==='update');
  assert.match(call.opts.idempotencyKey,/^kr-family-pro-configure:v2:/);
  for(const p of call.input.phases){assert.deepEqual(p.automatic_tax,{enabled:true,liability:{type:'account',account:'acct_fixture'}});
    assert.deepEqual(p.invoice_settings,{account_tax_ids:['txi_fixture'],issuer:{type:'self'}});assert.equal('disabled_reason' in p.automatic_tax,false);}
});

test('failed phase configuration persists trusted receipt, preserves Family and null scheduled fields; repair uses no create POST',async()=>{
  const f=fixture({failConfigure:1,pack:'recurring'});await assert.rejects(f.schedule());
  const partial=[...f.schedules.values()][0],id=partial.id;
  assert.equal(partial.phases.length,1);assert.equal(f.data('users/owner').billing.basePlanScheduleRecovery.scheduleId,id);
  await f.reconcile(9000);let view=await f.view();assert.equal(view.plan,'family');assert.equal(view.limits.aiActionsAllowance,1600);assert.equal(view.scheduledDowngrade,null);
  assert.equal(f.data('users/owner').billing.scheduleReconciliationStatus,'partial_owned');
  assert.equal(f.data('families/family_fixture').plan.scheduledPlan,null);
  await f.schedule();await f.schedule();
  assert.equal(f.calls.filter(c=>c.method==='create').length,1);assert.equal(f.schedules.size,1);assert.equal(f.subscription.schedule,id);
  assert.equal(f.schedules.get(id).phases.length,2);assert.equal(f.schedules.get(id).phases[1].start_date,f.end);
  assert.ok(f.calls.every(c=>['create','update'].includes(c.method))); // no invoice/refund/subscription mutation
  assert.equal(f.schedules.get(id).phases.every(p=>p.proration_behavior==='none'),true);
});

test('legacy untagged partial schedule is recovered by exact creation-event key and unchanged snapshot, not by another POST',async()=>{
  const f=fixture({failCreateResponse:1});await assert.rejects(f.schedule());
  assert.equal(f.data('users/owner').billing.basePlanScheduleRecovery,undefined);
  assert.deepEqual([...f.schedules.values()][0].metadata,{});await f.schedule();
  assert.equal(f.calls.filter(c=>c.method==='create').length,1);assert.equal(f.schedules.size,1);
});

test('missing creation evidence fails closed after lost response without attempting a second create',async()=>{
  const f=fixture({failCreateResponse:1});await assert.rejects(f.schedule());f.creationEvents.length=0;
  await assert.rejects(f.schedule(),e=>e.code==='failed-precondition');assert.equal(f.calls.filter(c=>c.method==='create').length,1);
});

test('an externally created partial with an unrelated creation key is never adopted',async()=>{
  const f=fixture({failCreateResponse:1});await assert.rejects(f.schedule());f.creationEvents[0].request.idempotency_key='external_schedule_creation';
  const before=f.calls.length;await assert.rejects(f.schedule());await assert.rejects(f.cancel());assert.equal(f.calls.length,before);
});
test('wrong environment customer, subscription or target Price is rejected before any Stripe mutation',async()=>{
  for(const change of [f=>f.customer.livemode=true,f=>f.subscription.livemode=true]){
    const f=fixture();change(f);await assert.rejects(f.schedule());assert.equal(f.calls.length,0);
  }
  const f=fixture({targetPrice:{livemode:true}});await assert.rejects(f.schedule());assert.equal(f.calls.length,0);
});
test('external schedule editing during receipt persistence is detected by the final reread before update',async()=>{
  let reads=0;const f=fixture({failConfigure:1,onReadSchedule:s=>{if(++reads===3)s.default_settings.automatic_tax.enabled=true;}});
  await assert.rejects(f.schedule());const before=f.calls.filter(c=>c.method==='update').length;
  await assert.rejects(f.schedule());assert.equal(f.calls.filter(c=>c.method==='update').length,before);assert.equal(f.schedules.size,1);
});
test('ownership metadata alone cannot authorize repair of an otherwise unproven partial',async()=>{
  const f=fixture({failCreateResponse:1});await assert.rejects(f.schedule());f.creationEvents.length=0;
  Object.assign([...f.schedules.values()][0].metadata,{kr_uid:'owner',kr_family_id:'family_fixture',kr_subscription_id:f.subscription.id,kr_change:'family_to_pro'});
  const before=f.calls.length;await assert.rejects(f.schedule());await assert.rejects(f.cancel());assert.equal(f.calls.length,before);
});

for(const [name,mutate] of Object.entries({
  'wrong customer':s=>s.customer='cus_other','wrong subscription':s=>s.subscription='sub_other',
  'live mode':s=>s.livemode=true,'unexpected Price':s=>s.phases[0].items[0].price='price_unknown',
  'conflicting future':s=>s.phases.push({...structuredClone(s.phases[0]),start_date:s.phases[0].end_date}),
  'external metadata':s=>s.metadata={external:'owned_elsewhere'},'external default settings':s=>s.default_settings.automatic_tax.enabled=true,
  'released':s=>s.status='released','completed':s=>s.status='completed','canceled':s=>s.status='canceled',
}))test(`altered partial schedule (${name}) cannot be repaired or released`,async()=>{
  const f=fixture({failConfigure:1});await assert.rejects(f.schedule());mutate([...f.schedules.values()][0]);const before=f.calls.length;
  await assert.rejects(f.schedule());await assert.rejects(f.cancel());assert.equal(f.calls.length,before);
});

test('Keep Family releases a verified partial once and preserves Family renewal, pack and workspace',async()=>{
  const f=fixture({failConfigure:1,pack:'recurring'});await assert.rejects(f.schedule());const before=structuredClone(f.subscription.items.data);
  await f.cancel();await f.cancel();assert.equal(f.calls.filter(c=>c.method==='release').length,1);
  assert.deepEqual(f.subscription.items.data,before);assert.equal(f.subscription.cancel_at_period_end,false);assert.equal(f.subscription.schedule,null);
  assert.equal(f.data('users/owner').billing.scheduleReconciliationStatus,'released');
  assert.equal((await f.view()).plan,'family');assert.equal((await f.view()).scheduledDowngrade,null);
  assert.deepEqual(f.data('trees/synthetic'),f.initial['trees/synthetic']);
});

test('out-of-order schedule and subscription webhooks never turn a Family-only partial into scheduled Pro',async()=>{
  const f=fixture({failConfigure:1});await assert.rejects(f.schedule());const s=[...f.schedules.values()][0];
  for(const [type,created] of [['subscription_schedule.created',10000],['subscription_schedule.updated',9999],['customer.subscription.updated',10000]]){
    await f.webhook(type,type.startsWith('subscription_schedule')?s:f.subscription,created);
    assert.equal(f.data('users/owner').billing.plan,'family');assert.equal(f.data('users/owner').billing.scheduledPlan,null);
    assert.equal(f.data('families/family_fixture').plan.scheduledChangeAt,null);
  }
});

test('reconciliation distinguishes managed terminal schedules and does not rewrite conflicting future phases',async()=>{
  for(const status of ['released','canceled','completed']){
    const f=fixture();await f.schedule();const s=[...f.schedules.values()][0];s.status=status;s.released_subscription=s.subscription;s.subscription=null;f.subscription.schedule=null;
    await f.reconcile();assert.equal(f.data('users/owner').billing.scheduleReconciliationStatus,status);assert.equal((await f.view()).scheduledDowngrade,null);
  }
  const f=fixture();await f.schedule();const s=[...f.schedules.values()][0];s.phases[1].items[0].price='price_external';const before=f.calls.length;
  await f.reconcile();assert.equal(f.data('users/owner').billing.scheduleReconciliationStatus,'unknown');assert.equal((await f.view()).scheduledDowngrade,null);
  assert.equal(f.calls.length,before);
});
