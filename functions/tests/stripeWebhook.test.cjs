const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
    event = {id,type,data:{object:{id:'in_fixture',customer:'cus_fixture',amount_paid:1999,hosted_invoice_url:'https://example.test/invoice'}}};
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
  });
  const merge = (before, patch) => ({...(before || {}), ...patch});

  const store = {
    collection: collection => ({doc: id => refFor(collection, id)}),
    runTransaction: async callback => {
      for (;;) {
        const reads = new Map();
        const writes = [];
        const transaction = {
          get: async ref => {
            const entry = docs.get(ref.key);
            reads.set(ref.key, entry?.version ?? -1);
            waitingReads += 1;
            if (barrierReads && waitingReads >= barrierReads) releaseReads();
            if (barrierReads && waitingReads < barrierReads) await readsReleased;
            return {exists: Boolean(entry), data: () => clone(entry?.value)};
          },
          set: (ref, value, options) => writes.push({ref, value, options}),
          update: (ref, value) => writes.push({ref, value, options: {merge: true}}),
        };
        const result = await callback(transaction);
        const changed = [...reads].some(([key, version]) => (docs.get(key)?.version ?? -1) !== version);
        if (changed) continue;
        for (const write of writes) {
          const key = write.ref.key;
          const current = docs.get(key);
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
  const store = transactionalStore({'families/family_fixture': {plan: {plan:'free', latestStripeEventCreated: 0}}});
  const webhook = loadOrderingModule(store);
  await webhook.updateFamilyIfNewer('family_fixture', 2000, {plan:'family'});
  await webhook.updateFamilyIfNewer('family_fixture', 1000, {plan:'free'});
  assert.equal(store.read('families', 'family_fixture').plan.plan, 'family');
  assert.equal(store.read('families', 'family_fixture').plan.latestStripeEventCreated, 2000);
});
