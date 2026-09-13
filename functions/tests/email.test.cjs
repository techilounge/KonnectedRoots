const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('sanitized email failures retain permanent-error retry behavior', async () => {
  let calls = 0;
  const logs = [];
  const mocks = {
    './config': {functionsEnv: {resendApiKey: 'fixture'}},
    resend: {Resend: class {emails = {send: async () => {calls++; return {error: {message: 'invalid private-fixture'}};}};}},
    'firebase-functions/logger': {error: (...args) => logs.push(args), info: (...args) => logs.push(args)},
  };
  const mod = {exports: {}};
  new Function('require', 'module', 'exports', fs.readFileSync(path.join(__dirname, '../lib/sendEmail.js'), 'utf8'))(
    name => {if (!(name in mocks)) throw Error(name); return mocks[name];}, mod, mod.exports);
  const result = await mod.exports.sendEmailWithRetry({to:'fixture@example.test', subject:'Synthetic', html:'Synthetic'});
  assert.equal(calls, 1);
  assert.equal(result.success, false);
  assert.equal(result.delivery, 'failed');
  assert.ok(!JSON.stringify([result, logs]).includes('private-fixture'));
});

test('local billing email suppression requires every dedicated emulator guard', () => {
  const mocks = {
    './config': {functionsEnv: {resendApiKey: undefined}},
    resend: {Resend: class {}},
    'firebase-functions/logger': {error() {}, info() {}},
  };
  const mod = {exports: {}};
  new Function('require', 'module', 'exports', fs.readFileSync(path.join(__dirname, '../lib/sendEmail.js'), 'utf8'))(
    name => {if (!(name in mocks)) throw Error(name); return mocks[name];}, mod, mod.exports);
  const local = {
    NODE_ENV: 'development',
    LOCAL_BILLING_TEST_DISABLE_EMAIL: 'true',
    FUNCTIONS_EMULATOR: 'true',
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    GCLOUD_PROJECT: 'demo-konnectedroots-phase2',
  };
  assert.equal(mod.exports.shouldSuppressLocalBillingEmail(local), true);
  assert.equal(mod.exports.shouldSuppressLocalBillingEmail({...local, FUNCTIONS_EMULATOR: 'false'}), false);
  assert.equal(mod.exports.shouldSuppressLocalBillingEmail({...local, FIRESTORE_EMULATOR_HOST: 'firestore.example:8080'}), false);
  assert.equal(mod.exports.shouldSuppressLocalBillingEmail({...local, GCLOUD_PROJECT: 'production-project'}), false);
});

test('local billing email suppression cannot activate in production', () => {
  const mocks = {
    './config': {functionsEnv: {resendApiKey: undefined}},
    resend: {Resend: class {}},
    'firebase-functions/logger': {error() {}, info() {}},
  };
  const mod = {exports: {}};
  new Function('require', 'module', 'exports', fs.readFileSync(path.join(__dirname, '../lib/sendEmail.js'), 'utf8'))(
    name => {if (!(name in mocks)) throw Error(name); return mocks[name];}, mod, mod.exports);
  assert.equal(mod.exports.shouldSuppressLocalBillingEmail({
    NODE_ENV: 'production',
    LOCAL_BILLING_TEST_DISABLE_EMAIL: 'true',
    FUNCTIONS_EMULATOR: 'true',
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    GCLOUD_PROJECT: 'demo-konnectedroots-phase2',
  }), false);
});

test('suppressed local billing email never calls Resend or logs message data', async (t) => {
  const keys = ['NODE_ENV', 'LOCAL_BILLING_TEST_DISABLE_EMAIL', 'FUNCTIONS_EMULATOR', 'FIRESTORE_EMULATOR_HOST', 'GCLOUD_PROJECT'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, {
    NODE_ENV: 'development',
    LOCAL_BILLING_TEST_DISABLE_EMAIL: 'true',
    FUNCTIONS_EMULATOR: 'true',
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    GCLOUD_PROJECT: 'demo-konnectedroots-phase2',
  });
  t.after(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
  let providerCalls = 0;
  const logs = [];
  const mocks = {
    './config': {functionsEnv: {resendApiKey: 'fixture'}},
    resend: {Resend: class {emails = {send: async () => {providerCalls++; return {data: {id: 'unexpected'}};}};}},
    'firebase-functions/logger': {error: (...args) => logs.push(args), info: (...args) => logs.push(args)},
  };
  const mod = {exports: {}};
  new Function('require', 'module', 'exports', fs.readFileSync(path.join(__dirname, '../lib/sendEmail.js'), 'utf8'))(
    name => {if (!(name in mocks)) throw Error(name); return mocks[name];}, mod, mod.exports);
  const result = await mod.exports.sendEmail({
    to: 'private-recipient@example.test',
    subject: 'private-subject',
    html: 'private-body',
  });
  assert.equal(result.success, true);
  assert.equal(result.delivery, 'suppressed');
  assert.equal(providerCalls, 0);
  assert.equal(JSON.stringify(logs).includes('private-'), false);
  assert.deepEqual(logs, [['Local billing test: outbound email suppressed']]);
});

test('production email delivery remains active when local suppression variables are present', async (t) => {
  const keys = ['NODE_ENV', 'LOCAL_BILLING_TEST_DISABLE_EMAIL', 'FUNCTIONS_EMULATOR', 'FIRESTORE_EMULATOR_HOST', 'GCLOUD_PROJECT'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, {
    NODE_ENV: 'production',
    LOCAL_BILLING_TEST_DISABLE_EMAIL: 'true',
    FUNCTIONS_EMULATOR: 'true',
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    GCLOUD_PROJECT: 'demo-konnectedroots-phase2',
  });
  t.after(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
  let providerCalls = 0;
  const logs = [];
  const mocks = {
    './config': {functionsEnv: {resendApiKey: 'fixture'}},
    resend: {Resend: class {emails = {send: async () => {providerCalls++; return {data: {id: 'email_fixture'}};}};}},
    'firebase-functions/logger': {error: (...args) => logs.push(args), info: (...args) => logs.push(args)},
  };
  const mod = {exports: {}};
  new Function('require', 'module', 'exports', fs.readFileSync(path.join(__dirname, '../lib/sendEmail.js'), 'utf8'))(
    name => {if (!(name in mocks)) throw Error(name); return mocks[name];}, mod, mod.exports);
  const result = await mod.exports.sendEmail({to: 'fixture@example.test', subject: 'Synthetic', html: 'Synthetic'});
  assert.equal(providerCalls, 1);
  assert.equal(result.success, true);
  assert.equal(result.delivery, 'sent');
  assert.equal(result.emailId, 'email_fixture');
  assert.equal(logs.some(entry => entry[0] === 'Email sent successfully'), true);
});
