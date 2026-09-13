const {test} = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const {treeHandlers, ast} = require('../tests/helpers/tree-editor.cjs');

function addHarness({rejectCommit = false, rejectSnapshot = false} = {}) {
  const staged = [], persisted = new Map(), toasts = [], commands = [], order = [], warnings = [];
  const timestamp = Symbol('serverTimestamp');
  const handlers = treeHandlers({
    db: {}, getPeopleColRef: () => 'trees/synthetic-tree/people', getTreeDocRef: () => 'trees/synthetic-tree',
    doc: (ref, id = 'synthetic-person') => ({path: `${ref}/${id}`, id}), serverTimestamp: () => timestamp,
    writeBatch: () => ({
      set: (ref, data) => staged.push({kind: 'set', path: ref.path, data}),
      update: (ref, data) => staged.push({kind: 'update', path: ref, data}),
      async commit() {
        order.push('commit');
        if (rejectCommit) throw Error('Synthetic denied atomic commit');
        for (const operation of staged) persisted.set(operation.path, operation.data);
      },
    }),
    pushCommand: command => {order.push('undo'); commands.push(command);},
    toast: value => {order.push('toast'); toasts.push(value);},
    saveLayoutSnapshot: async () => {order.push('snapshot'); if (rejectSnapshot) throw Error('Synthetic snapshot failure');},
    console: {error() {}, warn: value => warnings.push(value)},
    // Any legacy separate write fails the test instead of silently succeeding.
    setDoc() {assert.fail('No separate person create');}, updateDoc() {assert.fail('No post-create parent write');},
    increment() {assert.fail('Browser cannot maintain memberCount');},
  });
  return {handlers, staged, persisted, toasts, commands, order, warnings, timestamp};
}
test('Add atomically persists person and timestamp without client memberCount or later parent write', async () => {
  const h = addHarness(); await h.handlers.handleAddPerson({firstName: 'Synthetic Added'});
  assert.equal(h.persisted.get('trees/synthetic-tree/people/synthetic-person').firstName, 'Synthetic Added');
  assert.deepEqual(h.persisted.get('trees/synthetic-tree'), {lastUpdated: h.timestamp});
  assert.equal(h.staged.length, 2); assert.deepEqual(h.order, ['commit', 'undo', 'toast', 'snapshot']);
  assert.equal(h.commands.length, 1); assert.deepEqual(h.toasts.map(t => t.title), ['Person Added']);
});
test('Denied Add batch persists neither person nor timestamp and reports failure only', async () => {
  const h = addHarness({rejectCommit: true}); await h.handlers.handleAddPerson({firstName: 'Synthetic Denied'});
  assert.equal(h.persisted.size, 0); assert.equal(h.commands.length, 0);
  assert.deepEqual(h.order, ['commit', 'toast']); assert.equal(h.toasts[0].description, 'Failed to save new person.');
});
test('Post-commit layout failure leaves successful Add and does not invite duplicate retry', async () => {
  const h = addHarness({rejectSnapshot: true}); await h.handlers.handleAddPerson({firstName: 'Synthetic Saved'});
  assert.equal(h.persisted.size, 2); assert.equal(h.commands.length, 1);
  assert.deepEqual(h.toasts.map(t => t.title), ['Person Added']);
  assert.deepEqual(h.warnings, ['Person added, but layout snapshot could not be saved.']);
});
for (const action of ['handleAddPerson', 'handleConfirmDelete', 'handleMergeDuplicates']) test(`Viewer ${action} never constructs a write batch`, async () => {
  const handlers = treeHandlers({readOnly: true, personToDelete: {id: 'synthetic-person'},
    writeBatch() {assert.fail('Viewer must not write');}, getPeopleColRef() {assert.fail('Viewer must not write');}});
  await handlers[action]({firstName: 'Synthetic Viewer'}, 'synthetic-duplicate');
});
test('All four parent-tree writes in the page contain only serverTimestamp lastUpdated', () => {
  const writes = [];
  function visit(node) {
    if (ts.isCallExpression(node) && node.arguments[0]?.getText(ast) === 'getTreeDocRef()') writes.push(node);
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.equal(writes.length, 4);
  for (const write of writes) {
    assert.equal(write.expression.getText(ast), 'batch.update');
    assert.equal(write.arguments[1].properties.length, 1);
    assert.equal(write.arguments[1].properties[0].name.getText(ast), 'lastUpdated');
    assert.equal(write.arguments[1].properties[0].initializer.getText(ast), 'serverTimestamp()');
  }
});
