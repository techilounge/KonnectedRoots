const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { test } = require('node:test');
const assert = require('node:assert/strict');

function fixture(userData) {
  const updates = [];
  const userRef = { collection: 'users', id: 'fixture' };
  const adminDb = {
    collection(name) {
      return { doc(id) { return { collection: name, id }; } };
    },
    async runTransaction(callback) {
      const transaction = {
        async get(ref) {
          if (ref.collection === 'users' && ref.id === 'fixture') return { exists: userData !== null, data: () => userData || {} };
          return { exists: false, data: () => ({}) };
        },
        update(ref, data) { updates.push({ ref, data }); },
      };
      return callback(transaction);
    },
  };
  const adminAuth = { verifyIdToken: async token => {
    if (token !== 'valid-token') throw new Error('invalid');
    return { uid: 'fixture' };
  } };
  const admin = { firestore: { FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' } } };
  const cache = new Map();
  function read(file) {
    const target = path.resolve(file);
    if (cache.has(target)) return cache.get(target).exports;
    const module = { exports: {} };
    cache.set(target, module);
    const code = ts.transpileModule(fs.readFileSync(target, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', code)((request) => {
      if (request === 'server-only') return {};
      if (request === 'firebase-admin') return admin;
      if (request === '@/lib/firebase/admin') return { adminAuth, adminDb };
      if (request.startsWith('./')) return read(path.join(path.dirname(target), request + (request.endsWith('.ts') ? '' : '.ts')));
      return require(request);
    }, module, module.exports);
    return module.exports;
  }
  return { usage: read('src/lib/billing/serverUsage.ts'), userData, updates, userRef };
}

function freeUser(overrides = {}) {
  return {
    billing: { plan: 'free', status: 'none', currentPeriodEnd: 0, addons: {} },
    usage: { monthKey: new Date().toISOString().slice(0, 7), exportsUsed: 2, aiActionsUsed: 0, aiActionsAllowance: 10, storageUsedBytes: 0 },
    ...overrides,
  };
}

test('Free GEDCOM export succeeds', async () => {
  const f = fixture(freeUser());
  const result = await f.usage.recordExportOnServer('valid-token', 'gedcom');
  assert.equal(result.success, true);
  assert.equal(f.updates.length, 0);
});

test('GEDCOM succeeds even when the visual export allowance is exhausted', async () => {
  const f = fixture(freeUser({ usage: { ...freeUser().usage, exportsUsed: 2 } }));
  const result = await f.usage.recordExportOnServer('valid-token', 'gedcom');
  assert.equal(result.success, true);
  assert.equal(result.exportsUsed, 2);
});

test('GEDCOM does not increment exportsUsed', async () => {
  const f = fixture(freeUser({ usage: { ...freeUser().usage, exportsUsed: 1 } }));
  await f.usage.recordExportOnServer('valid-token', 'gedcom');
  assert.equal(f.userData.usage.exportsUsed, 1);
  assert.equal(f.updates.length, 0);
});

test('PNG and PDF retain the visual quota and accounting', async () => {
  const blocked = fixture(freeUser());
  assert.equal((await blocked.usage.recordExportOnServer('valid-token', 'png')).success, false);
  const available = fixture(freeUser({ usage: { ...freeUser().usage, exportsUsed: 1 } }));
  assert.equal((await available.usage.recordExportOnServer('valid-token', 'pdf')).success, true);
  assert.equal(available.updates.some(update => update.data['usage.exportsUsed'] === 2), true);
});

test('A downgraded former paid account can still export GEDCOM', async () => {
  const f = fixture(freeUser({ billing: { plan: 'pro', status: 'canceled', currentPeriodEnd: 0, addons: {} } }));
  assert.equal((await f.usage.recordExportOnServer('valid-token', 'gedcom')).success, true);
  assert.equal(f.updates.length, 0);
});

test('Unauthenticated or invalid sessions cannot record GEDCOM exports', async () => {
  const f = fixture(freeUser());
  assert.equal((await f.usage.recordExportOnServer(undefined, 'gedcom')).success, false);
  assert.equal((await f.usage.recordExportOnServer('invalid-token', 'gedcom')).success, false);
});

test('A valid session without a server profile cannot export private data', async () => {
  const f = fixture(null);
  const result = await f.usage.recordExportOnServer('valid-token', 'gedcom');
  assert.equal(result.success, false);
  assert.match(result.error, /profile/i);
});
