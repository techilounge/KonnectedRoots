const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function billing(options = {}) {
  const calls = [];
  const subscriptionItemRequests = [];
  const subscriptionItemDeleteRequests = [];
  const subscriptionUpdateRequests = [];
  const customerUpdateRequests = [];
  const nonBillingWrites = [];
  const idempotentCreates = new Map();
  const idempotentDeletes = new Map();
  let subscriptionDeleteFailures = Number(options.subscriptionDeleteFailures || 0);
  const user = {
    billing:{stripeCustomerId:'cus_fixture', ...(options.userBilling || {})},
    usage:structuredClone(options.userUsage || {}),
  };
  if (options.familyId) user.family = {familyId:options.familyId,role:'owner'};
  const family = options.familyId ? {
    ownerUid:'fixture',
    plan:{stripeCustomerId:'cus_fixture',stripeSubscriptionId:'sub_fixture',...(options.familyPlan || {})},
  } : null;
  const plan = options.plan || options.userBilling?.plan || 'pro';
  const aiPackItemCount = options.aiPackItemCount ?? (options.subscriptionHasAIPack === true ? 1 : 0);
  const planInterval = options.interval || options.userBilling?.interval || 'month';
  const planPriceId = plan === 'family'
    ? (planInterval === 'year' ? 'price_family_year' : 'price_family_month')
    : (planInterval === 'year' ? 'price_pro_year' : 'price_fixture');
  let subscriptionItems = [
    {id:'si_plan',quantity:1,current_period_end:2_000_000_000,price:{id:planPriceId,metadata:{kr_plan:plan},recurring:{interval:planInterval}}},
    ...Array.from({length:aiPackItemCount},(_,index) => ({
      id:`si_ai_pack${index || ''}`,
      quantity:1,current_period_end:2_000_000_000,price:{id:'price_ai_pack',metadata:options.aiPackMetadataMissing ? {} : {kr_addon:'ai_pack'},recurring:{interval:'month'}},
    })),
  ];
  let pendingUpdate = options.pendingUpdate || null;
  const subscription = () => ({
    id:'sub_fixture',
    customer:options.subscriptionCustomerId || 'cus_fixture',
    status:options.subscriptionStatus || 'active',
    cancel_at_period_end:options.cancelAtPeriodEnd || false,
    cancel_at:options.cancelAt || null,
    metadata:{kr_plan:plan,kr_interval:planInterval},
    items:{data:structuredClone(subscriptionItems)},
    pending_update:pendingUpdate ? structuredClone(pendingUpdate) : null,
  });
  const customerMetadata = {
    kr_uid:options.customerUid || 'fixture',
    ...(options.familyId ? {kr_family_id:options.familyId} : {}),
  };
  class Stripe {
    constructor() {
      this.customers = {retrieve:async () => ({
        id:'cus_fixture',
        metadata:structuredClone(customerMetadata),
      }), list:async () => ({data:[]}), update:async (id,input) => {
        customerUpdateRequests.push({id,input:structuredClone(input)});
        Object.assign(customerMetadata,input.metadata || {});
        return {id,metadata:structuredClone(customerMetadata)};
      }};
      this.subscriptions = {
        list:async () => ({data:structuredClone(options.listedSubscriptions || [])}),
        retrieve:async () => subscription(),
        update:async (id,input,requestOptions) => {
          subscriptionUpdateRequests.push({id,input:structuredClone(input),requestOptions:structuredClone(requestOptions)});
          if (options.subscriptionUpdateError) throw options.subscriptionUpdateError;
          const targetPriceId = input.items[0].price;
          const targetInterval = targetPriceId === 'price_family_year' ? 'year' : 'month';
          const familyItem = {
            ...subscriptionItems[0],
            id:input.items[0].id,
            quantity:input.items[0].quantity,
            price:{id:targetPriceId,metadata:{kr_plan:'family'},recurring:{interval:targetInterval}},
          };
          if (options.applyFamilyUpgrade) {
            subscriptionItems[0] = familyItem;
            pendingUpdate = null;
          } else {
            pendingUpdate = {subscription_items:[familyItem,...structuredClone(subscriptionItems.slice(1))]};
          }
          return subscription();
        },
      };
      this.prices = {retrieve:async id => {
        if (id === 'price_ai_pack') return {
          id,active:true,currency:'usd',unit_amount:399,recurring:{interval:'month'},
          metadata:options.aiPackPriceMetadataMissing ? {} : {kr_addon:'ai_pack'},
        };
        const interval = id === 'price_family_year' ? 'year' : 'month';
        return {
          id,
          active:options.familyPriceActive !== false,
          currency:'usd',
          unit_amount:options.familyPriceAmount ?? (interval === 'year' ? 9900 : 999),
          recurring:{interval},
          metadata:options.familyPriceMetadataMissing ? {} : {kr_plan:'family'},
        };
      }};
      this.subscriptionItems = {create:async (input, requestOptions) => {
        subscriptionItemRequests.push({input, requestOptions});
        const key = requestOptions?.idempotencyKey;
        if (idempotentCreates.has(key)) return idempotentCreates.get(key);
        if (options.subscriptionCreateError) throw options.subscriptionCreateError;
        const result = {id:'si_ai_pack'};
        idempotentCreates.set(key, result);
        subscriptionItems.push({id:'si_ai_pack',price:{id:'price_ai_pack',metadata:{kr_addon:'ai_pack'}}});
        return result;
      },del:async (id,input,requestOptions) => {
        subscriptionItemDeleteRequests.push({id,input,requestOptions});
        const key = requestOptions?.idempotencyKey;
        if (idempotentDeletes.has(key)) return idempotentDeletes.get(key);
        if (subscriptionDeleteFailures > 0) {
          subscriptionDeleteFailures--;
          throw options.subscriptionDeleteError || new Error('transient deletion failure');
        }
        if (options.subscriptionDeleteError) throw options.subscriptionDeleteError;
        const index = subscriptionItems.findIndex(item => item.id === id);
        if (index < 0) {
          const error = new Error('missing');
          error.code = 'resource_missing';
          error.statusCode = 404;
          throw error;
        }
        const [removed] = subscriptionItems.splice(index,1);
        const result = {...removed,deleted:true};
        idempotentDeletes.set(key,result);
        return result;
      }};
      this.checkout = {sessions:{create:async input => {calls.push(input); return {id:'cs_fixture',url:'https://example.test/checkout'};}}};
      this.billingPortal = {sessions:{create:async input => {calls.push(input); return {url:'https://example.test/portal'};}}};
    }
  }
  class HttpsError extends Error {constructor(code,message) {super(message);this.code=code;}}
  let transactionTail = Promise.resolve();
  const userRef = {
    id:'fixture',
    get:async () => ({exists:true,data:() => structuredClone(user)}),
    set:async value => Object.assign(user, structuredClone(value)),
  };
  const familyDocs = new Map();
  if (family) familyDocs.set(options.familyId,family);
  const seatDocs = new Map();
  const familyRefFor = id => ({
    id,
    get:async () => ({exists:familyDocs.has(id),data:() => structuredClone(familyDocs.get(id))}),
    set:async (value,setOptions) => {
      const next = setOptions?.merge ? {...(familyDocs.get(id) || {}),...structuredClone(value)} : structuredClone(value);
      familyDocs.set(id,next);
      if (id === options.familyId && family) Object.assign(family,next);
    },
    collection:name => ({doc:seatId => ({
      id:seatId,
      get:async () => ({exists:seatDocs.has(`${id}/${name}/${seatId}`),data:() => structuredClone(seatDocs.get(`${id}/${name}/${seatId}`))}),
      set:async value => seatDocs.set(`${id}/${name}/${seatId}`,structuredClone(value)),
    })}),
  });
  const db = {
    collection:name => ({doc:(id) => name === 'users'
      ? userRef
      : name === 'families'
        ? familyRefFor(id || 'family_generated')
        : ({id,set:async value => { nonBillingWrites.push({collection:name,id,value:structuredClone(value)}); }})}),
    runTransaction:callback => {
      const run = transactionTail.then(async () => {
        const writes = [];
        const result = await callback({
          get:async ref => ref.get(),
          set:(ref,value,options) => writes.push({ref,value,options}),
        });
        for (const {ref,value,options} of writes) await ref.set(value,options);
        return result;
      });
      transactionTail = run.catch(() => {});
      return run;
    },
  };
  const mocks = {
    'firebase-functions/v2/https':{onCall:(_options,handler) => handler,HttpsError},
    'firebase-functions/v2':{logger:{info(){},warn(){},error(){}}},
    'firebase-admin':{apps:[{}],firestore:() => db},
    'node:crypto':{randomUUID:() => options.operationId || 'operation-fixture'},
    stripe:Stripe,
    './billingCatalog': {resolvePlanPrice: (_prices, plan, interval) => ({pro:{month:'price_fixture',year:'price_pro_year'},family:{month:'price_family_month',year:'price_family_year'}}[plan]?.[interval] || null)},
    './config': {functionsEnv: require('../lib/config').functionsConfig({STRIPE_SECRET_KEY:'fixture',STRIPE_PRICE_PRO_MONTHLY:'price_fixture',STRIPE_PRICE_PRO_YEARLY:'price_pro_year',STRIPE_PRICE_FAMILY_MONTHLY:'price_family_month',STRIPE_PRICE_FAMILY_YEARLY:'price_family_year',STRIPE_PRICE_AI_PACK:'price_ai_pack',APP_URL:'https://example.test'})},
  };
  const mod = {exports:{}};
  new Function('require','module','exports','process',fs.readFileSync(path.join(__dirname,'../lib/stripeBilling.js'),'utf8'))(
    name => {if (!(name in mocks)) throw Error(name);return mocks[name];},mod,mod.exports,
    {env:{STRIPE_PRICE_PRO_MONTHLY:'price_fixture',APP_URL:'https://example.test'}});
  return {
    ...mod.exports,
    calls,
    user,
    family,
    subscriptionItemRequests,
    subscriptionItemDeleteRequests,
    subscriptionUpdateRequests,
    customerUpdateRequests,
    nonBillingWrites,
    get subscriptionItems() { return structuredClone(subscriptionItems); },
    get actualSubscriptionItemCreates() { return idempotentCreates.size; },
    get actualSubscriptionItemDeletes() { return idempotentDeletes.size; },
    familyAt(id) { return structuredClone(familyDocs.get(id)); },
    familyIds() { return [...familyDocs.keys()]; },
    seatAt(familyId,uid) { return structuredClone(seatDocs.get(`${familyId}/seats/${uid}`)); },
  };
}

