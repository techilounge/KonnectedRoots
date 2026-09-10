const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const policy = require('../lib/collaborationPolicy.js');
const NOW = 1_000_000;

function freeOwner() { return { billing: { plan: 'free', status: 'none', currentPeriodEnd: 0 } }; }
function paidOwner(plan) { return { billing: { plan, status: 'active', currentPeriodEnd: NOW + 10_000 } }; }
function tree(collaborators = {}) { return { ownerId: 'owner', collaborators: { ...collaborators } }; }

function persistIfAllowed(currentTree, role, ownerData, inviteeUid) {
  const result = policy.validateCollaboratorAdd(currentTree, role, ownerData, inviteeUid, NOW);
  if (result.allowed) currentTree.collaborators[inviteeUid] = role;
  return result;
}

test('Free allows the first Editor', () => {
  const current = tree();
  assert.deepEqual(persistIfAllowed(current, 'editor', freeOwner(), 'editor-1'), { allowed: true });
  assert.equal(current.collaborators['editor-1'], 'editor');
});

test('Free rejects a second Editor after the newer persisted state', () => {
  const current = tree({ 'editor-1': 'editor' });
  const result = persistIfAllowed(current, 'editor', freeOwner(), 'editor-2');
  assert.equal(result.allowed, false);
  assert.equal(current.collaborators['editor-2'], undefined);
});

test('Free allows one Editor and one Viewer', () => {
  const current = tree({ 'editor-1': 'editor' });
  assert.deepEqual(persistIfAllowed(current, 'viewer', freeOwner(), 'viewer-1'), { allowed: true });
  assert.deepEqual(current.collaborators, { 'editor-1': 'editor', 'viewer-1': 'viewer' });
});

test('Free rejects a third collaborator', () => {
  const current = tree({ 'editor-1': 'editor', 'viewer-1': 'viewer' });
  const result = persistIfAllowed(current, 'viewer', freeOwner(), 'viewer-2');
  assert.equal(result.allowed, false);
  assert.equal(Object.keys(current.collaborators).length, 2);
});

test('Free allows two Viewers', () => {
  const current = tree({ 'viewer-1': 'viewer' });
  assert.deepEqual(persistIfAllowed(current, 'viewer', freeOwner(), 'viewer-2'), { allowed: true });
});

test('Viewer role cannot edit while a Free Editor can edit', () => {
  assert.equal(policy.canEditRole('viewer'), false);
  assert.equal(policy.canEditRole('editor'), true);
});

test('Free Editor membership is retained as an editable persisted role', () => {
  const current = tree();
  persistIfAllowed(current, 'editor', freeOwner(), 'editor-1');
  assert.equal(policy.canEditRole(current.collaborators['editor-1']), true);
});

test('Owner is excluded from collaborator count and cannot be invited as a member', () => {
  const current = tree({ owner: 'owner' });
  assert.deepEqual(persistIfAllowed(current, 'viewer', freeOwner(), 'viewer-1'), { allowed: true });
  const ownerResult = policy.validateCollaboratorAdd(current, 'viewer', freeOwner(), 'owner', NOW);
  assert.equal(ownerResult.allowed, false);
  assert.equal(Object.keys(current.collaborators).filter(uid => uid !== current.ownerId).length, 1);
});

test('Family collaborator capacity is separate from Family account seats', () => {
  const current = tree({ 'member-1': 'viewer' });
  const result = policy.validateCollaboratorAdd(current, 'manager', paidOwner('family'), 'collab-1', NOW);
  assert.deepEqual(result, { allowed: true });
  assert.equal(policy.collaborationPolicy(paidOwner('family'), NOW).maxCollaborators, 20);
  assert.equal(policy.collaborationPolicy(paidOwner('family'), NOW).allowedRoles.includes('manager'), true);
});

test('Firestore rules keep collaborator membership server-owned', () => {
  const rules = fs.readFileSync(path.join(__dirname, '../../firestore.rules'), 'utf8');
  assert.match(rules, /affectedKeys\(\)\.hasAny\(\['collaborators'\]\)/);
  assert.match(rules, /allow create: if isPlatformAdmin\(\);/);
});
