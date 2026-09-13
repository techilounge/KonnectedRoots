const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function loadSubscriptionPolicy(logs = [], env = process.env) {
  const mod = {exports:{}};
  const mocks = {
    './config': {functionsEnv: require('../lib/config').functionsConfig({STRIPE_SECRET_KEY:env.STRIPE_SECRET_KEY || 'fixture',STRIPE_WEBHOOK_SECRET:'fixture'})},
    './billingSchedules': require('../lib/billingSchedules'),
    './storageAuthority': require('../lib/storageAuthority'),
    './billingCatalog': {isSupportedWebhookType: () => false},
    'firebase-functions/v2/https': {onRequest: (_options, handler) => handler},
    'firebase-functions/logger': {
      info: (...args) => logs.push(['info', ...args]),
      warn: (...args) => logs.push(['warn', ...args]),
      error: (...args) => logs.push(['error', ...args]),
    },
    'firebase-admin': {apps:[{}],firestore: () => ({})},
    stripe: class Stripe {},
    './sendEmail': {sendEmail: async () => {}},
    './emailTemplates': {paymentSuccessEmail: () => ({subject:'',html:''}),paymentFailedEmail: () => ({subject:'',html:''})},
  };
  new Function('require','module','exports','process',fs.readFileSync(path.join(__dirname,'../lib/stripeWebhook.js'),'utf8'))(
    name => mocks[name], mod, mod.exports, {...process,env},
  );
  return mod.exports;
}

test('webhook diagnostic preserves safe identity/code/stage but never arbitrary error/body/stack secrets',()=>{
  const webhook=loadSubscriptionPolicy();
  const event={id:'evt_synthetic',type:'customer.subscription.updated',data:{object:{id:'sub_synthetic',customer:'cus_synthetic',metadata:{private:'fixture-sensitive-data'}}}};
  const error=new TypeError('fixture-sensitive-data recipient@example.test payment-secret-fixture');error.code=10;error.stack='fixture-stack-secret';
  const diagnostic=webhook.safeWebhookFailure(event,error,'synthetic_test_stage');
  assert.equal(diagnostic.eventId,event.id);assert.equal(diagnostic.subscriptionId,'sub_synthetic');assert.equal(diagnostic.errorName,'TypeError');assert.equal(diagnostic.errorCode,10);assert.equal(diagnostic.operation,'synthetic_test_stage');
  const serialized=JSON.stringify(diagnostic);
  for(const forbidden of ['fixture-sensitive-data','recipient@example.test','payment-secret-fixture','fixture-stack-secret'])assert.equal(serialized.includes(forbidden),false);
  error.name='fixture-secret-name';error.code='fixture-secret-code';assert.equal(webhook.safeWebhookFailure(event,error,'stage').errorName,'Error');assert.equal(webhook.safeWebhookFailure(event,error,'stage').errorCode,'processing_error');
});

test('known static billing error message is retained safely without logging raw exception or stack',()=>{
  const error=new Error('Subscription authority changed.');error.stack='private-stack-fixture';
  const diagnostic=loadSubscriptionPolicy().safeWebhookFailure({id:'evt_test',type:'invoice.paid',data:{object:{id:'in_test',parent:{subscription_details:{subscription:'sub_test'}}}}},error,'grant');
  assert.equal(diagnostic.errorMessage,'Subscription authority changed.');assert.equal(diagnostic.subscriptionId,'sub_test');assert.equal('stack' in diagnostic,false);
});