function activeProBilling(overrides = {}) {
  return {
    plan:'pro',
    status:'active',
    interval:'month',
    stripeCustomerId:'cus_fixture',
    stripeSubscriptionId:'sub_fixture',
    currentPeriodEnd:2_000_000_000_000,
    cancelAtPeriodEnd:false,
    scheduledCancellationAt:null,
    aiPackItemExists:true,
    aiPackStatus:'active',
    aiPackPaidThrough:2_000_000_000_000,
    aiPackCancelAtPeriodEnd:false,
    aiPackScheduledRemovalAt:null,
    addons:{aiPack:true},
    ...overrides,
  };
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

for (const plan of ['pro','family']) {
  for (const status of ['past_due','unpaid','incomplete','incomplete_expired','paused']) {
    test(`${status} ${plan} rejects Checkout, Family upgrade and every AI Pack mutation without persisted changes`, async () => {
      const userBilling = {...activeAIPackBilling(plan),status};
      const b = billing({
        userBilling,subscriptionStatus:status,subscriptionHasAIPack:true,
        ...(plan === 'family' ? {familyId:'family_fixture',familyPlan:{...userBilling}} : {}),
      });
      const originalUser = structuredClone(b.user);
      const originalFamily = structuredClone(b.family);
      for (const [handler,data] of [
        [b.createCheckoutSession,{plan:'pro',interval:'month'}],
        [b.createCheckoutSession,{plan:'family',interval:'year'}],
        [b.upgradeToFamily,{plan:'family',interval:'month'}],
        [b.addAIPack,{}],[b.removeAIPack,{}],[b.resumeAIPack,{}],
      ]) {
        await assert.rejects(handler({auth:{uid:'fixture',token:{}},data}), error =>
          error.code === 'failed-precondition' && /Fix your payment method in Stripe Portal/.test(error.message));
      }
      assert.deepEqual(b.user,originalUser);
      assert.deepEqual(b.family,originalFamily);
      assert.deepEqual(b.calls,[]);
      assert.deepEqual(b.customerUpdateRequests,[]);
      assert.deepEqual(b.subscriptionUpdateRequests,[]);
      assert.deepEqual(b.subscriptionItemRequests,[]);
      assert.deepEqual(b.subscriptionItemDeleteRequests,[]);
      assert.deepEqual(b.nonBillingWrites,[]);
    });
  }
}

test('Stripe Portal recovery remains available for every payment-attention status', async () => {
  for (const status of ['past_due','unpaid','incomplete','incomplete_expired','paused']) {
    const b = billing({userBilling:{plan:'pro',status,stripeCustomerId:'cus_fixture'}});
    const result = await b.createPortalSession({auth:{uid:'fixture',token:{}},data:{}});
    assert.equal(result.url,'https://example.test/portal');
    assert.deepEqual(b.calls,[{customer:'cus_fixture',return_url:'https://example.test/settings/billing'}]);
  }
});

test('payment-attention Family workspace blocks a linked Free profile from starting Checkout', async () => {
  const b = billing({
    familyId:'family_fixture',userBilling:{plan:'free',status:'none'},
    familyPlan:{plan:'family',status:'past_due'},
  });
  const original = structuredClone(b.user);
  await assert.rejects(b.createCheckoutSession({auth:{uid:'fixture',token:{}},data:{plan:'pro',interval:'month'}}),
    error => error.code === 'failed-precondition' && /Stripe Portal/.test(error.message));
  assert.deepEqual(b.user,original);
  assert.deepEqual(b.calls,[]);
});

test('live Stripe payment-attention state blocks mutations when the canonical snapshot still says active', async () => {
  for (const status of ['past_due','unpaid','incomplete','incomplete_expired','paused']) {
    const b = billing({userBilling:{...activeAIPackBilling(),interval:'month'},subscriptionStatus:status,subscriptionHasAIPack:true});
    const original = structuredClone(b.user);
    for (const [handler,data] of [
      [b.upgradeToFamily,{plan:'family',interval:'month'}],
      [b.addAIPack,{}],[b.removeAIPack,{}],[b.resumeAIPack,{}],
    ]) {
      await assert.rejects(handler({auth:{uid:'fixture',token:{}},data}),
        error => error.code === 'failed-precondition' && /Stripe Portal/.test(error.message));
    }
    assert.deepEqual(b.user,original);
    assert.deepEqual(b.subscriptionUpdateRequests,[]);
    assert.deepEqual(b.subscriptionItemRequests,[]);
    assert.deepEqual(b.subscriptionItemDeleteRequests,[]);
  }
});

test('Checkout refuses unreconciled Stripe payment-attention subscriptions before creating a session', async () => {
  for (const status of ['past_due','unpaid','incomplete','incomplete_expired','paused']) {
    const b = billing({listedSubscriptions:[{id:'sub_unreconciled',status}]});
    await assert.rejects(b.createCheckoutSession({auth:{uid:'fixture',token:{}},data:{plan:'pro',interval:'month'}}),
      error => error.code === 'failed-precondition' && /Stripe Portal/.test(error.message));
    assert.deepEqual(b.calls,[]);
  }
});

test('transactional mutation claims recheck payment attention and leave persisted billing untouched', async () => {
  const b = billing({userBilling:{...activeAIPackBilling(),status:'past_due'}});
  const original = structuredClone(b.user);
  for (const attempt of [
    () => b.claimAIPackOperation('fixture','sub_fixture',false,'operation_fixture'),
    () => b.claimAIPackRemoval('fixture','sub_fixture',true,'operation_fixture'),
    () => b.claimAIPackResume('fixture','sub_fixture',false,'operation_fixture'),
    () => b.claimFamilyUpgrade('fixture','sub_fixture','month','family_fixture','operation_fixture'),
  ]) {
    await assert.rejects(attempt(),error => error.code === 'failed-precondition' && /Stripe Portal/.test(error.message));
  }
  assert.deepEqual(b.user,original);
  assert.deepEqual(b.familyIds(),[]);
  const family = billing({
    userBilling:activeAIPackBilling('family'),familyId:'family_fixture',
    familyPlan:{...activeAIPackBilling('family'),status:'past_due'},
  });
  const originalFamily = structuredClone(family.family);
  const originalOwner = structuredClone(family.user);
  for (const attempt of [
    () => family.claimAIPackOperation('fixture','sub_fixture',false,'operation_fixture'),
    () => family.claimAIPackRemoval('fixture','sub_fixture',true,'operation_fixture'),
    () => family.claimAIPackResume('fixture','sub_fixture',false,'operation_fixture'),
  ]) {
    await assert.rejects(attempt(),error => error.code === 'failed-precondition' && /Stripe Portal/.test(error.message));
  }
  assert.deepEqual(family.user,originalOwner);
  assert.deepEqual(family.family,originalFamily);
});

test('failed Family pending update preserves active Pro without attempting another Stripe update', async () => {
  const b = billing({
    userBilling:activeProBilling({aiPackItemExists:false,aiPackStatus:'none',aiPackPaidThrough:null,addons:{aiPack:false},planChangeStatus:'failed'}),
    pendingUpdate:{subscription_items:[{price:{id:'price_family_month',metadata:{kr_plan:'family'}}}]},
  });
  const result = await b.upgradeToFamily({auth:{uid:'fixture'},data:{plan:'family',interval:'month'}});
  assert.deepEqual(result,{success:false,status:'payment_failed',alreadyPending:true});
  assert.equal(b.user.billing.plan,'pro');
  assert.equal(b.user.billing.status,'active');
  assert.deepEqual(b.subscriptionUpdateRequests,[]);
});

test('checkout rejects invalid logical selections and browser price injection', async () => {
  const b = billing();
  for (const data of [
    {plan:'free', interval:'month'},
    {plan:'pro', interval:'quarter'},
    {plan:'pro', interval:'month', priceId:'price_attacker'},
    {plan:'pro', interval:'month', addons:null},
    {plan:'pro', interval:'month', addons:'true'},
    {plan:'pro', interval:'month', addons:{}},
    {plan:'pro', interval:'month', addons:{aiPack:false}},
    {plan:'pro', interval:'month', addons:{aiPack:'true'}},
    {plan:'pro', interval:'month', addons:{aiPack:1}},
    {plan:'pro', interval:'month', addons:{aiPack:true, extra:true}},
  ]) {
    await assert.rejects(b.createCheckoutSession({auth:{uid:'fixture',token:{email:'fixture@example.test'}},data}), error => error.code === 'invalid-argument');
  }
  assert.equal(b.calls.length, 0);
});

test('normal plan-only checkout passes strict optional add-on validation', async () => {
  const b = billing();
  await b.createCheckoutSession({
    auth:{uid:'fixture',token:{email:'fixture@example.test'}},
    data:{plan:'pro',interval:'month'},
  });
  assert.deepEqual(b.calls[0].line_items, [{price:'price_fixture',quantity:1}]);
});

test('checkout accepts exactly aiPack true and adds the configured add-on price', async () => {
  const b = billing();
  await b.createCheckoutSession({
    auth:{uid:'fixture',token:{email:'fixture@example.test'}},
    data:{plan:'pro',interval:'month',addons:{aiPack:true}},
  });
  assert.deepEqual(b.calls[0].line_items, [
    {price:'price_fixture',quantity:1},
    {price:'price_ai_pack',quantity:1},
  ]);
});

test('checkout resolves yearly and family prices from the server catalog', async () => {
  const b = billing();
  await b.createCheckoutSession({auth:{uid:'fixture',token:{email:'fixture@example.test'}},data:{plan:'family',interval:'year'}});
  assert.equal(b.calls[0].line_items[0].price, 'price_family_year');
  assert.equal(b.calls[0].metadata.kr_price_id, 'price_family_year');
});

test('Pro monthly Family upgrade replaces only the base item with payment-gated immediate proration', async () => {
  const originalUsage = {monthKey:'2026-09',exportsUsed:3,aiActionsUsed:41,aiActionsAllowance:10,storageUsedBytes:1234};
  const paidThrough = 2_000_000_000_000;
  const b = billing({
    userBilling:activeProBilling({aiPackPaidThrough:paidThrough}),
    userUsage:originalUsage,
    subscriptionHasAIPack:true,
  });
  const result = await b.upgradeToFamily({auth:{uid:'fixture'},data:{plan:'family',interval:'month'}});
  assert.deepEqual(result,{success:true,status:'pending',alreadyPending:false});
  assert.equal(b.subscriptionUpdateRequests.length,1);
  assert.deepEqual(b.subscriptionUpdateRequests[0].input,{
    items:[{id:'si_plan',price:'price_family_month',quantity:1}],
    proration_behavior:'always_invoice',
    payment_behavior:'pending_if_incomplete',
  });
  assert.match(b.subscriptionUpdateRequests[0].requestOptions.idempotencyKey,/^kr-family-upgrade:sub_fixture:price_family_month:/);
  assert.equal(b.subscriptionItems.filter(item => item.price.metadata.kr_plan === 'pro').length,1);
  assert.equal(b.subscriptionItems.filter(item => item.price.metadata.kr_plan === 'family').length,0);
  assert.equal(b.subscriptionItems.filter(item => item.price.metadata.kr_addon === 'ai_pack').length,1);
  assert.equal(b.user.billing.plan,'pro');
  assert.equal(b.user.billing.aiPackPaidThrough,paidThrough);
  assert.equal(b.user.billing.planChangeStatus,'pending');
  assert.equal(b.user.family,undefined);
  assert.deepEqual(b.user.usage,originalUsage);
  const familyId = b.familyIds()[0];
  assert.equal(b.familyAt(familyId).plan.status,'none');
  assert.equal(b.familyAt(familyId).usage.aiActionsUsed,41);
  assert.equal(b.familyAt(familyId).usage.aiActionsAllowance,600);
});

test('concurrent Family upgrade requests create one Stripe update and one inactive workspace', async () => {
  const b = billing({userBilling:activeProBilling(),subscriptionHasAIPack:true});
  const results = await Promise.all([
    b.upgradeToFamily({auth:{uid:'fixture'},data:{plan:'family',interval:'month'}}),
    b.upgradeToFamily({auth:{uid:'fixture'},data:{plan:'family',interval:'month'}}),
  ]);
  assert.equal(results.every(result => result.status === 'pending'),true);
  assert.equal(b.subscriptionUpdateRequests.length,1);
  assert.equal(b.familyIds().length,1);
  assert.equal(b.user.family,undefined);
});

test('failed Family upgrade keeps Pro, paid AI Pack and usage authoritative without workspace elevation', async () => {
  const paidThrough = 2_000_000_000_000;
  const b = billing({
    userBilling:activeProBilling({aiPackPaidThrough:paidThrough}),
    userUsage:{monthKey:'2026-09',aiActionsUsed:25},
    subscriptionHasAIPack:true,
    subscriptionUpdateError:new Error('payment request failed'),
  });
  await assert.rejects(
    b.upgradeToFamily({auth:{uid:'fixture'},data:{plan:'family',interval:'month'}}),
    error => error.code === 'unavailable',
  );
  assert.equal(b.user.billing.plan,'pro');
  assert.equal(b.user.billing.aiPackStatus,'active');
  assert.equal(b.user.billing.aiPackPaidThrough,paidThrough);
  assert.equal(b.user.usage.aiActionsUsed,25);
  assert.equal(b.user.family,undefined);
  assert.equal(b.subscriptionItems.filter(item => item.price.metadata.kr_addon === 'ai_pack').length,1);
});

test('Family yearly upgrade uses the approved $99 server price and never a $99.99 price', async () => {
  const b = billing({userBilling:activeProBilling(),subscriptionHasAIPack:true});
  await b.upgradeToFamily({auth:{uid:'fixture'},data:{plan:'family',interval:'year'}});
  assert.equal(b.subscriptionUpdateRequests[0].input.items[0].price,'price_family_year');

  const stale = billing({userBilling:activeProBilling(),subscriptionHasAIPack:true,familyPriceAmount:9999});
  await assert.rejects(
    stale.upgradeToFamily({auth:{uid:'fixture'},data:{plan:'family',interval:'year'}}),
    error => error.code === 'failed-precondition',
  );
  assert.equal(stale.subscriptionUpdateRequests.length,0);
});

test('Family upgrade accepts only logical plan/interval and rejects browser billing authority', async () => {
  const b = billing({userBilling:activeProBilling(),subscriptionHasAIPack:true});
  await assert.rejects(b.upgradeToFamily({data:{plan:'family',interval:'month'}}),error => error.code === 'unauthenticated');
  for (const data of [
    {plan:'pro',interval:'month'},
    {plan:'family',interval:'quarter'},
    {plan:'family',interval:'month',priceId:'price_attacker'},
    {plan:'family',interval:'month',addons:{aiPack:true}},
    {plan:'family',interval:'month',familyId:'family_attacker'},
  ]) {
    await assert.rejects(b.upgradeToFamily({auth:{uid:'fixture'},data}),error => error.code === 'invalid-argument');
  }
  assert.equal(b.subscriptionUpdateRequests.length,0);
});

test('Family upgrade rejects scheduled base cancellation without changing Stripe', async () => {
  const b = billing({
    userBilling:activeProBilling({cancelAtPeriodEnd:true,scheduledCancellationAt:2_000_000_000_000}),
    subscriptionHasAIPack:true,
    cancelAtPeriodEnd:true,
  });
  await assert.rejects(
    b.upgradeToFamily({auth:{uid:'fixture'},data:{plan:'family',interval:'month'}}),
    error => error.code === 'failed-precondition',
  );
  assert.equal(b.subscriptionUpdateRequests.length,0);
});

test('AI Pack requires an authenticated active paid subscription', async () => {
  const b = billing();
  await assert.rejects(b.addAIPack({auth:{uid:'fixture'},data:{}}), error => error.code === 'failed-precondition');
  b.user.billing = {plan:'pro', status:'active', stripeCustomerId:'cus_fixture', stripeSubscriptionId:'sub_fixture', addons:{aiPack:false}};
  const result = await b.addAIPack({auth:{uid:'fixture'},data:{}});
  assert.equal(result.success, true);
  assert.equal(result.status, 'pending');
  assert.deepEqual(b.subscriptionItemRequests[0].input, {
    subscription:'sub_fixture',
    price:'price_ai_pack',
    quantity:1,
    proration_behavior:'always_invoice',
    payment_behavior:'pending_if_incomplete',
  });
  assert.equal(b.subscriptionItemRequests[0].requestOptions.idempotencyKey, 'kr-ai-pack:sub_fixture:operation-fixture');
  assert.equal(b.user.billing.aiPackStatus, 'pending');
  assert.equal(b.user.billing.aiPackItemExists, true);
  assert.equal(b.user.billing.addons.aiPack, false);
});

test('existing unpaid AI Pack item remains pending without creating another item', async () => {
  const b = billing({
    subscriptionHasAIPack:true,
    userBilling:{plan:'pro',status:'active',stripeSubscriptionId:'sub_fixture',addons:{aiPack:false}},
  });
  const result = await b.addAIPack({auth:{uid:'fixture'},data:{}});
  assert.deepEqual(result, {success:true,status:'pending',alreadyExists:true});
  assert.equal(b.subscriptionItemRequests.length, 0);
  assert.equal(b.user.billing.aiPackItemExists, true);
  assert.equal(b.user.billing.aiPackStatus, 'pending');
  assert.equal(b.user.billing.addons.aiPack, false);
});

test('duplicate AI Pack callable reuses the persisted operation and Stripe item', async () => {
  const b = billing({userBilling:{plan:'pro',status:'active',stripeSubscriptionId:'sub_fixture',addons:{aiPack:false}}});
  const first = await b.addAIPack({auth:{uid:'fixture'},data:{}});
  const second = await b.addAIPack({auth:{uid:'fixture'},data:{}});
  assert.equal(first.status, 'pending');
  assert.equal(second.status, 'pending');
  assert.equal(b.actualSubscriptionItemCreates, 1);
  assert.equal(b.subscriptionItemRequests.length, 1);
  assert.equal(b.user.billing.aiPackOperationId, 'operation-fixture');
});

test('concurrent AI Pack callable attempts share one Stripe idempotency key and one item', async () => {
  const b = billing({userBilling:{plan:'pro',status:'active',stripeSubscriptionId:'sub_fixture',addons:{aiPack:false}}});
  const results = await Promise.all([
    b.addAIPack({auth:{uid:'fixture'},data:{}}),
    b.addAIPack({auth:{uid:'fixture'},data:{}}),
  ]);
  assert.deepEqual(results.map(result => result.status), ['pending','pending']);
  assert.equal(b.actualSubscriptionItemCreates, 1);
  assert.ok(b.subscriptionItemRequests.length >= 1);
  assert.equal(new Set(b.subscriptionItemRequests.map(call => call.requestOptions.idempotencyKey)).size, 1);
  assert.equal(b.user.billing.aiPackStatus, 'pending');
  assert.equal(b.user.billing.addons.aiPack, false);
});

test('existing paid AI Pack returns active without another Stripe mutation', async () => {
  const b = billing({
    subscriptionHasAIPack:true,
    userBilling:{
      plan:'pro',
      status:'active',
      stripeSubscriptionId:'sub_fixture',
      aiPackItemExists:true,
      aiPackStatus:'active',
      aiPackPaidThrough:Date.now() + 60_000,
      addons:{aiPack:true},
    },
  });
  const result = await b.addAIPack({auth:{uid:'fixture'},data:{}});
  assert.deepEqual(result, {success:true,status:'active',alreadyExists:true});
  assert.equal(b.subscriptionItemRequests.length, 0);
  assert.equal(b.user.billing.aiPackStatus, 'active');
  assert.equal(b.user.billing.addons.aiPack, true);
});

test('prepaid scheduled-removal access cannot trigger a duplicate AI Pack charge', async () => {
  const paidThrough = Date.now() + 60_000;
  const b = billing({userBilling:{
    plan:'pro',
    status:'active',
    stripeSubscriptionId:'sub_fixture',
    aiPackItemExists:false,
    aiPackStatus:'active',
    aiPackPaidThrough:paidThrough,
    aiPackCancelAtPeriodEnd:true,
    aiPackScheduledRemovalAt:paidThrough,
    addons:{aiPack:true},
  }});
  const result = await b.addAIPack({auth:{uid:'fixture'},data:{}});
  assert.deepEqual(result,{success:true,status:'active',alreadyExists:true});
  assert.equal(b.subscriptionItemRequests.length,0);
  assert.deepEqual(b.subscriptionItems.map(item => item.id),['si_plan']);
});

function activeAIPackBilling(plan = 'pro') {
  return {
    plan,
    status:'active',
    stripeCustomerId:'cus_fixture',
    stripeSubscriptionId:'sub_fixture',
    currentPeriodEnd:Date.now() + 120_000,
    cancelAtPeriodEnd:false,
    scheduledCancellationAt:null,
    aiPackItemExists:true,
    aiPackStatus:'active',
    aiPackPaidThrough:Date.now() + 60_000,
    aiPackCancelAtPeriodEnd:false,
    aiPackScheduledRemovalAt:null,
    aiPackRemovalOperationId:null,
    addons:{aiPack:true},
  };
}

test('AI Pack removal requires authentication and rejects browser Stripe identifiers', async () => {
  const b = billing({subscriptionHasAIPack:true,userBilling:activeAIPackBilling()});
  await assert.rejects(b.removeAIPack({data:{}}), error => error.code === 'unauthenticated');
  for (const data of [{subscriptionItemId:'si_ai_pack'},{subscriptionId:'sub_attacker'},{priceId:'price_ai_pack'},null,'']) {
    await assert.rejects(
      b.removeAIPack({auth:{uid:'fixture'},data}),
      error => error.code === 'invalid-argument',
    );
  }
  assert.equal(b.subscriptionItemDeleteRequests.length, 0);
});

test('removal deletes only the metadata-matched AI Pack item without proration and keeps Pro active', async () => {
  const paidThrough = Date.now() + 60_000;
  const billingState = {...activeAIPackBilling(),aiPackPaidThrough:paidThrough};
  billingState.cancelAtPeriodEnd = true;
  billingState.scheduledCancellationAt = Date.now() + 90_000;
  const b = billing({subscriptionHasAIPack:true,userBilling:billingState});
  const result = await b.removeAIPack({auth:{uid:'fixture'},data:{}});
  assert.deepEqual(result,{success:true,status:'scheduled',alreadyRemoved:false,endsAt:paidThrough});
  assert.deepEqual(b.subscriptionItemDeleteRequests[0],{
    id:'si_ai_pack',
    input:{proration_behavior:'none'},
    requestOptions:{idempotencyKey:'kr-ai-pack-remove:sub_fixture:si_ai_pack:operation-fixture'},
  });
  assert.equal(b.actualSubscriptionItemDeletes,1);
  assert.deepEqual(b.subscriptionItems.map(item => item.id),['si_plan']);
  assert.equal(b.user.billing.plan,'pro');
  assert.equal(b.user.billing.status,'active');
  assert.equal(b.user.billing.cancelAtPeriodEnd,true);
  assert.equal(b.user.billing.scheduledCancellationAt,billingState.scheduledCancellationAt);
  assert.equal(b.user.billing.aiPackItemExists,false);
  assert.equal(b.user.billing.aiPackStatus,'active');
  assert.equal(b.user.billing.aiPackPaidThrough,paidThrough);
  assert.equal(b.user.billing.aiPackCancelAtPeriodEnd,true);
  assert.equal(b.user.billing.aiPackScheduledRemovalAt,paidThrough);
  assert.equal(b.user.billing.addons.aiPack,true);
});

test('removal requires exactly one trusted metadata AI Pack match', async () => {
  for (const options of [
    {aiPackItemCount:2},
    {aiPackItemCount:1,aiPackMetadataMissing:true},
  ]) {
    const b = billing({...options,userBilling:activeAIPackBilling()});
    await assert.rejects(
      b.removeAIPack({auth:{uid:'fixture'},data:{}}),
      error => error.code === 'failed-precondition',
    );
    assert.equal(b.subscriptionItemDeleteRequests.length,0);
    assert.deepEqual(b.subscriptionItems.map(item => item.id),['si_plan',...(options.aiPackItemCount === 2 ? ['si_ai_pack','si_ai_pack1'] : ['si_ai_pack'])]);
  }
});

test('AI Pack removal is idempotent and an already removed retry is safe', async () => {
  const b = billing({subscriptionHasAIPack:true,userBilling:activeAIPackBilling()});
  const first = await b.removeAIPack({auth:{uid:'fixture'},data:{}});
  const second = await b.removeAIPack({auth:{uid:'fixture'},data:{}});
  assert.equal(first.status,'scheduled');
  assert.deepEqual(second,{
    success:true,
    status:'scheduled',
    alreadyRemoved:true,
    endsAt:b.user.billing.aiPackPaidThrough,
  });
  assert.equal(b.actualSubscriptionItemDeletes,1);
  assert.deepEqual(b.subscriptionItems.map(item => item.id),['si_plan']);
});

test('concurrent AI Pack removal calls share one safe deletion and preserve the base item', async () => {
  const b = billing({subscriptionHasAIPack:true,userBilling:activeAIPackBilling()});
  const results = await Promise.all([
    b.removeAIPack({auth:{uid:'fixture'},data:{}}),
    b.removeAIPack({auth:{uid:'fixture'},data:{}}),
  ]);
  assert.deepEqual(results.map(result => result.success),[true,true]);
  assert.equal(b.actualSubscriptionItemDeletes,1);
  assert.equal(new Set(b.subscriptionItemDeleteRequests.map(call => call.requestOptions.idempotencyKey)).size,1);
  assert.deepEqual(b.subscriptionItems.map(item => item.id),['si_plan']);
  assert.equal(b.user.billing.plan,'pro');
  assert.equal(b.user.billing.status,'active');
});

test('failed AI Pack removal retains its operation for an idempotent retry', async () => {
  const b = billing({
    subscriptionHasAIPack:true,
    userBilling:activeAIPackBilling(),
    subscriptionDeleteFailures:1,
  });
  await assert.rejects(
    b.removeAIPack({auth:{uid:'fixture'},data:{}}),
    error => error.code === 'unavailable',
  );
  assert.equal(b.user.billing.aiPackRemovalOperationId,'operation-fixture');
  const result = await b.removeAIPack({auth:{uid:'fixture'},data:{}});
  assert.equal(result.status,'scheduled');
  assert.equal(b.actualSubscriptionItemDeletes,1);
  assert.equal(b.subscriptionItemDeleteRequests.length,2);
  assert.equal(new Set(b.subscriptionItemDeleteRequests.map(call => call.requestOptions.idempotencyKey)).size,1);
  assert.equal(b.user.billing.aiPackRemovalOperationId,null);
  assert.deepEqual(b.subscriptionItems.map(item => item.id),['si_plan']);
});

test('Family AI Pack removal updates the pooled authority and keeps Family active', async () => {
  const paidThrough = Date.now() + 60_000;
  const state = {...activeAIPackBilling('family'),aiPackPaidThrough:paidThrough};
  const b = billing({
    plan:'family',
    familyId:'family_fixture',
    subscriptionHasAIPack:true,
    userBilling:state,
    familyPlan:structuredClone(state),
  });
  const result = await b.removeAIPack({auth:{uid:'fixture'},data:{}});
  assert.equal(result.status,'scheduled');
  for (const value of [b.user.billing,b.family.plan]) {
    assert.equal(value.plan,'family');
    assert.equal(value.status,'active');
    assert.equal(value.aiPackItemExists,false);
    assert.equal(value.aiPackStatus,'active');
    assert.equal(value.aiPackScheduledRemovalAt,paidThrough);
    assert.equal(value.addons.aiPack,true);
  }
  assert.deepEqual(b.subscriptionItems.map(item => item.id),['si_plan']);
});

test('AI Pack removal rejects a Stripe customer owned by another account', async () => {
  const b = billing({subscriptionHasAIPack:true,userBilling:activeAIPackBilling(),customerUid:'another-user'});
  await assert.rejects(
    b.removeAIPack({auth:{uid:'fixture'},data:{}}),
    error => error.code === 'permission-denied',
  );
  assert.equal(b.subscriptionItemDeleteRequests.length,0);
});

function scheduledAIPackBilling(plan = 'pro', overrides = {}) {
  const paidThrough = Date.now() + 60_000;
  return {
    plan,
    status:'active',
    stripeCustomerId:'cus_fixture',
    stripeSubscriptionId:'sub_fixture',
    currentPeriodEnd:Date.now() + 120_000,
    cancelAtPeriodEnd:false,
    scheduledCancellationAt:null,
    aiPackItemExists:false,
    aiPackStatus:'active',
    aiPackPaidThrough:paidThrough,
    aiPackCancelAtPeriodEnd:true,
    aiPackScheduledRemovalAt:paidThrough,
    aiPackRemovalOperationId:null,
    aiPackRemovalRequestedAt:null,
    aiPackResumeOperationId:null,
    aiPackResumeRequestedAt:null,
    addons:{aiPack:true},
    ...overrides,
  };
}

test('AI Pack resume requires authentication and rejects every browser billing identifier', async () => {
  const b = billing({userBilling:scheduledAIPackBilling()});
  await assert.rejects(b.resumeAIPack({data:{}}), error => error.code === 'unauthenticated');
  for (const data of [
    {subscriptionItemId:'si_ai_pack'},
    {subscriptionId:'sub_attacker'},
    {priceId:'price_ai_pack'},
    {customerId:'cus_attacker'},
    null,
    '',
  ]) {
    await assert.rejects(
      b.resumeAIPack({auth:{uid:'fixture'},data}),
      error => error.code === 'invalid-argument',
    );
  }
  assert.equal(b.subscriptionItemRequests.length,0);
});

test('scheduled AI Pack removal resumes once without an immediate charge or entitlement extension', async () => {
  const billingState = scheduledAIPackBilling('pro', {
    cancelAtPeriodEnd:true,
    scheduledCancellationAt:Date.now() + 90_000,
    aiPackGrants:{count:2},
  });
  const paidThrough = billingState.aiPackPaidThrough;
  const b = billing({userBilling:billingState});
  const result = await b.resumeAIPack({auth:{uid:'fixture'},data:{}});
  assert.deepEqual(result,{success:true,status:'renewing',alreadyRenewing:false,paidThrough});
  assert.deepEqual(b.subscriptionItemRequests[0],{
    input:{
      subscription:'sub_fixture',
      price:'price_ai_pack',
      quantity:1,
      proration_behavior:'none',
    },
    requestOptions:{idempotencyKey:`kr-ai-pack-resume:sub_fixture:${paidThrough}:operation-fixture`},
  });
  assert.equal(Object.hasOwn(b.subscriptionItemRequests[0].input,'payment_behavior'),false);
  assert.equal(Object.hasOwn(b.subscriptionItemRequests[0].input,'billing_cycle_anchor'),false);
  assert.equal(b.actualSubscriptionItemCreates,1);
  assert.deepEqual(b.subscriptionItems.map(item => item.id),['si_plan','si_ai_pack']);
  assert.equal(b.user.billing.aiPackItemExists,true);
  assert.equal(b.user.billing.aiPackStatus,'active');
  assert.equal(b.user.billing.aiPackPaidThrough,paidThrough);
  assert.equal(b.user.billing.aiPackCancelAtPeriodEnd,false);
  assert.equal(b.user.billing.aiPackScheduledRemovalAt,null);
  assert.equal(b.user.billing.addons.aiPack,true);
  assert.equal(b.user.billing.aiPackGrants.count,2);
  assert.equal(b.nonBillingWrites.some(write => write.collection === 'ai_pack_grants'),false);
  assert.equal(b.user.billing.plan,'pro');
  assert.equal(b.user.billing.cancelAtPeriodEnd,true);
  assert.equal(b.user.billing.scheduledCancellationAt,billingState.scheduledCancellationAt);
});

test('duplicate and concurrent AI Pack resume calls use one Stripe item and one stable idempotency key', async () => {
  for (const concurrent of [false,true]) {
    const state = scheduledAIPackBilling();
    const b = billing({userBilling:state});
    const results = concurrent
      ? await Promise.all([
          b.resumeAIPack({auth:{uid:'fixture'},data:{}}),
          b.resumeAIPack({auth:{uid:'fixture'},data:{}}),
        ])
      : [
          await b.resumeAIPack({auth:{uid:'fixture'},data:{}}),
          await b.resumeAIPack({auth:{uid:'fixture'},data:{}}),
        ];
    assert.deepEqual(results.map(result => result.status),['renewing','renewing']);
    assert.equal(b.actualSubscriptionItemCreates,1);
    assert.equal(new Set(b.subscriptionItemRequests.map(call => call.requestOptions.idempotencyKey)).size,1);
    assert.deepEqual(b.subscriptionItems.map(item => item.id),['si_plan','si_ai_pack']);
  }
});

test('existing trusted AI Pack item makes resume a safe already-renewing operation', async () => {
  const state = scheduledAIPackBilling();
  const b = billing({subscriptionHasAIPack:true,userBilling:state});
  const result = await b.resumeAIPack({auth:{uid:'fixture'},data:{}});
  assert.deepEqual(result,{
    success:true,
    status:'renewing',
    alreadyRenewing:true,
    paidThrough:state.aiPackPaidThrough,
  });
  assert.equal(b.subscriptionItemRequests.length,0);
  assert.equal(b.user.billing.aiPackItemExists,true);
  assert.equal(b.user.billing.aiPackCancelAtPeriodEnd,false);
});

test('Family AI Pack resume updates pooled authority without changing base cancellation state', async () => {
  const state = scheduledAIPackBilling('family',{
    cancelAtPeriodEnd:true,
    scheduledCancellationAt:Date.now() + 90_000,
    aiPackGrants:{count:2},
  });
  const b = billing({
    plan:'family',
    familyId:'family_fixture',
    userBilling:state,
    familyPlan:structuredClone(state),
  });
  const result = await b.resumeAIPack({auth:{uid:'fixture'},data:{}});
  assert.equal(result.status,'renewing');
  for (const value of [b.user.billing,b.family.plan]) {
    assert.equal(value.plan,'family');
    assert.equal(value.aiPackItemExists,true);
    assert.equal(value.aiPackStatus,'active');
    assert.equal(value.aiPackPaidThrough,state.aiPackPaidThrough);
    assert.equal(value.aiPackCancelAtPeriodEnd,false);
    assert.equal(value.aiPackScheduledRemovalAt,null);
    assert.equal(value.cancelAtPeriodEnd,true);
    assert.equal(value.scheduledCancellationAt,state.scheduledCancellationAt);
    assert.equal(value.aiPackGrants.count,2);
  }
  assert.deepEqual(b.subscriptionItems.map(item => item.id),['si_plan','si_ai_pack']);
});

test('expired or malformed stopped-renewal state cannot bypass the paid add flow', async () => {
  for (const userBilling of [
    scheduledAIPackBilling('pro',{aiPackPaidThrough:Date.now() - 1,aiPackScheduledRemovalAt:Date.now() - 1}),
    scheduledAIPackBilling('pro',{aiPackStatus:'none'}),
    scheduledAIPackBilling('pro',{addons:{aiPack:false}}),
  ]) {
    const b = billing({userBilling});
    await assert.rejects(
      b.resumeAIPack({auth:{uid:'fixture'},data:{}}),
      error => error.code === 'failed-precondition',
    );
    assert.equal(b.subscriptionItemRequests.length,0);
  }
});

test('AI Pack resume verifies Stripe ownership and trusted configured price metadata', async () => {
  for (const options of [
    {customerUid:'another-user'},
    {subscriptionCustomerId:'cus_another'},
    {aiPackPriceMetadataMissing:true},
  ]) {
    const b = billing({...options,userBilling:scheduledAIPackBilling()});
    await assert.rejects(
      b.resumeAIPack({auth:{uid:'fixture'},data:{}}),
      error => ['permission-denied','failed-precondition'].includes(error.code),
    );
    assert.equal(b.subscriptionItemRequests.length,0);
  }
});

test('failed AI Pack resume preserves paid-through access and the stable retry operation', async () => {
  const state = scheduledAIPackBilling();
  const b = billing({userBilling:state,subscriptionCreateError:new Error('transient create failure')});
  await assert.rejects(
    b.resumeAIPack({auth:{uid:'fixture'},data:{}}),
    error => error.code === 'unavailable',
  );
  assert.equal(b.user.billing.aiPackItemExists,false);
  assert.equal(b.user.billing.aiPackStatus,'active');
  assert.equal(b.user.billing.aiPackPaidThrough,state.aiPackPaidThrough);
  assert.equal(b.user.billing.aiPackCancelAtPeriodEnd,true);
  assert.equal(b.user.billing.aiPackScheduledRemovalAt,state.aiPackPaidThrough);
  assert.equal(b.user.billing.aiPackResumeOperationId,'operation-fixture');
  assert.equal(b.user.billing.addons.aiPack,true);
  assert.deepEqual(b.subscriptionItems.map(item => item.id),['si_plan']);
});
