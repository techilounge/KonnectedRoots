const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function billing() {
  const calls = [];
  const user = {billing:{stripeCustomerId:'cus_fixture'}};
  class Stripe {
    constructor() {
      this.customers = {retrieve:async () => ({id:'cus_fixture'}), list:async () => ({data:[]}), update:async () => ({id:'cus_fixture'})};
      this.subscriptions = {list:async () => ({data:[]})};
      this.subscriptionItems = {create:async input => {calls.push(input); return {id:'si_fixture'};}};
      this.checkout = {sessions:{create:async input => {calls.push(input); return {id:'cs_fixture',url:'https://example.test/checkout'};}}};
      this.billingPortal = {sessions:{create:async input => {calls.push(input); return {url:'https://example.test/portal'};}}};
    }
  }
  class HttpsError extends Error {constructor(code,message) {super(message);this.code=code;}}
  const mocks = {
    'firebase-functions/v2/https':{onCall:(_options,handler) => handler,HttpsError},
    'firebase-functions/v2':{logger:{info(){},warn(){},error(){}}},
    'firebase-admin':{apps:[{}],firestore:() => ({collection:() => ({doc:(id='fixture') => ({id,get:async () => ({exists:true,data:() => user}),set:async () => {}})})})},
    stripe:Stripe,
    './billingCatalog': {resolvePlanPrice: (_prices, plan, interval) => ({pro:{month:'price_fixture',year:'price_pro_year'},family:{month:'price_family_month',year:'price_family_year'}}[plan]?.[interval] || null)},
    './config': {functionsEnv: require('../lib/config').functionsConfig({STRIPE_SECRET_KEY:'fixture',STRIPE_PRICE_PRO_MONTHLY:'price_fixture',STRIPE_PRICE_PRO_YEARLY:'price_pro_year',STRIPE_PRICE_FAMILY_MONTHLY:'price_family_month',STRIPE_PRICE_FAMILY_YEARLY:'price_family_year',STRIPE_PRICE_AI_PACK:'price_ai_pack',APP_URL:'https://example.test'})},
  };
  const mod = {exports:{}};
  new Function('require','module','exports','process',fs.readFileSync(path.join(__dirname,'../lib/stripeBilling.js'),'utf8'))(
    name => {if (!(name in mocks)) throw Error(name);return mocks[name];},mod,mod.exports,
    {env:{STRIPE_PRICE_PRO_MONTHLY:'price_fixture',APP_URL:'https://example.test'}});
  return {...mod.exports,calls,user};
}

test('checkout and portal reject unauthenticated callers before contacting Stripe', async () => {
  const b = billing();
  for (const handler of [b.createCheckoutSession,b.createPortalSession]) {
    await assert.rejects(handler({data:{}}),error => error.code === 'unauthenticated');
  }
  assert.deepEqual(b.calls,[]);
});

test('checkout retains plan, customer, metadata and redirect configuration', async () => {
  const b = billing();
  const result = await b.createCheckoutSession({auth:{uid:'fixture',token:{email:'fixture@example.test'}},data:{plan:'pro',interval:'month'}});
  assert.equal(result.sessionId,'cs_fixture');
  assert.equal(b.calls[0].customer,'cus_fixture');
  assert.equal(b.calls[0].mode,'subscription');
  assert.deepEqual(b.calls[0].line_items,[{price:'price_fixture',quantity:1}]);
  assert.equal(b.calls[0].subscription_data.metadata.kr_uid,'fixture');
  assert.equal(b.calls[0].success_url,'https://example.test/dashboard?checkout=success');
  b.user.billing.status = 'active';
  await assert.rejects(b.createCheckoutSession({auth:{uid:'fixture',token:{}},data:{plan:'pro',interval:'month'}}),error => error.code === 'already-exists');
  assert.equal(b.calls.length,1);
});

test('portal retains the authenticated customer and billing return URL', async () => {
  const b = billing();
  const result = await b.createPortalSession({auth:{uid:'fixture',token:{}},data:{}});
  assert.equal(result.url,'https://example.test/portal');
  assert.deepEqual(b.calls,[{customer:'cus_fixture',return_url:'https://example.test/settings/billing'}]);
});

test('checkout rejects invalid logical selections and browser price injection', async () => {
  const b = billing();
  for (const data of [
    {plan:'free', interval:'month'},
    {plan:'pro', interval:'quarter'},
    {plan:'pro', interval:'month', priceId:'price_attacker'},
  ]) {
    await assert.rejects(b.createCheckoutSession({auth:{uid:'fixture',token:{email:'fixture@example.test'}},data}), error => error.code === 'invalid-argument');
  }
  assert.equal(b.calls.length, 0);
});

test('checkout resolves yearly and family prices from the server catalog', async () => {
  const b = billing();
  await b.createCheckoutSession({auth:{uid:'fixture',token:{email:'fixture@example.test'}},data:{plan:'family',interval:'year'}});
  assert.equal(b.calls[0].line_items[0].price, 'price_family_year');
  assert.equal(b.calls[0].metadata.kr_price_id, 'price_family_year');
});

test('AI Pack requires an authenticated active paid subscription', async () => {
  const b = billing();
  await assert.rejects(b.addAIPack({auth:{uid:'fixture'},data:{}}), error => error.code === 'failed-precondition');
  b.user.billing = {plan:'pro', status:'active', stripeCustomerId:'cus_fixture', stripeSubscriptionId:'sub_fixture', addons:{aiPack:false}};
  const result = await b.addAIPack({auth:{uid:'fixture'},data:{}});
  assert.equal(result.success, true);
});
