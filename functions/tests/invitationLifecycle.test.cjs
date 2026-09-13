const {test} = require('node:test');
const assert = require('node:assert/strict');
const {loadInvitations} = require('./helpers/invitations.cjs');
function fixture(existing = false) {
  const docs = new Map(), identities = new Map(), lookups = []; let seq = 0;
  const snapshot = ref => ({ref, id: ref.id, exists: docs.has(ref.path), data: () => docs.get(ref.path)});
  const document = path => ({path, id: path.split('/').at(-1), get: async function () {return snapshot(this);}, update: async fields => docs.set(path, {...docs.get(path), ...fields})});
  const collection = (name, filters = []) => ({
    doc: id => document(`${name}/${id || `generated-${++seq}`}`),
    where: (key, op, value) => collection(name, [...filters, [key, value]]),
    async get() {const found = [...docs.keys()].filter(path => path.startsWith(`${name}/`) && filters.every(([key, value]) => docs.get(path)[key] === value)).map(path => snapshot(document(path))); return {empty: !found.length, size: found.length, docs: found, forEach: fn => found.forEach(fn)};},
  });
  const writer = () => {const pending = []; return {get: ref => ref.get(), create: (ref, fields) => pending.push(() => {if (docs.has(ref.path)) throw Error('duplicate'); docs.set(ref.path, fields);}), set: (ref, fields) => pending.push(() => docs.set(ref.path, fields)), update: (ref, fields) => pending.push(() => {if (!docs.has(ref.path)) throw Error('missing'); docs.set(ref.path, {...docs.get(ref.path), ...fields});}), commit: async () => pending.forEach(fn => fn())};};
  const db = {collection, batch: writer, async runTransaction(fn) {await f.beforeTransaction?.(); const tx = writer(); const result = await fn(tx); await tx.commit(); return result;}};
  const auth = {
    async getUserByEmail(email) {lookups.push(email); const user = [...identities.values()].find(u => u.email === email); if (!user) throw Object.assign(Error('not found'), {code: 'auth/user-not-found'}); return user;},
    async getUser(uid) {if (!identities.has(uid)) throw Object.assign(Error('not found'), {code: 'auth/user-not-found'}); return identities.get(uid);},
  };
  docs.set('users/owner', {displayName: 'Synthetic Owner', billing: {plan: 'pro', status: 'active', currentPeriodEnd: Date.now() + 86400000}});
  docs.set('trees/synthetic', {ownerId: 'owner', title: 'Synthetic Tree', collaborators: {manager: 'manager', viewer: 'viewer'}});
  if (existing) identities.set('invitee', {uid: 'invitee', email: 'invited@example.test'});
  const handlers = loadInvitations(db, auth);
  const create = role => handlers.createInvitation({auth: {uid: 'owner', token: {email: 'owner@example.test'}}, data: {treeId: 'synthetic', inviteeEmail: 'invited@example.test', role}});
  const accept = (id, uid = 'invitee', email = 'invited@example.test') => handlers.acceptInvitation({auth: {uid, token: {email}}, data: {invitationId: id}});
  const register = async (uid = 'invitee', email = 'invited@example.test', profileEmail = email) => {
    identities.set(uid, {uid, email}); docs.set(`users/${uid}`, {email: profileEmail, displayName: 'Synthetic Invitee'});
    await handlers.onUserCreated({data: snapshot(document(`users/${uid}`)), params: {userId: uid}});
  };
  const f = {docs, identities, lookups, handlers, create, accept, register};
  return f;
}
for (const role of ['viewer', 'editor', 'manager']) test(`new ${role} invitation links after normal profile creation but grants membership only on explicit Accept`, async () => {
  const f = fixture(); const {invitationId} = await f.create(role); let invite = f.docs.get(`invitations/${invitationId}`);
  assert.equal(invite.inviteeUid, null); assert.equal(invite.status, 'pending');
  await f.register(); invite = f.docs.get(`invitations/${invitationId}`); assert.equal(invite.inviteeUid, 'invitee'); assert.equal(invite.status, 'pending'); assert.equal(f.docs.get('trees/synthetic').collaborators.invitee, undefined);
  await f.accept(invitationId); assert.equal(f.docs.get('trees/synthetic').collaborators.invitee, role); assert.equal(f.docs.get(`invitations/${invitationId}`).status, 'accepted');
  await assert.rejects(f.accept(invitationId), {code: 'failed-precondition'});
});
test('existing Firebase Auth invitee is linked at creation', async () => {
  const f = fixture(true); const {invitationId} = await f.create('editor'); assert.equal(f.docs.get(`invitations/${invitationId}`).inviteeUid, 'invitee'); assert.deepEqual(f.lookups, ['invited@example.test']);
});
test('client profile email cannot spoof trusted inviteeUid during creation or linking', async () => {
  const f = fixture(); f.docs.set('users/attacker', {email: 'invited@example.test'});
  const {invitationId} = await f.create('editor'); assert.equal(f.docs.get(`invitations/${invitationId}`).inviteeUid, null);
  await f.register('attacker', 'wrong@example.test', 'invited@example.test'); assert.equal(f.docs.get(`invitations/${invitationId}`).inviteeUid, null); assert.equal(f.docs.get(`invitations/${invitationId}`).status, 'pending');
  await assert.rejects(f.accept(invitationId, 'attacker', 'wrong@example.test'), {code: 'permission-denied'}); assert.equal(f.docs.get('trees/synthetic').collaborators.attacker, undefined);
});
test('account existence lookup only runs after authenticated owner/manager authorization', async () => {
  const f = fixture(); const data = {treeId: 'synthetic', inviteeEmail: 'invited@example.test', role: 'editor'};
  await assert.rejects(f.handlers.createInvitation({data}), {code: 'unauthenticated'});
  for (const uid of ['viewer', 'stranger']) await assert.rejects(f.handlers.createInvitation({auth: {uid}, data}), {code: 'permission-denied'});
  assert.deepEqual(f.lookups, []);
  await f.handlers.createInvitation({auth: {uid: 'manager'}, data}); assert.equal(f.lookups.length, 1);
});
test('wrong account cannot accept and inviter loss of role cannot grant collaborator', async () => {
  const f = fixture(true); const {invitationId} = await f.create('editor');
  await assert.rejects(f.accept(invitationId, 'wrong', 'wrong@example.test'), {code: 'permission-denied'});
  f.docs.get('invitations/' + invitationId).inviterUid = 'viewer'; await assert.rejects(f.accept(invitationId), {code: 'permission-denied'});
  assert.equal(f.docs.get('trees/synthetic').collaborators.invitee, undefined); assert.equal(f.docs.get('invitations/' + invitationId).status, 'pending');
});

for (const state of ['deleted', 'declined', 'accepted']) test(`acceptance transaction refuses an invitation ${state} after its initial read`, async () => {
  const f = fixture(true), {invitationId} = await f.create('editor');
  f.beforeTransaction = () => {if (state === 'deleted') f.docs.delete(`invitations/${invitationId}`); else f.docs.get(`invitations/${invitationId}`).status = state;};
  await assert.rejects(f.accept(invitationId), {code: 'failed-precondition'}); assert.equal(f.docs.get('trees/synthetic').collaborators.invitee, undefined);
});
