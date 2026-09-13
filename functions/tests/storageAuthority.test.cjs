const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function load(databaseFactory = () => {throw new Error('Unexpected Admin Firestore access');}) {
  const mod = {exports: {}};
  const mocks = {'firebase-admin': {firestore: databaseFactory},
    'firebase-functions/v2/https': {onCall: handler => handler, HttpsError: require('firebase-functions/v2/https').HttpsError},
    'firebase-functions/v2/firestore': {onDocumentWritten: (_options, handler) => handler}};
  new Function('require', 'module', 'exports', fs.readFileSync(path.join(__dirname, '../lib/storageAuthority.js'), 'utf8'))(
    name => name in mocks ? mocks[name] : require(name), mod, mod.exports,
  );
  return mod.exports;
}

const baseBilling = {plan: 'family', status: 'active', currentPeriodEnd: 2000000000000,
  scheduledCancellationAt: null, stripeCustomerId: 'cus_synthetic_storage', stripeSubscriptionId: 'sub_synthetic_storage'};
const user = {family: {familyId: 'synthetic-family', role: 'owner'}, billing: baseBilling,
  usage: {storageUsedBytes: 123, aiActionsUsed: 0}, storageAuthority: {storageUsedBytes: 123}};
const family = {ownerUid: 'synthetic-owner', plan: baseBilling, usage: {storageUsedBytes: 123}};
const clone = value => structuredClone(value);
function changed(data, field, value) {
  const next = clone(data); const keys = field.split('.'); let map = next;
  for (const key of keys.slice(0, -1)) map = map[key] ||= {};
  map[keys.at(-1)] = value; return next;
}
function event(params, before, after) {
  const snapshot = data => ({exists: data !== undefined, data: () => data});
  return {params, data: {before: snapshot(before), after: snapshot(after)}};
}

for (const [field, value] of [
  ['displayName', 'Synthetic name'], ['photoURL', 'synthetic-photo'], ['emailPreferences', {enabled: false}],
  ['lastActivityAt', 12345], ['usage.aiActionsUsed', 200], ['usage.aiActionsAllowance', 1600],
  ['usage.exportsUsed', 5], ['unrelatedProfile', true], ['family.role', 'member'],
  ['billing.aiPackStatus', 'active'], ['billing.latestStripeEventCreated', 999],
  ['storageAuthority', {plan: 'family', storageUsedBytes: 456}],
]) test(`user ${field} change short-circuits before Admin Firestore`, async () => {
  const api = load(); const after = changed(user, field, value);
  assert.equal(api.storageUserInputsChanged(user, after), false);
  await api.onStorageUserWritten(event({uid: 'synthetic-owner'}, user, after));
});

for (const [field, value] of [
  ['usage.aiActionsUsed', 200], ['usage.aiActionsAllowance', 1600], ['usage.exportsUsed', 5],
  ['plan.aiPackStatus', 'active'], ['plan.aiPackPaidThrough', 2000000000000],
  ['plan.aiPackItemExists', true], ['plan.latestStripeEventCreated', 999], ['displayName', 'Synthetic workspace'],
]) test(`Family ${field} change short-circuits before Admin Firestore`, async () => {
  const api = load(); const after = changed(family, field, value);
  assert.equal(api.storageFamilyInputsChanged(family, after), false);
  await api.onStorageFamilyWritten(event({familyId: 'synthetic-family'}, family, after));
});

for (const [field, value] of [
  ['family.familyId', 'another-family'], ['usage.storageUsedBytes', 456], ['billing.plan', 'pro'],
  ['billing.status', 'past_due'], ['billing.currentPeriodEnd', 2000000000001],
  ['billing.scheduledCancellationAt', 1999999999999], ['billing.stripeCustomerId', 'cus_other_synthetic'],
  ['billing.stripeSubscriptionId', 'sub_other_synthetic'],
]) test(`user ${field} is projection relevant`, () => {
  assert.equal(load().storageUserInputsChanged(user, changed(user, field, value)), true);
});

for (const [field, value] of [
  ['ownerUid', 'another-owner'], ['usage.storageUsedBytes', 456], ['plan.plan', 'pro'],
  ['plan.status', 'past_due'], ['plan.currentPeriodEnd', 2000000000001],
  ['plan.scheduledCancellationAt', 1999999999999], ['plan.stripeCustomerId', 'cus_other_synthetic'],
  ['plan.stripeSubscriptionId', 'sub_other_synthetic'],
]) test(`Family ${field} is projection relevant`, () => {
  assert.equal(load().storageFamilyInputsChanged(family, changed(family, field, value)), true);
});

