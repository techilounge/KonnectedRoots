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
