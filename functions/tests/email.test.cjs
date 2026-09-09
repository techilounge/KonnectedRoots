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
  assert.ok(!JSON.stringify([result, logs]).includes('private-fixture'));
});
