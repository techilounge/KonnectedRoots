const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function transpile(file) {
  return ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true},
  }).outputText;
}

function loadEmulatorConfig() {
  const mod = {exports: {}};
  new Function('require', 'module', 'exports', transpile('src/lib/firebase/emulator-config.ts'))(require, mod, mod.exports);
  return mod.exports;
}

function loadAdmin(env) {
  const calls = {initialize: [], cert: 0, adc: 0};
  const admin = {
    apps: [],
    credential: {
      cert(account) { calls.cert++; return {kind: 'cert', account}; },
      applicationDefault() { calls.adc++; return {kind: 'adc'}; },
    },
    initializeApp(options) { calls.initialize.push(options); const app = {options}; admin.apps.push(app); return app; },
    auth() { return {kind: 'auth'}; },
    firestore() { return {kind: 'firestore'}; },
  };
  const serverEnv = {
    firebaseServiceAccount: env.FIREBASE_SERVICE_ACCOUNT,
    firebaseProjectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    firebaseStorageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    isVercel: env.VERCEL === '1' || Boolean(env.VERCEL_ENV),
    isLocalDevelopment: env.NODE_ENV === 'development' || env.NODE_ENV === 'test',
    hasAdcEnvironment: Boolean(env.GOOGLE_APPLICATION_CREDENTIALS || env.K_SERVICE || env.FUNCTION_NAME || env.GAE_ENV),
  };
  const mocks = {
    'server-only': {},
    '@/lib/config/env.server': {serverEnv},
    './emulator-config': loadEmulatorConfig(),
    'firebase-admin': admin,
    path,
    fs: {existsSync: () => false},
  };
  const mod = {exports: {}};
  const run = () => new Function('require', 'module', 'exports', 'process', 'Buffer', transpile('src/lib/firebase/admin.ts'))(
    name => {if (!(name in mocks)) throw Error(name); return mocks[name];},
    mod,
    mod.exports,
    {env, cwd: () => process.cwd()},
    Buffer,
  );
  return {run, calls, mod};
}

const localEnv = {
  NODE_ENV: 'development',
  USE_FIREBASE_EMULATORS: 'true',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  GCLOUD_PROJECT: 'demo-konnectedroots-phase2',
};

test('Admin emulator mode needs no service account or ADC', () => {
  const fixture = loadAdmin(localEnv);
  fixture.run();
  assert.deepEqual(fixture.calls.initialize, [{
    projectId: 'demo-konnectedroots-phase2',
    storageBucket: 'demo-konnectedroots-phase2.appspot.com',
  }]);
  assert.equal(fixture.calls.cert, 0);
  assert.equal(fixture.calls.adc, 0);
});

test('Vercel still requires FIREBASE_SERVICE_ACCOUNT', () => {
  const fixture = loadAdmin({NODE_ENV: 'production', VERCEL: '1'});
  assert.throws(fixture.run, /FIREBASE_SERVICE_ACCOUNT/);
  assert.equal(fixture.calls.initialize.length, 0);
});

test('Admin emulator mode cannot activate in production or with remote hosts', () => {
  assert.throws(() => loadAdmin({...localEnv, NODE_ENV: 'production'}).run(), /development and test/);
  assert.throws(() => loadAdmin({...localEnv, FIRESTORE_EMULATOR_HOST: 'example.test:8080'}).run(), /fixed local/);
});

test('normal service-account initialization remains unchanged when emulator mode is off', () => {
  const fixture = loadAdmin({
    NODE_ENV: 'production',
    FIREBASE_SERVICE_ACCOUNT: JSON.stringify({type: 'service_account', project_id: 'fixture-project', client_email: 'fixture@example.test', private_key: 'fixture-key'}),
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'fixture.appspot.com',
  });
  fixture.run();
  assert.equal(fixture.calls.cert, 1);
  assert.equal(fixture.calls.adc, 0);
  assert.equal(fixture.calls.initialize[0].storageBucket, 'fixture.appspot.com');
});

test('browser emulator flag is strict and client hosts are fixed locally', () => {
  const source = fs.readFileSync('src/lib/firebase/clients.ts', 'utf8');
  const envSource = fs.readFileSync('src/lib/config/env.client.ts', 'utf8');
  assert.match(envSource, /NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true'/);
  assert.match(source, /connectAuthEmulator\(auth, 'http:\/\/127\.0\.0\.1:9099'/);
  assert.match(source, /connectFirestoreEmulator\(db, '127\.0\.0\.1', 8080\)/);
  assert.match(source, /connectFunctionsEmulator\(functions, '127\.0\.0\.1', 5001\)/);
  assert.match(source, /connectStorageEmulator\(storage, '127\.0\.0\.1', 9199\)/);
});

test('billing emulator config uses the fixed ports and existing project sources', () => {
  const config = JSON.parse(fs.readFileSync('firebase.billing-test.json', 'utf8'));
  assert.deepEqual(config.functions, {source: 'functions'});
  assert.deepEqual(config.firestore, {rules: 'firestore.rules', indexes: 'firestore.indexes.json'});
  assert.deepEqual(config.storage, {rules: 'storage.rules'});
  assert.deepEqual(config.emulators.auth, {host: '127.0.0.1', port: 9099});
  assert.deepEqual(config.emulators.functions, {host: '127.0.0.1', port: 5001});
  assert.deepEqual(config.emulators.firestore, {host: '127.0.0.1', port: 8080});
  assert.deepEqual(config.emulators.storage, {host: '127.0.0.1', port: 9199});
  assert.deepEqual(config.emulators.ui, {host: '127.0.0.1', port: 4000});
  assert.equal(config.emulators.singleProjectMode, true);
});
