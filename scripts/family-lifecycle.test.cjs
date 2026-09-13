const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const {test} = require('node:test');
const assert = require('node:assert/strict');

function loadFamilyUsageFixture() {
  const monthKey = new Date().toISOString().slice(0, 7);
  const future = Date.now() + 60_000;
  const docs = new Map([
    ['users/owner', {
      billing:{
        plan:'family',status:'active',currentPeriodEnd:future,
        stripeCustomerId:'cus_family_fixture',stripeSubscriptionId:'sub_family_fixture',
        aiPackItemExists:true,aiPackStatus:'active',aiPackPaidThrough:future,
        aiPackCancelAtPeriodEnd:false,aiPackScheduledRemovalAt:null,addons:{aiPack:true},
      },
      family:{familyId:'family_fixture',role:'owner'},
      usage:{monthKey,exportsUsed:0,aiActionsUsed:0,aiActionsAllowance:10,storageUsedBytes:0},
    }],
    ['users/member', {
      billing:{plan:'free',status:'none',currentPeriodEnd:0,addons:{aiPack:false}},
      family:{familyId:'family_fixture',role:'member'},
      usage:{monthKey,exportsUsed:0,aiActionsUsed:0,aiActionsAllowance:10,storageUsedBytes:0},
    }],
    ['families/family_fixture', {
      ownerUid:'owner',
      plan:{
        plan:'family',status:'active',currentPeriodEnd:future,scheduledCancellationAt:null,
        stripeCustomerId:'cus_family_fixture',stripeSubscriptionId:'sub_family_fixture',
        aiPackItemExists:true,aiPackStatus:'pending',aiPackPaidThrough:null,
        aiPackCancelAtPeriodEnd:false,aiPackScheduledRemovalAt:null,addons:{aiPack:false},
      },
      usage:{monthKey,exportsUsed:0,aiActionsUsed:0,aiActionsAllowance:10,storageUsedBytes:0},
    }],
  ]);
  const clone = value => value === undefined ? undefined : structuredClone(value);
  const ref = key => ({
    key,
    get:async () => ({exists:docs.has(key),data:() => clone(docs.get(key))}),
  });
  const apply = (target, patch) => {
    for (const [key,value] of Object.entries(patch)) {
      const parts = key.split('.');
      let cursor = target;
      for (const part of parts.slice(0,-1)) cursor = cursor[part] ||= {};
      cursor[parts.at(-1)] = value;
    }
  };
  const adminDb = {
    collection(name) { return {doc(id) { return ref(`${name}/${id}`); }}; },
    async runTransaction(callback) {
      const writes = [];
      const result = await callback({
        get:async documentRef => ({exists:docs.has(documentRef.key),data:() => clone(docs.get(documentRef.key))}),
        update:(documentRef,value) => writes.push({documentRef,value}),
      });
      for (const {documentRef,value} of writes) {
        const current = clone(docs.get(documentRef.key)) || {};
        apply(current,value);
        docs.set(documentRef.key,current);
      }
      return result;
    },
  };
  const adminAuth = {verifyIdToken:async token => ({uid:token === 'owner-token' ? 'owner' : 'member'})};
  const cache = new Map();
  function read(file) {
    const target = path.resolve(file);
    if (cache.has(target)) return cache.get(target).exports;
    const module = {exports:{}};
    cache.set(target,module);
    const code = ts.transpileModule(fs.readFileSync(target,'utf8'),{
      compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true},
    }).outputText;
    new Function('require','module','exports',code)((request) => {
      if (request === 'server-only') return {};
      if (request === '@/lib/firebase/admin') return {adminAuth,adminDb};
      if (request === 'firebase-admin') return {firestore:{FieldValue:{serverTimestamp:() => 'SERVER_TIMESTAMP',increment:value => value}}};
      if (request.startsWith('@/')) return read(path.join('src',`${request.slice(2)}.ts`));
      if (request.startsWith('./')) return read(path.join(path.dirname(target),`${request}.ts`));
      return require(request);
    },module,module.exports);
    return module.exports;
  }
  return {
    serverUsage:read('src/lib/billing/serverUsage.ts'),
    billingActions:read('src/app/billing/actions.ts'),
    plan:read('src/lib/billing/plan.ts'),
    docs,
    future,
  };
}

test('two Family seats debit one authoritative 1600-action workspace pool', async () => {
  const fixture = loadFamilyUsageFixture();
  assert.equal((await fixture.serverUsage.verifyAuthAndDeductAICredits('owner-token','generate_biography')).success,true);
  assert.equal((await fixture.serverUsage.verifyAuthAndDeductAICredits('member-token','generate_biography')).success,true);
  assert.equal(fixture.docs.get('families/family_fixture').usage.aiActionsAllowance,1600);
  assert.equal(fixture.docs.get('families/family_fixture').usage.aiActionsUsed,2);
  assert.equal(fixture.docs.get('users/owner').usage.aiActionsUsed,0);
  assert.equal(fixture.docs.get('users/member').usage.aiActionsUsed,0);
});

