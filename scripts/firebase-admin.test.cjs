const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('src/lib/firebase/admin.ts', 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
// Deliberately non-credential data; certificate validation is mocked below.
const fixture = JSON.stringify({ type: 'service_account', project_id: 'test-project',
  client_email: 'test@example.invalid', private_key: 'test-only-invalid-key' });
function run(env = {}, file, certError = false, existing = false) {
  const calls = [];
  const app = {};
  const admin = {
    apps: existing ? [app] : [],
    credential: {
      cert: () => { calls.push('cert'); if (certError) throw new Error('sensitive-sdk-input'); return 'certificate'; },
      applicationDefault: () => { calls.push('adc'); return 'adc'; },
    },
    initializeApp: options => { calls.push(options); return app; },
    auth: () => ({}), firestore: () => ({}),
  };
  vm.runInNewContext(code, {
    exports: {}, Buffer, process: { env, cwd: () => '/local' },
    require: name => {
      if (name === 'server-only') return {};
      if (name === 'firebase-admin') return admin;
      if (name === 'path') return require('node:path');
      if (name === 'fs') return {
        existsSync: () => { calls.push('file'); return file !== undefined; },
        readFileSync: () => file,
      };
      throw new Error(name);
    },
  });
  return calls;
}
test('raw and Base64 environment credentials take priority on Vercel', () => {
  for (const value of [fixture, Buffer.from(fixture).toString('base64')]) {
    const calls = run({ VERCEL: '1', NODE_ENV: 'production', FIREBASE_SERVICE_ACCOUNT: value }, fixture);
    assert.equal(calls[0], 'cert');
    assert.equal(calls[1].projectId, 'test-project');
    assert.equal(calls.length, 2);
  }
});
test('invalid configuration fails closed with sanitized errors', () => {
  for (const value of ['', ' ', '{sensitive-input', '%%%sensitive-input', 'null', '[]', '{}', Buffer.from('{}').toString('base64')]) {
    assert.throws(() => run({ NODE_ENV: 'development', FIREBASE_SERVICE_ACCOUNT: value }, fixture),
      error => error.message.startsWith('Invalid Firebase Admin credentials in FIREBASE_SERVICE_ACCOUNT.') && !error.message.includes('sensitive-input'));
  }
  assert.throws(() => run({ FIREBASE_SERVICE_ACCOUNT: fixture }, undefined, true),
    error => !error.message.includes('sensitive-sdk-input'));
});
test('Vercel refuses local files and ADC even when configured', () => {
  for (const env of [{ VERCEL: '1' }, { VERCEL_ENV: 'production' }, { VERCEL_ENV: 'preview' }]) {
    assert.throws(() => run({ ...env, GOOGLE_APPLICATION_CREDENTIALS: '/identity', NODE_ENV: 'production' }, fixture), /requires the server-only FIREBASE_SERVICE_ACCOUNT/);
  }
});
test('local file works only in development/test and invalid files fail', () => {
  for (const NODE_ENV of ['development', 'test']) {
    assert.equal(run({ NODE_ENV }, fixture)[1], 'cert');
    assert.throws(() => run({ NODE_ENV }, '{invalid'), /local service-account.json/);
    assert.equal(run({ NODE_ENV })[1], 'adc');
  }
  assert.throws(() => run({ NODE_ENV: 'production' }, fixture), /credentials are missing/);
});
test('production ADC requires explicit configuration or hosted identity', () => {
  for (const key of ['GOOGLE_APPLICATION_CREDENTIALS', 'K_SERVICE', 'FUNCTION_NAME', 'GAE_ENV']) {
    assert.equal(run({ NODE_ENV: 'production', [key]: 'configured' }, fixture)[0], 'adc');
  }
});
test('existing app is reused', () => assert.deepEqual(run({}, undefined, false, true), []));
