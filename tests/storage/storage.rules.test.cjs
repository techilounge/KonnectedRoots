const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');
const {initializeTestEnvironment, assertSucceeds, assertFails} = require('@firebase/rules-unit-testing');
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const {syncUserStorageAuthority} = require('../../functions/lib/storageAuthority');

const projectId = 'demo-konnectedroots-storage-rules';
const root = path.resolve(__dirname, '../..');
const GiB = 1024 ** 3;
const future = Date.now() + 86400000;
let env, adminApp, database, sequence = 0;

before(async () => {
  assert.equal(process.env.GCLOUD_PROJECT, projectId, 'Run only through the isolated demo emulator command');
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:18380');
  assert.equal(process.env.FIREBASE_STORAGE_EMULATOR_HOST, '127.0.0.1:18399');
  env = await initializeTestEnvironment({
    projectId,
    firestore: {host: '127.0.0.1', port: 18380, rules: fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8')},
    storage: {host: '127.0.0.1', port: 18399, rules: fs.readFileSync(path.join(root, 'storage.rules'), 'utf8')},
  });
  adminApp = initializeApp({projectId}, 'storage-rules-tests');
  database = getFirestore(adminApp);
});

after(async () => {
  if (env) await env.cleanup();
  if (adminApp) await deleteApp(adminApp);
});

function billing(plan = 'free', status = 'none', changes = {}) {
  return {plan, status, currentPeriodEnd: future, scheduledCancellationAt: null,
    stripeCustomerId: 'cus_synthetic_storage', stripeSubscriptionId: 'sub_synthetic_storage', ...changes};
}

async function account({plan = 'free', status = plan === 'free' ? 'none' : 'active', used = 0, familyUsed = used, changes = {}, preservedFamily = false, project = true} = {}) {
  const uid = `storage-owner-${++sequence}`;
  const treeId = `storage-tree-${sequence}`;
  const familyId = `storage-family-${sequence}`;
  const hasFamily = plan === 'family' || preservedFamily;
  const user = {billing: billing(plan, status, changes), usage: {storageUsedBytes: used},
    family: {familyId: hasFamily ? familyId : null, role: hasFamily ? 'owner' : null}};
  await database.doc(`users/${uid}`).set(user);
  await database.doc(`trees/${treeId}`).set({ownerId: uid, collaborators: {editor: 'editor', manager: 'manager', viewer: 'viewer'}});
  if (hasFamily) await database.doc(`families/${familyId}`).set({ownerUid: uid,
    plan: billing(plan === 'family' ? 'family' : 'pro', status, changes), usage: {storageUsedBytes: familyUsed}});
  if (project) await syncUserStorageAuthority(uid, database);
  return {uid, treeId, familyId, objectPath: `trees/${treeId}/people/synthetic-person/image.png`};
}

function object(uid, objectPath) {
  const context = uid === null ? env.unauthenticatedContext() : env.authenticatedContext(uid);
  return context.storage().ref(objectPath);
}
function put(uid, objectPath, size = 100, contentType = 'image/png', customMetadata) {
  return object(uid, objectPath).put(new Uint8Array(size), {contentType, ...(customMetadata ? {customMetadata} : {})});
}

test('Free owner valid image under 5 MiB and within 1 GiB is allowed', async () => {
  const a = await account(); await assertSucceeds(put(a.uid, a.objectPath));
});
test('Free upload crossing 1 GiB is denied', async () => {
  const a = await account({used: GiB - 99}); await assertFails(put(a.uid, a.objectPath));
});
for (const size of [5 * 1024 ** 2, 5 * 1024 ** 2 + 1]) test(`image size ${size} is denied`, async () => {
  const a = await account(); await assertFails(put(a.uid, a.objectPath, size));
});
test('non-image tree upload is denied', async () => {
  const a = await account(); await assertFails(put(a.uid, a.objectPath, 100, 'text/plain'));
});
test('active Pro upload below 50 GiB is allowed', async () => {
  const a = await account({plan: 'pro', used: 50 * GiB - 100}); await assertSucceeds(put(a.uid, a.objectPath));
});
test('Pro upload crossing 50 GiB is denied', async () => {
  const a = await account({plan: 'pro', used: 50 * GiB - 99}); await assertFails(put(a.uid, a.objectPath));
});
test('past_due Pro retains only Free quota', async () => {
  const below = await account({plan: 'pro', status: 'past_due'}); await assertSucceeds(put(below.uid, below.objectPath));
  const above = await account({plan: 'pro', status: 'past_due', used: GiB}); await assertFails(put(above.uid, above.objectPath));
});
test('active Family owner uses 100 GiB and succeeds within the two-document budget', async () => {
  const a = await account({plan: 'family', used: 0, familyUsed: 100 * GiB - 100});
  assert.equal((await database.doc(`users/${a.uid}`).get()).data().storageAuthority.storageUsedBytes, 100 * GiB - 100);
  await assertSucceeds(put(a.uid, a.objectPath));
});
test('Family upload crossing the known 100 GiB pool floor is denied', async () => {
  const a = await account({plan: 'family', familyUsed: 100 * GiB - 99}); await assertFails(put(a.uid, a.objectPath));
});
for (const plan of ['pro', 'family']) for (const status of ['past_due', 'unpaid', 'incomplete', 'incomplete_expired', 'paused', 'canceled']) {
  test(`${status} ${plan} never grants paid quota`, async () => {
    const a = await account({plan, status, used: GiB}); await assertFails(put(a.uid, a.objectPath));
  });
}
for (const plan of ['pro', 'family']) test(`trialing ${plan} receives its paid quota`, async () => {
  const a = await account({plan, status: 'trialing', used: 2 * GiB}); await assertSucceeds(put(a.uid, a.objectPath));
});
test('preserved Family workspace alone does not grant 100 GiB', async () => {
  const a = await account({preservedFamily: true, used: GiB}); await assertFails(put(a.uid, a.objectPath));
});
test('missing Family projection fails closed until trusted lazy initialization', async () => {
  const a = await account({plan: 'family', project: false}); await assertFails(put(a.uid, a.objectPath));
  await syncUserStorageAuthority(a.uid, database); await assertSucceeds(put(a.uid, a.objectPath));
});
for (const plan of ['pro', 'family']) for (const changes of [{currentPeriodEnd: Date.now() - 1000}, {scheduledCancellationAt: Date.now() - 1000}, {currentPeriodEnd: 0}]) {
  test(`expired/missing ${plan} paid period fails closed ${JSON.stringify(changes)}`, async () => {
    const a = await account({plan, changes, used: GiB}); await assertFails(put(a.uid, a.objectPath));
  });
}
test('mismatched Family subscription does not grant Family quota', async () => {
  const a = await account({plan: 'family', used: GiB});
  await database.doc(`families/${a.familyId}`).update({'plan.stripeSubscriptionId': 'sub_wrong_synthetic'});
  await syncUserStorageAuthority(a.uid, database); await assertFails(put(a.uid, a.objectPath));
});
for (const role of ['editor', 'manager']) test(`${role} can upload to owner tree`, async () => {
  const a = await account(); await assertSucceeds(put(role, a.objectPath));
});
for (const uid of ['viewer', 'unrelated', null]) test(`${uid} cannot upload to owner tree`, async () => {
  const a = await account(); await assertFails(put(uid, a.objectPath));
});
test('collaborator own paid plan cannot increase the tree owner quota', async () => {
  const a = await account({used: GiB}); await database.doc('users/editor').set({billing: billing('family', 'active'), usage: {storageUsedBytes: 0}});
  await assertFails(put('editor', a.objectPath));
});
test('Free collaborator can upload using active Pro owner quota', async () => {
  const a = await account({plan: 'pro', used: 2 * GiB}); await assertSucceeds(put('manager', a.objectPath));
});
test('growing replacement checks only positive size delta', async () => {
  const a = await account(); await assertSucceeds(put(a.uid, a.objectPath, 100));
  await database.doc(`users/${a.uid}`).update({'usage.storageUsedBytes': GiB - 50});
  await assertSucceeds(put(a.uid, a.objectPath, 150));
  await assertFails(put(a.uid, a.objectPath, 201));
});
for (const size of [100, 50]) test(`replacement size ${size} succeeds above quota`, async () => {
  const a = await account(); await assertSucceeds(put(a.uid, a.objectPath, 100));
  await database.doc(`users/${a.uid}`).update({'usage.storageUsedBytes': 2 * GiB});
  await assertSucceeds(put(a.uid, a.objectPath, size));
});
for (const uid of ['owner', 'editor', 'manager', 'viewer', 'unrelated', null]) test(`${uid} delete decision above quota preserves tree roles`, async () => {
  const a = await account(); await assertSucceeds(put(a.uid, a.objectPath));
  await database.doc(`users/${a.uid}`).update({'usage.storageUsedBytes': 2 * GiB});
  const deletion = object(uid === 'owner' ? a.uid : uid, a.objectPath).delete();
  await (['owner', 'editor', 'manager'].includes(uid) ? assertSucceeds(deletion) : assertFails(deletion));
});
test('own avatar upload allowed; another user and anonymous upload denied', async () => {
  const a = await account(); const target = `users/${a.uid}/profile/avatar.png`;
  await assertSucceeds(put(a.uid, target)); await assertFails(put('unrelated', target)); await assertFails(put(null, target));
});
test('avatars preserve image/size/quota checks and positive replacement delta', async () => {
  const a = await account(); const target = `users/${a.uid}/profile/avatar.png`;
  await assertFails(put(a.uid, target, 100, 'application/pdf')); await assertFails(put(a.uid, target, 5 * 1024 ** 2));
  await assertSucceeds(put(a.uid, target)); await database.doc(`users/${a.uid}`).update({'usage.storageUsedBytes': GiB - 50});
  await assertSucceeds(put(a.uid, target, 150)); await assertFails(put(a.uid, target, 201));
  await database.doc(`users/${a.uid}`).update({'usage.storageUsedBytes': 2 * GiB});
  await assertSucceeds(put(a.uid, target, 50)); await assertSucceeds(object(a.uid, target).delete());
});
test('Family avatar uses the same projection and known shared floor', async () => {
  const a = await account({plan: 'family', familyUsed: 100 * GiB - 100});
  await assertSucceeds(put(a.uid, `users/${a.uid}/profile/avatar.png`));
  await assertFails(put(a.uid, `users/${a.uid}/profile/too-large.png`, 101));
});
test('tree media and avatars retain public reads with no document-dependent gate', async () => {
  const a = await account(); const avatar = `users/${a.uid}/profile/avatar.png`;
  await assertSucceeds(put(a.uid, a.objectPath)); await assertSucceeds(put(a.uid, avatar));
  await database.doc(`users/${a.uid}`).delete(); await database.doc(`trees/${a.treeId}`).delete();
  await assertSucceeds(object(null, a.objectPath).getMetadata()); await assertSucceeds(object(null, avatar).getMetadata());
});
test('unsupported paths remain denied', async () => {
  await assertFails(put('unrelated', 'other/synthetic.png'));
});
test('browser-controlled Storage metadata cannot grant paid quota', async () => {
  const a = await account({used: GiB}); await assertFails(put(a.uid, a.objectPath, 100, 'image/png', {plan: 'family', storageQuotaBytes: String(100 * GiB)}));
});
for (const field of ['billing', 'usage', 'family', 'entitlements', 'storageAuthority', 'plan']) test(`browser cannot create or update privileged user ${field}`, async () => {
  const a = await account(); const client = env.authenticatedContext(a.uid).firestore().doc(`users/${a.uid}`);
  await assertFails(client.update({[field]: {plan: 'family', storageUsedBytes: 0}}));
  const newUid = `storage-forged-${++sequence}`;
  await assertFails(env.authenticatedContext(newUid).firestore().doc(`users/${newUid}`).set({[field]: {plan: 'family'}}));
});
test('ordinary self profile updates still work', async () => {
  const a = await account(); await assertSucceeds(env.authenticatedContext(a.uid).firestore().doc(`users/${a.uid}`).update({displayName: 'Synthetic Storage Test'}));
});

// Load the actual compiled webhook mutation functions with only service clients
// substituted. Their transactions persist into the real Firestore emulator.
function webhook() {
  const functionsRequire = createRequire(path.join(root, 'functions/lib/stripeWebhook.js'));
  const mod = {exports: {}};
  const mocks = {'firebase-admin': {apps: [{}], firestore: () => database}, './config': {functionsEnv: {}},
    'firebase-functions/logger': {info() {}, warn() {}, error() {}}};
  new Function('require', 'module', 'exports', fs.readFileSync(path.join(root, 'functions/lib/stripeWebhook.js'), 'utf8'))(
    name => name in mocks ? mocks[name] : functionsRequire(name), mod, mod.exports,
  );
  return mod.exports;
}

function uploadPreparation() {
  const mod = {exports: {}};
  const functionsRequire = createRequire(path.join(root, 'functions/lib/storageAuthority.js'));
  const mocks = {'firebase-admin': {firestore: () => database},
    'firebase-functions/v2/https': {onCall: handler => handler, HttpsError: functionsRequire('firebase-functions/v2/https').HttpsError},
    'firebase-functions/v2/firestore': {onDocumentWritten: (_path, handler) => handler}};
  new Function('require', 'module', 'exports', fs.readFileSync(path.join(root, 'functions/lib/storageAuthority.js'), 'utf8'))(
    name => name in mocks ? mocks[name] : functionsRequire(name), mod, mod.exports,
  );
  return mod.exports;
}

test('upload preparation requires authentication and rejects browser authority fields', async () => {
  const prepare = uploadPreparation().prepareStorageUpload;
  await assert.rejects(prepare({data: {}}), {code: 'unauthenticated'});
  const a = await account({plan: 'family', project: false});
  for (const data of [{uid: a.uid}, {plan: 'family'}, {storageUsedBytes: 0}, {treeId: null}, {treeId: 'trees/forged'}, null]) {
    await assert.rejects(prepare({auth: {uid: a.uid}, data}), {code: 'invalid-argument'});
  }
  assert.equal((await database.doc(`users/${a.uid}`).get()).data().storageAuthority, undefined);
});

test('authorized upload preparation initializes owner projection without changing billing or counters', async () => {
  const a = await account({plan: 'family', familyUsed: 2 * GiB, project: false});
  const before = (await database.doc(`users/${a.uid}`).get()).data();
  const prepare = uploadPreparation().prepareStorageUpload;
  for (const uid of ['viewer', 'unrelated']) await assert.rejects(prepare({auth: {uid}, data: {treeId: a.treeId}}), {code: 'permission-denied'});
  for (const uid of [a.uid, 'editor', 'manager']) assert.deepEqual(await prepare({auth: {uid}, data: {treeId: a.treeId}}), {prepared: true});
  const after = (await database.doc(`users/${a.uid}`).get()).data();
  assert.deepEqual(after.billing, before.billing); assert.deepEqual(after.usage, before.usage); assert.deepEqual(after.family, before.family);
  assert.equal(after.storageAuthority.status, 'active'); await assertSucceeds(put(a.uid, a.objectPath));
});

test('avatar preparation initializes only the authenticated user', async () => {
  const a = await account({plan: 'family', project: false});
  await uploadPreparation().prepareStorageUpload({auth: {uid: a.uid}, data: {}});
  assert.equal((await database.doc(`users/${a.uid}`).get()).data().storageAuthority.status, 'active');
  await assertSucceeds(put(a.uid, `users/${a.uid}/profile/avatar.png`));
});

test('malformed or mismatched linked authority fails closed for growth', async () => {
  const a = await account({plan: 'family'});
  const valid = (await database.doc(`users/${a.uid}`).get()).data().storageAuthority;
  for (const authority of [null, 'family', {...valid, familyId: 'wrong-family'}, {...valid, paidUntil: 0}, {...valid, storageUsedBytes: -1}]) {
    await database.doc(`users/${a.uid}`).update({storageAuthority: authority, 'usage.storageUsedBytes': 2 * GiB});
    await assertFails(put(a.uid, a.objectPath));
  }
});

test('live owner billing immediately invalidates an otherwise active stale Family projection', async () => {
  const a = await account({plan: 'family', used: 2 * GiB});
  await database.doc(`users/${a.uid}`).update({'billing.status': 'past_due'});
  assert.equal((await database.doc(`users/${a.uid}`).get()).data().storageAuthority.status, 'active');
  await assertFails(put(a.uid, a.objectPath));
});

test('storage triggers re-read live authority instead of applying stale event data', async () => {
  const a = await account({plan: 'family', familyUsed: 2 * GiB}); const m = await member(a);
  await database.doc(`families/${a.familyId}`).update({'plan.status': 'past_due'});
  const handlers = uploadPreparation();
  await handlers.onStorageFamilyWritten({params: {familyId: a.familyId}, data: {plan: billing('family', 'active')}});
  assert.equal((await database.doc(`users/${m.uid}`).get()).data().storageAuthority.status, 'none');
  await assertFails(put(m.uid, m.target));
  await database.doc(`users/${m.uid}`).update({family: {familyId: null}});
  await handlers.onStorageUserWritten({params: {uid: m.uid}, data: {family: {familyId: a.familyId}}});
  assert.equal((await database.doc(`users/${m.uid}`).get()).data().storageAuthority.familyId, null);
  assert.equal((await database.doc(`users/${m.uid}`).get()).data().storageAuthority.storageUsedBytes, 2 * GiB);
});

test('unchanged projections do not cause repeated user-trigger writes', async () => {
  const a = await account({plan: 'family'}); const m = await member(a);
  // Firestore map order is not an authority change.
  for (const uid of [a.uid, m.uid]) {
    const ref = database.doc(`users/${uid}`);
    const old = (await ref.get()).data().storageAuthority;
    await ref.update({storageAuthority: Object.fromEntries(Object.entries(old).reverse())});
    const before = await ref.get();
    await uploadPreparation().onStorageUserWritten({params: {uid}});
    assert.ok((await ref.get()).updateTime.isEqual(before.updateTime));
  }
});

test('live owner-user trigger revokes linked projections after trusted out-of-band billing writes', async () => {
  const a = await account({plan: 'family', familyUsed: 2 * GiB}); const m = await member(a);
  await database.doc(`users/${a.uid}`).update({'billing.status': 'past_due'});
  await uploadPreparation().onStorageUserWritten({params: {uid: a.uid}});
  assert.equal((await database.doc(`users/${m.uid}`).get()).data().storageAuthority.status, 'none');
  await assertFails(put(m.uid, m.target));
});

test('mismatched supplied billing owner cannot grant Family or reset the actual owner usage floor', async () => {
  const a = await account({plan: 'family', familyUsed: 60 * GiB});
  const wrong = `storage-wrong-owner-${++sequence}`;
  await database.doc(`users/${wrong}`).set({billing: billing('family', 'active')});
  await webhook().updateFamilyIfNewer(a.familyId, 9000, billing('family', 'active'), wrong);
  const state = (await database.doc(`users/${a.uid}`).get()).data();
  assert.equal(state.storageAuthority.status, 'none');
  assert.equal(state.storageAuthority.storageUsedBytes, 60 * GiB);
  await assertFails(put(a.uid, a.objectPath));
});

async function member(a) {
  const uid = `storage-member-${++sequence}`;
  const target = `trees/storage-member-tree-${sequence}/people/synthetic-person/image.png`;
  await database.doc(`users/${uid}`).set({billing: billing(), family: {familyId: a.familyId, role: 'member'}, usage: {storageUsedBytes: 0}});
  await database.doc(`trees/storage-member-tree-${sequence}`).set({ownerId: uid, collaborators: {}});
  await syncUserStorageAuthority(uid, database);
  return {uid, target};
}
test('linked non-owner Family tree owner receives pooled quota and loses it atomically on payment attention', async () => {
  const a = await account({plan: 'family', familyUsed: 2 * GiB}); const m = await member(a);
  await assertSucceeds(put(m.uid, m.target));
  await webhook().updateBillingIfNewer(a.uid, 1000, billing('family', 'past_due'));
  // Family plan document is deliberately still active here: revocation must be
  // committed with the owner's billing mutation, not delayed until its trigger.
  assert.equal((await database.doc(`families/${a.familyId}`).get()).data().plan.status, 'active');
  assert.equal((await database.doc(`users/${m.uid}`).get()).data().storageAuthority.status, 'none');
  await assertFails(put(m.uid, m.target + '.denied'));
});
test('Family plan mutation atomically updates member projection, rejects older events and restores on recovery', async () => {
  const a = await account({plan: 'family', familyUsed: 2 * GiB}); const m = await member(a);
  const w = webhook();
  await w.updateFamilyIfNewer(a.familyId, 2000, billing('family', 'past_due'), a.uid);
  await assertFails(put(m.uid, m.target));
  assert.equal(await w.updateFamilyIfNewer(a.familyId, 1999, billing('family', 'active'), a.uid), false);
  await assertFails(put(m.uid, m.target));
  await w.updateFamilyIfNewer(a.familyId, 2001, billing('family', 'active'), a.uid);
  await assertSucceeds(put(m.uid, m.target));
});
test('downgrade and unlink retain known Family usage floor and remove Family quota', async () => {
  const a = await account({plan: 'family', familyUsed: 60 * GiB}); const m = await member(a);
  await webhook().updateBillingIfNewer(a.uid, 3000, billing('pro', 'active'));
  await webhook().updateFamilyIfNewer(a.familyId, 3000, billing('pro', 'active'), a.uid);
  const state = (await database.doc(`users/${a.uid}`).get()).data();
  assert.equal(state.storageAuthority.storageUsedBytes, 60 * GiB); await assertFails(put(a.uid, a.objectPath));
  await database.doc(`users/${m.uid}`).update({family: {familyId: null}}); await syncUserStorageAuthority(m.uid, database);
  assert.equal((await database.doc(`users/${m.uid}`).get()).data().storageAuthority.storageUsedBytes, 60 * GiB);
  await assertFails(put(m.uid, m.target));
});