test('Family owner and linked member resolve the owner-paid AI Pack as one shared 1600 pool', async () => {
  const fixture = loadFamilyUsageFixture();
  const ownerView = await fixture.billingActions.getAuthoritativeBillingView('owner-token');
  const memberView = await fixture.billingActions.getAuthoritativeBillingView('member-token');
  for (const view of [ownerView,memberView]) {
    assert.equal(view.plan,'family');
    assert.equal(view.hasAIPack,true);
    assert.equal(view.aiPackStatus,'active');
    assert.equal(view.aiPackPaidThrough,fixture.future);
    assert.equal(view.limits.aiActionsAllowance,1600);
    assert.equal(view.familyId,'family_fixture');
  }
});

test('Family AI Pack derivation distinguishes prepaid, expired and genuinely pending states', () => {
  const fixture = loadFamilyUsageFixture();
  const familyPlan = fixture.docs.get('families/family_fixture').plan;
  const ownerBilling = fixture.docs.get('users/owner').billing;
  assert.equal(fixture.plan.hasActiveAIPack(
    fixture.plan.resolveFamilyAIPackAuthority(familyPlan,ownerBilling),
  ),true);

  const stoppedRenewal = {
    ...ownerBilling,
    aiPackItemExists:false,
    aiPackCancelAtPeriodEnd:true,
    aiPackScheduledRemovalAt:fixture.future,
  };
  assert.equal(fixture.plan.hasActiveAIPack(
    fixture.plan.resolveFamilyAIPackAuthority(familyPlan,stoppedRenewal),
  ),true);

  const expired = {
    ...stoppedRenewal,
    aiPackPaidThrough:Date.now() - 1,
    aiPackScheduledRemovalAt:Date.now() - 1,
  };
  assert.equal(fixture.plan.hasActiveAIPack(
    fixture.plan.resolveFamilyAIPackAuthority(familyPlan,expired),
  ),false);

  const pending = {
    ...ownerBilling,
    aiPackStatus:'pending',
    aiPackPaidThrough:null,
    addons:{aiPack:false},
  };
  assert.equal(fixture.plan.hasActiveAIPack(
    fixture.plan.resolveFamilyAIPackAuthority(familyPlan,pending),
  ),false);
});

test('Family AI Pack projection fails closed when the server owner subscription does not match', () => {
  const fixture = loadFamilyUsageFixture();
  const familyPlan = fixture.docs.get('families/family_fixture').plan;
  const mismatchedOwner = {
    ...fixture.docs.get('users/owner').billing,
    stripeSubscriptionId:'sub_other_family',
  };
  const authority = fixture.plan.resolveFamilyAIPackAuthority(familyPlan,mismatchedOwner);
  assert.equal(fixture.plan.hasActiveAIPack(authority),false);
  assert.equal(authority.aiPackStatus,'none');
  assert.equal(authority.addons.aiPack,false);
});

test('Family lifecycle UI calls the dedicated logical upgrade and waits for authoritative live state', () => {
  const source = fs.readFileSync('src/app/pricing/page.tsx','utf8');
  assert.equal(source.includes("httpsCallable(functions, 'upgradeToFamily')"),true);
  assert.equal(source.includes("plan: 'family'"),true);
  assert.equal(source.includes("interval: isYearly ? 'year' : 'month'"),true);
  assert.equal(source.includes('Processing Family upgrade…'),true);
  assert.equal(source.includes('window.setInterval(refreshEntitlements, 5_000)'),true);
  assert.equal(source.includes('window.location.reload()'),false);
});

test('Family Pricing and Billing Settings expose confirmed end-of-period downgrade controls', () => {
  for (const file of ['src/app/pricing/page.tsx','src/app/settings/billing/page.tsx']) {
    const source = fs.readFileSync(file,'utf8');
    assert.match(source,/FamilyDowngradeControls/);
    assert.doesNotMatch(source,/End-of-period downgrade management is not yet available/);
  }
});

test('Family authority requires the paid Family plan marker across server usage and display paths', () => {
  for (const file of [
    'src/app/billing/actions.ts',
    'src/lib/billing/entitlements.ts',
    'src/lib/billing/serverUsage.ts',
    'storage.rules',
  ]) {
    const source = fs.readFileSync(file,'utf8');
    assert.equal(source.includes("plan === 'family'") || source.includes("plan == 'family'"),true,file);
  }
});

test('Family owner seat is server-owned and remains separate from 20 tree collaborators', () => {
  const constants = fs.readFileSync('src/lib/billing/constants.ts','utf8');
  const rules = fs.readFileSync('firestore.rules','utf8');
  assert.match(constants,/FAMILY_SEAT_LIMIT = 6/);
  assert.match(constants,/maxCollaboratorsPerTree: 20/);
  assert.match(rules,/match \/seats\/\{seatId\}[\s\S]*allow write: if isPlatformAdmin\(\);/);
  assert.equal(rules.includes('allow read, write: if isPlatformAdmin() || get(/databases/$(database)/documents/families/$(familyId)).data.ownerUid == request.auth.uid'),false);
});

test('approved Family annual documentation and runtime validation use $99, never $99.99', () => {
  const implementation = fs.readFileSync('docs/Implementation_pack.md','utf8');
  const architecture = fs.readFileSync('docs/billing/BILLING_ARCHITECTURE.md','utf8');
  assert.match(implementation,/Family Yearly[\s\S]*unit_amount`: `9900`/);
  assert.equal(/Family Yearly[\s\S]{0,100}unit_amount`: `9999`/.test(implementation),false);
  assert.match(architecture,/price_1UDyX3FLueI9mUztJ3CqVJ2C/);
});