test('reordered relevant maps and normalized absent values perform no synchronization', async () => {
  const api = load();
  const reverse = map => Object.fromEntries(Object.entries(map).reverse());
  const afterUser = {...user, billing: reverse(user.billing), family: reverse(user.family), usage: reverse(user.usage)};
  const afterFamily = {...family, plan: reverse(family.plan)};
  assert.equal(api.storageUserInputsChanged(user, afterUser), false);
  assert.equal(api.storageFamilyInputsChanged(family, afterFamily), false);
  assert.equal(api.storageUserInputsChanged({}, {family: {familyId: null}, usage: {storageUsedBytes: 0}, billing: {scheduledCancellationAt: 0}}), false);
  assert.equal(api.storageFamilyInputsChanged({}, {ownerUid: null, usage: {storageUsedBytes: 0}, plan: {scheduledCancellationAt: 0}}), false);
  await api.onStorageUserWritten(event({uid: 'synthetic-owner'}, user, afterUser));
  await api.onStorageFamilyWritten(event({familyId: 'synthetic-family'}, family, afterFamily));
});

test('creation initializes; meaningful authority deletion invalidates; empty/personal deletion does no reads', async () => {
  const api = load();
  assert.equal(api.storageUserInputsChanged(undefined, user), true);
  assert.equal(api.storageFamilyInputsChanged(undefined, family), true);
  assert.equal(api.storageUserInputsChanged(user, undefined), true);
  assert.equal(api.storageFamilyInputsChanged(family, undefined), true);
  const personal = {...user, billing: {...baseBilling, plan: 'pro'}};
  assert.equal(api.storageUserInputsChanged(personal, undefined), false);
  assert.equal(api.storageFamilyInputsChanged({displayName: 'Unrelated'}, undefined), false);
  await api.onStorageUserWritten(event({uid: 'synthetic-personal'}, personal, undefined));
  await api.onStorageFamilyWritten(event({familyId: 'synthetic-empty'}, {displayName: 'Unrelated'}, undefined));
  await api.onStorageUserWritten({params: {uid: 'synthetic-owner'}});
  await api.onStorageFamilyWritten({params: {familyId: 'synthetic-family'}});
});

function singleUserDatabase() {
  const docs = new Map([
    ['users/synthetic-owner', clone(user)],
    ['families/synthetic-family', clone(family)],
    ['trees/synthetic-tree', {ownerId: 'synthetic-owner', collaborators: {editor: 'editor', manager: 'manager'}}],
  ]);
  const reads = [], writes = [];
  const ref = key => ({key, get: async () => {reads.push(key); return {exists: docs.has(key), data: () => clone(docs.get(key))};}});
  const db = {collection: name => ({doc: id => ref(`${name}/${id}`),
    where: () => {throw new Error('Unexpected Family-wide query');}}),
  runTransaction: callback => callback({get: doc => doc.get(), update: (doc, update) => {
    writes.push(doc.key); docs.set(doc.key, {...docs.get(doc.key), ...clone(update)});
  }})};
  return {db, reads, writes, docs};
}

for (const selection of ['avatar', 'owner tree', 'editor tree', 'manager tree']) test(`${selection} preparation refreshes one Family owner without a Family query`, async () => {
  const fixture = singleUserDatabase(); const api = load(() => fixture.db);
  const uid = selection.startsWith('editor') ? 'editor' : selection.startsWith('manager') ? 'manager' : 'synthetic-owner';
  await api.prepareStorageUpload({auth: {uid}, data: selection === 'avatar' ? {} : {treeId: 'synthetic-tree'}});
  assert.deepEqual(fixture.writes, ['users/synthetic-owner']);
  assert.deepEqual(fixture.reads, [...(selection === 'avatar' ? [] : ['trees/synthetic-tree']), 'users/synthetic-owner', 'families/synthetic-family']);
  assert.equal(fixture.docs.get('users/synthetic-owner').storageAuthority.status, 'active');
});

test('Family owner personal storage counter transition refreshes only the owner', async () => {
  const fixture = singleUserDatabase(); const after = changed(user, 'usage.storageUsedBytes', 456);
  fixture.docs.set('users/synthetic-owner', after);
  await load(() => fixture.db).onStorageUserWritten(event({uid: 'synthetic-owner'}, user, after));
  assert.deepEqual(fixture.reads, ['users/synthetic-owner', 'families/synthetic-family']);
  assert.deepEqual(fixture.writes, ['users/synthetic-owner']);
  assert.equal(fixture.docs.get('users/synthetic-owner').storageAuthority.storageUsedBytes, 456);
});