const clockEnv={NODE_ENV:'test',FUNCTIONS_EMULATOR:'true',GCLOUD_PROJECT:'demo-konnectedroots-phase2',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',STRIPE_SECRET_KEY:'sk_test_fixture'};
test('Functions uses the verified frozen commercial time, not wall/event/current_period_end',async()=>{
  const customer={id:'cus_test',livemode:false,test_clock:'clock_test',metadata:{kr_uid:'owner',kr_test_scenario:'phase2_family_downgrade'}};
  const clock={id:'clock_test',livemode:false,frozen_time:1791818571};
  const api={testHelpers:{testClocks:{retrieve:async id=>{assert.equal(id,clock.id);return clock;}}}};
  assert.equal(await loadSubscriptionPolicy([],clockEnv).subscriptionEvaluationTime(api,customer,{livemode:false},'owner'),1791818571000);
});
for(const change of [{NODE_ENV:'production'},{FUNCTIONS_EMULATOR:'false'},{GCLOUD_PROJECT:'production-fixture'},{FIRESTORE_EMULATOR_HOST:'remote-fixture:8080'},{STRIPE_SECRET_KEY:'fixture'}])test(`Functions clock adapter cannot activate outside strict local conditions ${Object.keys(change)[0]}`,async()=>{
  const customer={test_clock:'clock_test'};const before=Date.now();
  const time=await loadSubscriptionPolicy([],{...clockEnv,...change}).subscriptionEvaluationTime({},customer,{},'owner');assert.ok(time>=before);
});

function cloverSubscription({
  plan = 'pro',
  interval = 'month',
  status = 'active',
  planPeriodEnd,
  aiPackPeriodEnd,
  cancelAtPeriodEnd = false,
  cancelAt,
  canceledAt,
  legacyPeriodEnd,
} = {}) {
  const subscription = {
    id: 'sub_clover_fixture',
    customer: 'cus_fixture',
    status,
    cancel_at_period_end: cancelAtPeriodEnd,
    cancel_at: cancelAt ?? null,
    canceled_at: canceledAt ?? null,
    ended_at: null,
    metadata: {kr_plan: plan, kr_interval: interval},
    items: {data: [{
      id: 'si_plan_fixture',
      current_period_start: 1_750_000_000,
      ...(planPeriodEnd === undefined ? {} : {current_period_end: planPeriodEnd}),
      price: {id: `price_${plan}_${interval}`, metadata: {kr_plan: plan}, recurring: {interval}},
    }]},
  };
  if (aiPackPeriodEnd !== undefined) {
    subscription.items.data.unshift({
      id: 'si_ai_pack_fixture',
      current_period_start: 1_750_000_000,
      current_period_end: aiPackPeriodEnd,
      price: {id: 'price_ai_pack', metadata: {kr_addon: 'ai_pack'}, recurring: {interval: 'month'}},
    });
  }
  if (legacyPeriodEnd !== undefined) subscription.current_period_end = legacyPeriodEnd;
  return subscription;
}

for (const [name, plan, interval, periodEnd] of [
  ['Pro monthly', 'pro', 'month', 1_800_000_001],
  ['Pro yearly', 'pro', 'year', 1_830_000_002],
  ['Family monthly', 'family', 'month', 1_800_000_003],
  ['Family yearly', 'family', 'year', 1_830_000_004],
]) {
  test(`${name} Clover subscription uses the plan item period`, () => {
    const webhook = loadSubscriptionPolicy();
    const state = webhook.subscriptionBillingState(
      'customer.subscription.updated',
      cloverSubscription({plan, interval, planPeriodEnd: periodEnd}),
    );
    assert.equal(state.plan, plan);
    assert.equal(state.interval, interval);
    assert.equal(state.currentPeriodEnd, periodEnd * 1000);
  });
}

test('Pro with AI Pack keeps the plan item as the entitlement period source', () => {
  const webhook = loadSubscriptionPolicy();
  const subscription = cloverSubscription({planPeriodEnd: 1_800_000_010, aiPackPeriodEnd: 1_900_000_020});
  const state = webhook.subscriptionBillingState('customer.subscription.updated', subscription);
  assert.deepEqual(state.addons, {aiPack: false});
  assert.equal(state.aiPackItemExists, true);
  assert.equal(state.aiPackStatus, 'pending');
  assert.equal(state.aiPackPaidThrough, null);
  assert.equal(state.currentPeriodEnd, 1_800_000_010_000);
});

test('mixed plan and add-on periods never use the AI Pack period for base entitlement', () => {
  const webhook = loadSubscriptionPolicy();
  const subscription = cloverSubscription({planPeriodEnd: 1_900_000_030, aiPackPeriodEnd: 1_800_000_040});
  assert.equal(webhook.resolvePlanCurrentPeriodEnd(subscription), 1_900_000_030_000);
});

test('legacy subscription-level period remains a backward-compatible fallback', () => {
  const webhook = loadSubscriptionPolicy();
  const subscription = cloverSubscription({legacyPeriodEnd: 1_810_000_050});
  assert.equal(webhook.resolvePlanCurrentPeriodEnd(subscription), 1_810_000_050_000);
});

test('missing plan period fails closed and emits only a safe diagnostic', () => {
  const logs = [];
  const webhook = loadSubscriptionPolicy(logs);
  const subscription = cloverSubscription();
  subscription.metadata.private_fixture = 'must-not-log';
  const state = webhook.subscriptionBillingState('customer.subscription.updated', subscription);
  assert.equal(state.currentPeriodEnd, 0);
  assert.equal(logs.length, 1);
  assert.equal(logs[0][1], 'Stripe paid-plan item has no usable current period end');
  assert.deepEqual(logs[0][2], {
    operation: 'resolve_subscription_plan_period',
    subscriptionId: 'sub_clover_fixture',
    plan: 'pro',
  });
  assert.equal(JSON.stringify(logs).includes('must-not-log'), false);
});

test('cancel at period end retains the active plan period', () => {
  const webhook = loadSubscriptionPolicy();
  const state = webhook.subscriptionBillingState(
    'customer.subscription.updated',
    cloverSubscription({planPeriodEnd: 1_900_000_060, cancelAtPeriodEnd: true}),
  );
  assert.equal(state.status, 'active');
  assert.equal(state.cancelAtPeriodEnd, true);
  assert.equal(state.scheduledCancellationAt, 1_900_000_060_000);
  assert.equal(state.currentPeriodEnd, 1_900_000_060_000);
});

test('Clover cancel_at matching the plan period is canonical period-end cancellation', () => {
  const webhook = loadSubscriptionPolicy();
  const periodEnd = 1_900_000_061;
  const state = webhook.subscriptionBillingState(
    'customer.subscription.updated',
    cloverSubscription({
      planPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      cancelAt: periodEnd,
      canceledAt: 1_780_000_000,
    }),
  );
  assert.equal(state.status, 'active');
  assert.equal(state.cancelAtPeriodEnd, true);
  assert.equal(state.scheduledCancellationAt, periodEnd * 1000);
  assert.equal(state.currentPeriodEnd, periodEnd * 1000);
});

test('future cancel_at outside the plan period is preserved without period-end labeling', () => {
  const webhook = loadSubscriptionPolicy();
  const subscription = cloverSubscription({
    planPeriodEnd: 1_900_000_070,
    cancelAt: 1_850_000_065,
  });
  const cancellation = webhook.resolveScheduledCancellation(subscription, 1_800_000_000_000);
  assert.deepEqual(cancellation, {
    cancelAtPeriodEnd: false,
    scheduledCancellationAt: 1_850_000_065_000,
  });
});

test('subscription without cancellation fields remains scheduled to renew', () => {
  const webhook = loadSubscriptionPolicy();
  const cancellation = webhook.resolveScheduledCancellation(
    cloverSubscription({planPeriodEnd: 1_900_000_080}),
    1_800_000_000_000,
  );
  assert.deepEqual(cancellation, {
    cancelAtPeriodEnd: false,
    scheduledCancellationAt: null,
  });
});

test('AI Pack period never determines base-plan period-end cancellation semantics', () => {
  const webhook = loadSubscriptionPolicy();
  const aiPackPeriodEnd = 1_850_000_090;
  const cancellation = webhook.resolveScheduledCancellation(
    cloverSubscription({
      planPeriodEnd: 1_900_000_091,
      aiPackPeriodEnd,
      cancelAt: aiPackPeriodEnd,
    }),
    1_800_000_000_000,
  );
  assert.deepEqual(cancellation, {
    cancelAtPeriodEnd: false,
    scheduledCancellationAt: aiPackPeriodEnd * 1000,
  });
});

test('subscription deletion downgrades to Free and clears the paid period and add-on', () => {
  const webhook = loadSubscriptionPolicy();
  const state = webhook.subscriptionBillingState(
    'customer.subscription.deleted',
    cloverSubscription({planPeriodEnd: 1_900_000_070, aiPackPeriodEnd: 1_900_000_080, cancelAtPeriodEnd: true}),
  );
  assert.deepEqual(state, {
    status: 'canceled',
    currentPeriodEnd: 0,
    cancelAtPeriodEnd: false,
    scheduledCancellationAt: null,
    interval: null,
    priceId: null,
    aiPackItemExists: false,
    aiPackStatus: 'none',
    aiPackPaidThrough: null,
    aiPackOperationId: null,
    aiPackRequestedAt: null,
    aiPackCancelAtPeriodEnd: false,
    aiPackScheduledRemovalAt: null,
    aiPackRemovalOperationId: null,
    aiPackRemovalRequestedAt: null,
    aiPackResumeOperationId: null,
    aiPackResumeRequestedAt: null,
    addons: {aiPack: false},
    plan: 'free',
  });
});

test('payment_succeeded sends the existing email once; invoice.paid sends none', async () => {
  let event;
  const records = new Map();
  const emails = [];
  const templates = [];
  const db = {collection: name => ({doc: id => ({
    get: async () => name === 'users' ? {data: () => ({email:'fixture@example.test',displayName:'Fixture',billing:{plan:'family',interval:'year'}})} : {exists:records.has(id)},
    set: async value => records.set(id,value),
    update: async value => records.set(id,{...records.get(id),...value}),
  })})};
  class Stripe { constructor() {
    this.webhooks = {constructEvent: () => event};
    this.customers = {retrieve: async () => ({metadata:{kr_uid:'fixture'}})};
  }}
  const mocks = {
    'firebase-functions/v2/https': {onRequest: (_options, handler) => handler},
    'firebase-functions/logger': {info(){},warn(){},error(){}},
    'firebase-admin': {apps:[{}],firestore: () => db},
    stripe: Stripe,
    './billingSchedules': require('../lib/billingSchedules'),
    './storageAuthority': require('../lib/storageAuthority'),
    './billingCatalog': {isSupportedWebhookType: type => ['invoice.payment_succeeded'].includes(type)},
    './config': {functionsEnv: require('../lib/config').functionsConfig({STRIPE_SECRET_KEY:'fixture',STRIPE_WEBHOOK_SECRET:'fixture'})},
    './sendEmail': {sendEmail: async value => emails.push(value)},
    './emailTemplates': {paymentSuccessEmail: (...args) => {templates.push(args);return {subject:'Success',html:'fixture'};}},
  };
  const mod = {exports:{}};
  new Function('require','module','exports',fs.readFileSync(path.join(__dirname,'../lib/stripeWebhook.js'),'utf8'))(name => {
    if (!(name in mocks)) throw new Error(`Unexpected dependency ${name}`);
    return mocks[name];
  },mod,mod.exports);
  const invoke = async (id,type) => {
    event = {id,type,data:{object:{id:'in_fixture',customer:'cus_fixture',amount_paid:1999,hosted_invoice_url:'https://example.test/invoice',lines:{data:[]}}}};
    let status;
    await mod.exports.stripeWebhook({method:'POST',headers:{'stripe-signature':'fixture'},rawBody:Buffer.from('fixture')},{status(value){status=value;return this;},send(){}});
    assert.equal(status,200);
  };
  await invoke('evt_success','invoice.payment_succeeded');
  assert.deepEqual(templates[0],['Fixture','Family (Annual)','$19.99','Next billing cycle','https://example.test/invoice']);
  assert.equal(emails[0].to,'fixture@example.test');
  await invoke('evt_success','invoice.payment_succeeded');
  await invoke('evt_paid','invoice.paid');
  assert.equal(emails.length,1);
});

test('webhook policy rejects stale subscription state and unsupported aliases', async () => {
  // The compiled handler exports these pure policy helpers without requiring a Stripe call.
  const fs = require('node:fs');
  const path = require('node:path');
  const mod = {exports:{}};
  const mocks = {
    './config': {functionsEnv: require('../lib/config').functionsConfig({STRIPE_SECRET_KEY:'fixture',STRIPE_WEBHOOK_SECRET:'fixture'})},
    './billingSchedules': require('../lib/billingSchedules'),
    './storageAuthority': require('../lib/storageAuthority'),
    './billingCatalog': {isSupportedWebhookType: type => ['invoice.payment_succeeded'].includes(type)},
    'firebase-functions/v2/https': {onRequest: (_options, handler) => handler},
    'firebase-functions/logger': {info(){},warn(){},error(){}},
    'firebase-admin': {apps:[{}],firestore: () => ({})},
    'stripe': class Stripe {},
    './sendEmail': {sendEmail: async () => {}},
    './emailTemplates': {paymentSuccessEmail: () => ({subject:'',html:''}),paymentFailedEmail: () => ({subject:'',html:''})},
  };
  new Function('require','module','exports',fs.readFileSync(path.join(__dirname,'../lib/stripeWebhook.js'),'utf8'))(name => mocks[name], mod, mod.exports);
  assert.equal(mod.exports.shouldApplyBillingEvent(2000, 1999), false);
  assert.equal(mod.exports.shouldApplyBillingEvent(2000, 2001), true);
  for (const status of ['active','trialing','past_due','unpaid','incomplete','incomplete_expired','canceled','paused']) {
    assert.equal(mod.exports.normalizeStripeStatus(status),status);
  }
});

function transactionalStore(initial, barrierReads = 0) {
  const docs = new Map(Object.entries(initial).map(([key, value]) => [key, {value, version: 0}]));
  let waitingReads = 0;
  let releaseReads;
  const readsReleased = new Promise(resolve => { releaseReads = resolve; });

  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const refFor = (collection, id) => ({
    key: `${collection}/${id}`,
    collection,
    id,
    get: async () => {
      const entry = docs.get(`${collection}/${id}`);
      return {exists: Boolean(entry), data: () => clone(entry?.value)};
    },
    set: async (value, options) => {
      const key = `${collection}/${id}`;
      const current = docs.get(key);
      const next = options?.merge ? merge(current?.value, value) : value;
      docs.set(key, {value: clone(next), version: (current?.version ?? -1) + 1});
    },
    update: async value => {
      const key = `${collection}/${id}`;
      const current = docs.get(key);
      docs.set(key, {value: clone(merge(current?.value, value)), version: (current?.version ?? -1) + 1});
    },
    collection: name => ({doc: nestedId => refFor(`${collection}/${id}/${name}`,nestedId)}),
  });
  const merge = (before, patch) => ({...(before || {}), ...patch});

  const store = {
    collection: collection => ({doc: id => refFor(collection, id),where: (field, op, value) => ({limit: () => ({query: true,collection,field,value})})}),
    runTransaction: async callback => {
      for (;;) {
        const reads = new Map();
        const writes = [];
        const transaction = {
          get: async ref => {
            if (ref.query) {
              const matches = [...docs].filter(([key, entry]) => key.startsWith(ref.collection + '/') && ref.field.split('.').reduce((v, k) => v?.[k], entry.value) === ref.value);
              for (const [key, entry] of matches) if (!reads.has(key)) reads.set(key, entry.version);
              return {empty: !matches.length, size: matches.length, docs: matches.map(([key, entry]) => ({id: key.slice(ref.collection.length + 1), ref: refFor(ref.collection, key.slice(ref.collection.length + 1)), data: () => clone(entry.value)}))};
            }
            const entry = docs.get(ref.key);
            if (!reads.has(ref.key)) reads.set(ref.key, entry?.version ?? -1);
            waitingReads += 1;
            if (barrierReads && waitingReads >= barrierReads) releaseReads();
            if (barrierReads && waitingReads < barrierReads) await readsReleased;
            return {exists: Boolean(entry), data: () => clone(entry?.value)};
          },
          set: (ref, value, options) => writes.push({ref, value, options}),
          update: (ref, value) => writes.push({ref, value, options: {merge: true}}),
          create: (ref, value) => writes.push({ref, value, create: true}),
        };
        const result = await callback(transaction);
        const changed = [...reads].some(([key, version]) => (docs.get(key)?.version ?? -1) !== version);
        if (changed) continue;
        for (const write of writes) {
          const key = write.ref.key;
          const current = docs.get(key);
          if (write.create && current) throw new Error(`Document already exists: ${key}`);
          const value = write.options?.merge ? merge(current?.value, write.value) : write.value;
          docs.set(key, {value: clone(value), version: (current?.version ?? -1) + 1});
        }
        return result;
      }
    },
    read: (collection, id) => clone(docs.get(`${collection}/${id}`)?.value),
  };
  return store;
}

function loadOrderingModule(store) {
  const mod = {exports:{}};
  const mocks = {
    './config': {functionsEnv: require('../lib/config').functionsConfig({STRIPE_SECRET_KEY:'fixture',STRIPE_WEBHOOK_SECRET:'fixture'})},
    './billingSchedules': require('../lib/billingSchedules'),
    './storageAuthority': require('../lib/storageAuthority'),
    './billingCatalog': {isSupportedWebhookType: () => false},
    'firebase-functions/v2/https': {onRequest: (_options, handler) => handler},
    'firebase-functions/logger': {info(){},warn(){},error(){}},
    'firebase-admin': {apps:[{}],firestore: () => store},
    'stripe': class Stripe {},
    './sendEmail': {sendEmail: async () => {}},
    './emailTemplates': {paymentSuccessEmail: () => ({subject:'',html:''}),paymentFailedEmail: () => ({subject:'',html:''})},
  };
  new Function('require','module','exports',fs.readFileSync(path.join(__dirname,'../lib/stripeWebhook.js'),'utf8'))(
    name => mocks[name], mod, mod.exports,
  );
  return mod.exports;
}

function loadBillingWebhookModule(store, state) {
  const mod = {exports:{}};
  class Stripe {
    constructor() {
      this.webhooks = {constructEvent: () => state.event};
      this.subscriptions = {retrieve: async () => state.subscription};
      this.customers = {retrieve: async () => state.customer};
    }
  }
  const mocks = {
    './config': {functionsEnv: require('../lib/config').functionsConfig({
      STRIPE_SECRET_KEY:'fixture',
      STRIPE_WEBHOOK_SECRET:'fixture',
      STRIPE_PRICE_AI_PACK:'price_ai_pack',
    })},
    './billingSchedules': require('../lib/billingSchedules'),
    './storageAuthority': require('../lib/storageAuthority'),
    './billingCatalog': {isSupportedWebhookType: type => [
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'customer.subscription.pending_update_applied',
      'customer.subscription.pending_update_expired',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
    ].includes(type)},
    'firebase-functions/v2/https': {onRequest: (_options, handler) => handler},
    'firebase-functions/logger': {info(){},warn(){},error(){}},
    'firebase-admin': {apps:[{}],firestore: () => store},
    stripe: Stripe,
    './sendEmail': {sendEmail: async () => ({status:'sent'})},
    './emailTemplates': {
      paymentSuccessEmail: () => ({subject:'success',html:'fixture'}),
      paymentFailedEmail: () => ({subject:'failed',html:'fixture'}),
    },
  };
  new Function('require','module','exports',fs.readFileSync(path.join(__dirname,'../lib/stripeWebhook.js'),'utf8'))(
    name => mocks[name], mod, mod.exports,
  );
  return mod.exports;
}

function aiPackInvoice({id = 'in_ai_pack', subscriptionId = 'sub_clover_fixture', paidThrough = 1_900_000_000} = {}) {
  return {
    id,
    customer:'cus_fixture',
    status:'paid',amount_remaining:0,
    amount_paid:399,
    hosted_invoice_url:'https://example.test/invoice',
    parent:{subscription_details:{subscription:subscriptionId}},
    lines:{data:[{
      amount:399,
      pricing:{price_details:{price:{id:'price_ai_pack',metadata:{kr_addon:'ai_pack'}}}},
      period:{start:1_800_000_000,end:paidThrough},
    }]},
  };
}

async function invokeWebhook(handler, event) {
  let status;
  let body;
  await handler(
    {method:'POST',headers:{'stripe-signature':'fixture'},rawBody:Buffer.from('fixture')},
    {status(value){status=value;return this;},send(value){body=value;}},
  );
  assert.equal(status, 200);
  return body;
}

test('new AI Pack item is persisted as pending before payment succeeds', async () => {
  const store = transactionalStore({'users/fixture': {billing: {
    stripeCustomerId:'cus_fixture',stripeSubscriptionId:'sub_clover_fixture',plan:'pro',status:'active',aiPackItemExists:false,aiPackStatus:'none',aiPackPaidThrough:null,addons:{aiPack:false},latestStripeEventCreated:0,
  }}});
  const webhook = loadOrderingModule(store);
  const incoming = webhook.subscriptionBillingState(
    'customer.subscription.updated',
    cloverSubscription({planPeriodEnd:1_900_000_000,aiPackPeriodEnd:1_900_000_000}),
  );
  await webhook.updateBillingIfNewer('fixture', 1000, incoming);
  const billing = store.read('users','fixture').billing;
  assert.equal(billing.aiPackItemExists, true);
  assert.equal(billing.aiPackStatus, 'pending');
  assert.equal(billing.aiPackPaidThrough, null);
  assert.equal(billing.addons.aiPack, false);
});

test('qualifying paid invoice activates user and Family AI Pack entitlement transactionally', async () => {
  const initial = {
    aiPackItemExists:true,aiPackStatus:'pending',aiPackPaidThrough:null,aiPackOperationId:'op_fixture',addons:{aiPack:false},
  };
  const store = transactionalStore({
    'users/fixture': {email:'fixture@example.test',billing:{plan:'family',status:'active',stripeCustomerId:'cus_fixture',stripeSubscriptionId:'sub_clover_fixture',...initial}},
    'families/family_fixture': {ownerUid:'fixture',plan:{plan:'family',status:'active',stripeCustomerId:'cus_fixture',stripeSubscriptionId:'sub_clover_fixture',...initial}},
  });
  const state = {
    subscription:cloverSubscription({plan:'family',planPeriodEnd:1_900_000_000,aiPackPeriodEnd:1_900_000_000}),
    customer:{id:'cus_fixture',metadata:{kr_uid:'fixture',kr_family_id:'family_fixture'}},
  };
  const webhook = loadBillingWebhookModule(store, state);
  const event = {id:'evt_ai_paid',type:'invoice.payment_succeeded',created:1_800_000_000};
  assert.equal(await webhook.recordAIPackGrant(event, aiPackInvoice(), 'cus_fixture'), true);
  for (const billing of [store.read('users','fixture').billing, store.read('families','family_fixture').plan]) {
    assert.equal(billing.aiPackStatus, 'active');
    assert.equal(billing.aiPackItemExists, true);
    assert.equal(billing.aiPackPaidThrough, 1_900_000_000_000);
    assert.equal(billing.addons.aiPack, true);
  }
  assert.equal(store.read('ai_pack_grants','invoice_in_ai_pack').actions, 1000);
});

test('failed qualifying invoice leaves pending entitlement inactive', async () => {
  const store = transactionalStore({'users/fixture': {
    email:'fixture@example.test',displayName:'Fixture',
    billing:{stripeCustomerId:'cus_fixture',stripeSubscriptionId:'sub_clover_fixture',plan:'pro',interval:'month',status:'active',aiPackItemExists:true,aiPackStatus:'pending',aiPackPaidThrough:null,addons:{aiPack:false}},
  }});
  const state = {
    subscription:cloverSubscription({planPeriodEnd:1_900_000_000,aiPackPeriodEnd:1_900_000_000}),
    customer:{id:'cus_fixture',metadata:{kr_uid:'fixture'}},
    event:{id:'evt_ai_failed',type:'invoice.payment_failed',created:1_800_000_000,data:{object:aiPackInvoice()}},
  };
  const webhook = loadBillingWebhookModule(store, state);
  await invokeWebhook(webhook.stripeWebhook, state.event);
  const billing = store.read('users','fixture').billing;
  assert.equal(billing.aiPackStatus, 'pending');
  assert.equal(billing.addons.aiPack, false);
  assert.equal(store.read('ai_pack_grants','evt_ai_failed'), undefined);
});

test('duplicate payment webhook creates one paid grant and preserves active state', async () => {
  const store = transactionalStore({'users/fixture': {
    email:'fixture@example.test',displayName:'Fixture',
    billing:{stripeCustomerId:'cus_fixture',stripeSubscriptionId:'sub_clover_fixture',plan:'pro',interval:'month',status:'active',aiPackItemExists:true,aiPackStatus:'pending',aiPackPaidThrough:null,addons:{aiPack:false}},
  }});
  const state = {
    subscription:cloverSubscription({planPeriodEnd:1_900_000_000,aiPackPeriodEnd:1_900_000_000}),
    customer:{id:'cus_fixture',metadata:{kr_uid:'fixture'}},
    event:{id:'evt_ai_duplicate',type:'invoice.payment_succeeded',created:1_800_000_000,data:{object:aiPackInvoice()}},
  };
  const webhook = loadBillingWebhookModule(store, state);
  await invokeWebhook(webhook.stripeWebhook, state.event);
  await invokeWebhook(webhook.stripeWebhook, state.event);
  assert.equal(store.read('users','fixture').billing.aiPackStatus, 'active');
  assert.equal(store.read('users','fixture').billing.addons.aiPack, true);
  assert.equal(store.read('ai_pack_grants','invoice_in_ai_pack').actions, 1000);
  assert.equal(store.read('billing_events','evt_ai_duplicate').status, 'processed');
});

test('paid invoice arriving before subscription update remains active afterward', async () => {
  const store = transactionalStore({'users/fixture': {billing: {
    stripeCustomerId:'cus_fixture',stripeSubscriptionId:'sub_clover_fixture',plan:'pro',status:'active',aiPackItemExists:false,aiPackStatus:'none',aiPackPaidThrough:null,addons:{aiPack:false},latestStripeEventCreated:0,
  }}});
  const pendingSubscription = cloverSubscription({planPeriodEnd:1_900_000_000});
  pendingSubscription.pending_update = {
    expires_at:1_800_000_600,
    subscription_items:[{
      id:'si_ai_pack_pending',
      current_period_start:1_800_000_000,
      current_period_end:1_900_000_000,
      price:{id:'price_ai_pack',metadata:{kr_addon:'ai_pack'},recurring:{interval:'month'}},
    }],
  };
  const state = {
    subscription:pendingSubscription,
    customer:{id:'cus_fixture',metadata:{kr_uid:'fixture'}},
  };
  const webhook = loadBillingWebhookModule(store, state);
  await webhook.recordAIPackGrant(
    {id:'evt_ai_paid_first',type:'invoice.payment_succeeded',created:1_800_000_000},
    aiPackInvoice(),
    'cus_fixture',
  );
  const pendingIncoming = webhook.subscriptionBillingState('customer.subscription.updated', pendingSubscription);
  await webhook.updateBillingIfNewer('fixture', 1_800_000_000_500, pendingIncoming);
  assert.equal(store.read('users','fixture').billing.aiPackStatus, 'active');
  state.subscription = cloverSubscription({planPeriodEnd:1_900_000_000,aiPackPeriodEnd:1_900_000_000});
  const incoming = webhook.subscriptionBillingState('customer.subscription.pending_update_applied', state.subscription);
  await webhook.updateBillingIfNewer('fixture', 1_800_000_001_000, incoming);
  const billing = store.read('users','fixture').billing;
  assert.equal(billing.aiPackStatus, 'active');
  assert.equal(billing.aiPackPaidThrough, 1_900_000_000_000);
  assert.equal(billing.addons.aiPack, true);
});

test('non-entitled base status preserves canonical paid-through AI state but never grants paid access', () => {
  const webhook = loadSubscriptionPolicy();
  const paidThrough = 1_900_000_000_000;
  const previous = {
    plan:'family',
    status:'active',
    aiPackItemExists:true,
    aiPackStatus:'active',
    aiPackPaidThrough:paidThrough,
    addons:{aiPack:true},
  };
  const pastDueIncoming = webhook.subscriptionBillingState(
    'customer.subscription.updated',
    cloverSubscription({plan:'family',status:'past_due',planPeriodEnd:1_900_000_100,aiPackPeriodEnd:1_900_000_000}),
  );
  const pastDue = webhook.reconcileSubscriptionAIPackState(previous,pastDueIncoming,1_800_000_000_000);
  assert.equal(pastDue.status,'past_due');
  assert.equal(pastDue.aiPackStatus,'active');
  assert.equal(pastDue.aiPackPaidThrough,paidThrough);
  assert.equal(pastDue.addons.aiPack,true);

  const recoveredIncoming = webhook.subscriptionBillingState(
    'customer.subscription.updated',
    cloverSubscription({plan:'family',status:'active',planPeriodEnd:1_900_000_200,aiPackPeriodEnd:1_900_000_000}),
  );
  const recovered = webhook.reconcileSubscriptionAIPackState(pastDue,recoveredIncoming,1_800_000_000_000);
  assert.equal(recovered.status,'active');
  assert.equal(recovered.aiPackStatus,'active');
  assert.equal(recovered.aiPackPaidThrough,paidThrough);
  assert.equal(recovered.addons.aiPack,true);
});

test('past_due Family webhook preserves workspace and pooled usage while removing paid status', async () => {
  const paidThrough = 1_900_000_000_000;
  const store = transactionalStore({
    'users/fixture':{family:{familyId:'family_fixture'},billing:{
      plan:'family',status:'active',currentPeriodEnd:paidThrough,
      stripeCustomerId:'cus_fixture',stripeSubscriptionId:'sub_clover_fixture',
      aiPackItemExists:true,aiPackStatus:'active',aiPackPaidThrough:paidThrough,addons:{aiPack:true},
      latestStripeEventCreated:0,
    },usage:{monthKey:'2026-09',aiActionsUsed:19}},
    'families/family_fixture':{ownerUid:'fixture',workspaceName:'Preserved',plan:{
      plan:'family',status:'active',currentPeriodEnd:paidThrough,
      stripeCustomerId:'cus_fixture',stripeSubscriptionId:'sub_clover_fixture',
      aiPackItemExists:true,aiPackStatus:'active',aiPackPaidThrough:paidThrough,addons:{aiPack:true},
      latestStripeEventCreated:0,
    },usage:{monthKey:'2026-09',aiActionsUsed:41,aiActionsAllowance:1600}},
    'families/family_fixture/seats/owner':{uid:'fixture',status:'active',role:'owner'},
  });
  const webhook = loadOrderingModule(store);
  const incoming = webhook.subscriptionBillingState(
    'customer.subscription.updated',
    cloverSubscription({plan:'family',status:'past_due',planPeriodEnd:1_900_000_100,aiPackPeriodEnd:1_900_000_000}),
  );
  await webhook.updateBillingIfNewer('fixture',1_800_000_001_000,incoming);
  await webhook.updateFamilyIfNewer('family_fixture',1_800_000_001_000,incoming);
  const user = store.read('users','fixture');
  const family = store.read('families','family_fixture');
  assert.equal(user.billing.plan,'family');
  assert.equal(user.billing.status,'past_due');
  assert.equal(user.billing.aiPackPaidThrough,paidThrough);
  assert.equal(family.plan.plan,'family');
  assert.equal(family.plan.status,'past_due');
  assert.equal(family.plan.aiPackPaidThrough,paidThrough);
  assert.equal(family.workspaceName,'Preserved');
  assert.equal(family.usage.aiActionsUsed,41);
  assert.equal(store.read('families/family_fixture/seats','owner').status,'active');
});

test('AI Pack removal and terminal base cancellation clear paid entitlement', async () => {
  const active = {
    plan:'pro',status:'active',aiPackItemExists:true,aiPackStatus:'active',aiPackPaidThrough:1_900_000_000_000,addons:{aiPack:true},latestStripeEventCreated:0,
  };
  const store = transactionalStore({'users/fixture': {billing:active}});
  const webhook = loadOrderingModule(store);
  await webhook.updateBillingIfNewer('fixture', 1000, webhook.subscriptionBillingState(
    'customer.subscription.updated',cloverSubscription({planPeriodEnd:1_900_000_000}),
  ));
  let billing = store.read('users','fixture').billing;
  assert.equal(billing.aiPackItemExists, false);
  assert.equal(billing.aiPackStatus, 'none');
  assert.equal(billing.addons.aiPack, false);

  const canceled = cloverSubscription({planPeriodEnd:1_900_000_000,aiPackPeriodEnd:1_900_000_000});
  canceled.status = 'canceled';
  await webhook.updateBillingIfNewer('fixture', 2000, webhook.subscriptionBillingState('customer.subscription.updated',canceled));
  billing = store.read('users','fixture').billing;
  assert.equal(billing.aiPackItemExists, true);
  assert.equal(billing.aiPackStatus, 'none');
  assert.equal(billing.aiPackPaidThrough, null);
  assert.equal(billing.addons.aiPack, false);
});

test('scheduled AI Pack removal preserves prepaid entitlement after the Stripe item disappears', () => {
  const webhook = loadSubscriptionPolicy();
  const paidThrough = 1_900_000_000_000;
  const previous = {
    plan:'pro',
    status:'active',
    aiPackItemExists:true,
    aiPackStatus:'active',
    aiPackPaidThrough:paidThrough,
    aiPackRemovalOperationId:'remove_fixture',
    aiPackRemovalRequestedAt:1_800_000_000_000,
    aiPackCancelAtPeriodEnd:false,
    aiPackScheduledRemovalAt:null,
    addons:{aiPack:true},
  };
  const incoming = webhook.subscriptionBillingState(
    'customer.subscription.updated',
    cloverSubscription({planPeriodEnd:1_900_000_100}),
  );
  const reconciled = webhook.reconcileSubscriptionAIPackState(previous,incoming,1_800_000_000_000);
  assert.equal(reconciled.aiPackItemExists,false);
  assert.equal(reconciled.aiPackStatus,'active');
  assert.equal(reconciled.aiPackPaidThrough,paidThrough);
  assert.equal(reconciled.aiPackCancelAtPeriodEnd,true);
  assert.equal(reconciled.aiPackScheduledRemovalAt,paidThrough);
  assert.equal(reconciled.aiPackRemovalOperationId,null);
  assert.equal(reconciled.addons.aiPack,true);
  assert.equal(reconciled.plan,'pro');
  assert.equal(reconciled.cancelAtPeriodEnd,false);

  const staleItemPresent = webhook.subscriptionBillingState(
    'customer.subscription.updated',
    cloverSubscription({planPeriodEnd:1_900_000_100,aiPackPeriodEnd:1_900_000_000}),
  );
  const afterStaleEvent = webhook.reconcileSubscriptionAIPackState(
    reconciled,
    staleItemPresent,
    1_800_000_000_100,
  );
  assert.equal(afterStaleEvent.aiPackStatus,'active');
  assert.equal(afterStaleEvent.aiPackCancelAtPeriodEnd,true);
  assert.equal(afterStaleEvent.aiPackScheduledRemovalAt,paidThrough);
});

test('scheduled AI Pack removal expires closed without changing the active base plan', () => {
  const webhook = loadSubscriptionPolicy();
  const paidThrough = 1_800_000_000_000;
  const previous = {
    plan:'family',
    status:'active',
    aiPackItemExists:false,
    aiPackStatus:'active',
    aiPackPaidThrough:paidThrough,
    aiPackCancelAtPeriodEnd:true,
    aiPackScheduledRemovalAt:paidThrough,
    addons:{aiPack:true},
  };
  const incoming = webhook.subscriptionBillingState(
    'customer.subscription.updated',
    cloverSubscription({plan:'family',planPeriodEnd:1_900_000_100}),
  );
  const reconciled = webhook.reconcileSubscriptionAIPackState(previous,incoming,paidThrough);
  assert.equal(reconciled.plan,'family');
  assert.equal(reconciled.status,'active');
  assert.equal(reconciled.aiPackStatus,'none');
  assert.equal(reconciled.aiPackPaidThrough,paidThrough); // expired historical payment retained
  assert.equal(reconciled.aiPackCancelAtPeriodEnd,false);
  assert.equal(reconciled.addons.aiPack,false);
});

test('subscription update confirms resumed renewal without extending or granting AI Pack access', async () => {
  const paidThrough = 1_900_000_000_000;
  const previous = {
    plan:'pro',
    status:'active',
    aiPackItemExists:false,
    aiPackStatus:'active',
    aiPackPaidThrough:paidThrough,
    aiPackCancelAtPeriodEnd:true,
    aiPackScheduledRemovalAt:paidThrough,
    aiPackResumeOperationId:'resume_fixture',
    aiPackResumeRequestedAt:1_800_000_000_000,
    addons:{aiPack:true},
    latestStripeEventCreated:0,
  };
  const store = transactionalStore({'users/fixture':{billing:previous}});
  const webhook = loadOrderingModule(store);
  const incoming = webhook.subscriptionBillingState(
    'customer.subscription.updated',
    cloverSubscription({planPeriodEnd:1_900_000_100,aiPackPeriodEnd:1_900_000_000}),
  );
  await webhook.updateBillingIfNewer('fixture',1_800_000_001_000,incoming);
  const billing = store.read('users','fixture').billing;
  assert.equal(billing.aiPackItemExists,true);
  assert.equal(billing.aiPackStatus,'active');
  assert.equal(billing.aiPackPaidThrough,paidThrough);
  assert.equal(billing.aiPackCancelAtPeriodEnd,false);
  assert.equal(billing.aiPackScheduledRemovalAt,null);
  assert.equal(billing.aiPackResumeOperationId,null);
  assert.equal(billing.aiPackResumeRequestedAt,null);
  assert.equal(billing.addons.aiPack,true);
  assert.equal(billing.plan,'pro');
  assert.equal(store.read('ai_pack_grants','evt_resume'),undefined);
});

test('transactional ordering: newer user event remains after an older event', async () => {
  const store = transactionalStore({'users/fixture': {billing: {plan:'free', latestStripeEventCreated: 0}}});
  const webhook = loadOrderingModule(store);
  await webhook.updateBillingIfNewer('fixture', 2000, {plan:'pro'});
  await webhook.updateBillingIfNewer('fixture', 1000, {plan:'free'});
  assert.equal(store.read('users', 'fixture').billing.plan, 'pro');
  assert.equal(store.read('users', 'fixture').billing.latestStripeEventCreated, 2000);
});

test('transactional ordering: concurrent older and newer user events commit newer state', async () => {
  const store = transactionalStore({'users/fixture': {billing: {plan:'free', latestStripeEventCreated: 0}}}, 2);
  const webhook = loadOrderingModule(store);
  await Promise.all([
    webhook.updateBillingIfNewer('fixture', 2000, {plan:'pro'}),
    webhook.updateBillingIfNewer('fixture', 1000, {plan:'free'}),
  ]);
  assert.equal(store.read('users', 'fixture').billing.plan, 'pro');
  assert.equal(store.read('users', 'fixture').billing.latestStripeEventCreated, 2000);
});

test('transactional ordering: equal event timestamps apply the later mutation', async () => {
  const store = transactionalStore({'users/fixture': {billing: {plan:'free', latestStripeEventCreated: 2000}}});
  const webhook = loadOrderingModule(store);
  await webhook.updateBillingIfNewer('fixture', 2000, {plan:'family'});
  assert.equal(store.read('users', 'fixture').billing.plan, 'family');
  assert.equal(store.read('users', 'fixture').billing.latestStripeEventCreated, 2000);
});

test('transactional ordering: Family plan target is protected from older events', async () => {
  const store = transactionalStore({'families/family_fixture': {ownerUid:'fixture',plan: {plan:'free', latestStripeEventCreated: 0}}});
  const webhook = loadOrderingModule(store);
  await webhook.updateFamilyIfNewer('family_fixture', 2000, {plan:'family'});
  await webhook.updateFamilyIfNewer('family_fixture', 1000, {plan:'free'});
  assert.equal(store.read('families', 'family_fixture').plan.plan, 'family');
  assert.equal(store.read('families', 'family_fixture').plan.latestStripeEventCreated, 2000);
});

test('paid Family plan event clears pending upgrade while preserving AI Pack paid-through state', async () => {
  const paidThrough = 2_000_000_000_000;
  const previous = {
    plan:'pro',status:'active',currentPeriodEnd:2_000_000_000_000,
    aiPackItemExists:true,aiPackStatus:'active',aiPackPaidThrough:paidThrough,addons:{aiPack:true},
    planChangeStatus:'pending',planChangeTarget:'family',planChangeInterval:'month',
    planChangeFamilyId:'family_fixture',planChangeOperationId:'upgrade_fixture',
    planChangeRequestedAt:1_800_000_000_000,latestStripeEventCreated:0,
  };
  const store = transactionalStore({'users/fixture':{billing:previous,usage:{monthKey:'2026-09',aiActionsUsed:37}}});
  const webhook = loadOrderingModule(store);
  const incoming = webhook.subscriptionBillingState(
    'customer.subscription.pending_update_applied',
    cloverSubscription({plan:'family',interval:'month',planPeriodEnd:2_000_000_000,aiPackPeriodEnd:2_000_000_000}),
  );
  await webhook.updateBillingIfNewer('fixture',1_800_000_001_000,incoming,'customer.subscription.pending_update_applied');
  const user = store.read('users','fixture');
  assert.equal(user.billing.plan,'family');
  assert.equal(user.billing.planChangeStatus,'none');
  assert.equal(user.billing.planChangeOperationId,null);
  assert.equal(user.billing.aiPackStatus,'active');
  assert.equal(user.billing.aiPackPaidThrough,paidThrough);
  assert.equal(user.billing.addons.aiPack,true);
  assert.equal(user.usage.aiActionsUsed,37);
});

test('Family projection derives an existing paid AI Pack from the matching owner subscription', async () => {
  const paidThrough = 2_000_000_000_000;
  const eventCreated = 1_800_000_001_500;
  const store = transactionalStore({
    'users/fixture':{billing:{
      plan:'family',status:'active',currentPeriodEnd:paidThrough,
      stripeCustomerId:'cus_fixture',stripeSubscriptionId:'sub_clover_fixture',
      aiPackItemExists:true,aiPackStatus:'active',aiPackPaidThrough:paidThrough,
      aiPackCancelAtPeriodEnd:false,aiPackScheduledRemovalAt:null,addons:{aiPack:true},
      latestStripeEventCreated:eventCreated,
    },usage:{monthKey:'2026-09',aiActionsUsed:37}},
    'families/family_fixture':{
      ownerUid:'fixture',
      plan:{
        plan:'family',status:'active',currentPeriodEnd:paidThrough,
        stripeCustomerId:'cus_fixture',stripeSubscriptionId:'sub_clover_fixture',
        aiPackItemExists:true,aiPackStatus:'pending',aiPackPaidThrough:null,addons:{aiPack:false},
        latestStripeEventCreated:0,
      },
      usage:{monthKey:'2026-09',aiActionsUsed:37,aiActionsAllowance:600},
    },
    'ai_pack_grants/grant_one':{uid:'fixture',actions:1000},
    'ai_pack_grants/grant_two':{uid:'fixture',actions:1000},
  });
  const webhook = loadOrderingModule(store);
  const incoming = {
    stripeCustomerId:'cus_fixture',
    stripeSubscriptionId:'sub_clover_fixture',
    ...webhook.subscriptionBillingState(
      'customer.subscription.pending_update_applied',
      cloverSubscription({plan:'family',interval:'month',planPeriodEnd:2_000_000_000,aiPackPeriodEnd:2_000_000_000}),
    ),
    seatLimit:6,
  };
  // Family-only webhook metadata can omit kr_uid; the transaction resolves the
  // owner from the existing Family document before projecting AI state.
  await webhook.updateFamilyIfNewer('family_fixture',eventCreated,incoming);

  const family = store.read('families','family_fixture');
  assert.equal(family.plan.aiPackItemExists,true);
  assert.equal(family.plan.aiPackStatus,'active');
  assert.equal(family.plan.aiPackPaidThrough,paidThrough);
  assert.equal(family.plan.addons.aiPack,true);
  assert.equal(family.usage.aiActionsUsed,37);
  assert.equal(family.usage.aiActionsAllowance,600);
  assert.equal(store.read('ai_pack_grants','grant_one').actions,1000);
  assert.equal(store.read('ai_pack_grants','grant_two').actions,1000);
});

test('Family projection clears stale AI Pack state for a mismatched owner subscription', () => {
  const webhook = loadSubscriptionPolicy();
  const familyPlan = {
    plan:'family',
    stripeCustomerId:'cus_fixture',
    stripeSubscriptionId:'sub_family_fixture',
    aiPackItemExists:true,
    aiPackStatus:'active',
    aiPackPaidThrough:2_000_000_000_000,
    addons:{aiPack:true},
  };
  const projected = webhook.deriveFamilyAIPackState(familyPlan, {
    plan:'family',
    stripeCustomerId:'cus_fixture',
    stripeSubscriptionId:'sub_other_family',
    aiPackItemExists:true,
    aiPackStatus:'active',
    aiPackPaidThrough:2_000_000_000_000,
    addons:{aiPack:true},
  });
  assert.equal(projected.aiPackStatus,'none');
  assert.equal(projected.aiPackItemExists,false);
  assert.equal(projected.addons.aiPack,false);
});

test('failed Family proration marks the upgrade failed without granting Family', async () => {
  const store = transactionalStore({'users/fixture':{billing:{
    plan:'pro',status:'active',planChangeStatus:'pending',planChangeTarget:'family',
    planChangeOperationId:'upgrade_fixture',latestPlanChangeFailureEventCreated:0,
  }}});
  const webhook = loadOrderingModule(store);
  const invoice = {lines:{data:[{price:{id:'price_family_month',metadata:{kr_plan:'family'}}}]}};
  assert.equal(webhook.isFamilyUpgradeInvoice(invoice),true);
  assert.equal(await webhook.markFamilyUpgradePaymentFailed('fixture',1_800_000_002_000),true);
  const billing = store.read('users','fixture').billing;
  assert.equal(billing.plan,'pro');
  assert.equal(billing.planChangeStatus,'failed');
  assert.equal(billing.planChangeFailure,'payment_failed');
});

test('expired pending Family update remains Pro and records a failed upgrade', async () => {
  const store = transactionalStore({'users/fixture':{billing:{
    plan:'pro',status:'active',planChangeStatus:'pending',planChangeTarget:'family',
    planChangeOperationId:'upgrade_fixture',latestStripeEventCreated:0,
  }}});
  const webhook = loadOrderingModule(store);
  const incoming = webhook.subscriptionBillingState(
    'customer.subscription.pending_update_expired',
    cloverSubscription({plan:'pro',interval:'month',planPeriodEnd:2_000_000_000}),
  );
  await webhook.updateBillingIfNewer('fixture',1_800_000_003_000,incoming,'customer.subscription.pending_update_expired');
  const billing = store.read('users','fixture').billing;
  assert.equal(billing.plan,'pro');
  assert.equal(billing.planChangeStatus,'failed');
  assert.equal(billing.planChangeFailure,'payment_expired');
  assert.equal(billing.planChangeOperationId,null);
});

test('successful Family webhook activates exactly one owner seat after authoritative billing writes', async () => {
  const eventCreated = 1_800_000_004_000;
  const store = transactionalStore({
    'users/fixture':{email:'fixture@example.test',billing:{plan:'family',status:'active',latestStripeEventCreated:eventCreated}},
    'families/family_fixture':{ownerUid:'fixture',plan:{plan:'family',status:'active',latestStripeEventCreated:eventCreated}},
  });
  const webhook = loadOrderingModule(store);
  assert.equal(await webhook.activateFamilyOwnerMembership('fixture','family_fixture',eventCreated),true);
  assert.equal(await webhook.activateFamilyOwnerMembership('fixture','family_fixture',eventCreated),true);
  assert.deepEqual(store.read('users','fixture').family,{familyId:'family_fixture',role:'owner',joinedAt:store.read('users','fixture').family.joinedAt});
  const seat = store.read('families/family_fixture/seats','fixture');
  assert.equal(seat.uid,'fixture');
  assert.equal(seat.role,'owner');
  assert.equal(seat.status,'active');
});

test('base Family proration invoice does not create an AI Pack grant', async () => {
  const store = transactionalStore({'users/fixture':{billing:{plan:'pro',status:'active'}}});
  const state = {
    subscription:cloverSubscription({plan:'family',planPeriodEnd:2_000_000_000,aiPackPeriodEnd:2_000_000_000}),
    customer:{id:'cus_fixture',metadata:{kr_uid:'fixture',kr_family_id:'family_fixture'}},
  };
  const webhook = loadBillingWebhookModule(store,state);
  const invoice = {
    id:'in_family_proration',customer:'cus_fixture',
    parent:{subscription_details:{subscription:'sub_clover_fixture'}},
    lines:{data:[{price:{id:'price_family_month',metadata:{kr_plan:'family'}},period:{end:2_000_000_000}}]},
  };
  const granted = await webhook.recordAIPackGrant(
    {id:'evt_family_proration',type:'invoice.payment_succeeded',created:1_800_000_005},
    invoice,
    'cus_fixture',
  );
  assert.equal(granted,false);
  assert.equal(store.read('ai_pack_grants','evt_family_proration'),undefined);
});

test('Family to Pro webhook mutation preserves workspace data and seats', async () => {
  const store = transactionalStore({
    'families/family_fixture':{ownerUid:'fixture',workspaceName:'Preserved',plan:{plan:'family',latestStripeEventCreated:0},usage:{aiActionsUsed:44}},
    'families/family_fixture/seats/member_fixture':{uid:'member_fixture',status:'active'},
  });
  const webhook = loadOrderingModule(store);
  await webhook.updateFamilyIfNewer('family_fixture',2_000,{plan:'pro',status:'active'});
  const family = store.read('families','family_fixture');
  assert.equal(family.plan.plan,'pro');
  assert.equal(family.workspaceName,'Preserved');
  assert.equal(family.usage.aiActionsUsed,44);
  assert.equal(store.read('families/family_fixture/seats','member_fixture').status,'active');
});

test('trusted plan item interval overrides stale subscription metadata during a switch', () => {
  const webhook = loadSubscriptionPolicy();
  const subscription = cloverSubscription({plan:'family',interval:'year',planPeriodEnd:2_000_000_000});
  subscription.metadata.kr_interval = 'month';
  const mapped = webhook.mapSubscriptionToPlan(subscription);
  assert.equal(mapped.plan,'family');
  assert.equal(mapped.interval,'year');
});
