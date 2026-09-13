const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Use the installed v2 trigger constructors so these assertions inspect the
// deployment metadata, without initializing real services or reading secrets.
function loadExports() {
  const modules = {};
  const mocks = {
    'firebase-admin': {apps: [{}], initializeApp() {}, firestore: () => ({})},
    './config': {functionsEnv: {}},
    './sendEmail': {sendEmail: () => assert.fail('Constructing triggers must not send email')},
    './emailTemplates': {},
    './collaborationPolicy': {},
    './billingCatalog': {},
    './billingSchedules': {},
    './stripeBilling': {},
    './familyDowngrade': {},
    './storageAuthority': {},
  };
  function load(name) {
    if (modules[name]) return modules[name];
    const mod = {exports: {}};
    new Function('require', 'module', 'exports', fs.readFileSync(path.join(__dirname, '../lib', `${name}.js`), 'utf8'))(
      dependency => {
        if (dependency in mocks) return mocks[dependency];
        if (dependency === './stripeWebhook' || dependency === './scheduledTasks') return load(dependency.slice(2));
        return require(dependency);
      }, mod, mod.exports,
    );
    modules[name] = mod.exports;
    return mod.exports;
  }
  return load('index');
}

const functions = loadExports();
function endpoint(name, secrets = ['RESEND_API_KEY']) {
  assert.equal(typeof functions[name], 'function');
  const options = functions[name].__endpoint;
  assert.equal(options.platform, 'gcfv2');
  assert.deepEqual(options.secretEnvironmentVariables.map(secret => secret.key), secrets);
  return options;
}

test('acceptInvitation binds Resend as a v2 callable', () => {
  assert.ok(endpoint('acceptInvitation').callableTrigger);
});

for (const [name, document, event] of [
  ['sendInvitationEmail', 'invitations/{inviteId}', 'written'],
  ['onUserCreated', 'users/{userId}', 'created'],
]) {
  test(`${name} binds Resend and preserves its Firestore event path`, () => {
    const trigger = endpoint(name).eventTrigger;
    assert.equal(trigger.eventFilterPathPatterns.document, document);
    assert.equal(trigger.eventType, `google.cloud.firestore.document.v1.${event}`);
    assert.equal(trigger.retry, false);
    assert.equal(typeof functions[name].run, 'function');
  });
}

for (const [name, schedule] of [
  ['weeklyActivityDigest', '0 9 * * 1'],
  ['inactivityReminder', '0 10 * * *'],
  ['planExpirationReminder', '0 11 * * *'],
]) {
  test(`${name} binds Resend and preserves its schedule, timezone and retries`, () => {
    const trigger = endpoint(name).scheduleTrigger;
    assert.equal(trigger.schedule, schedule);
    assert.equal(trigger.timeZone, 'UTC');
    assert.equal(trigger.retryConfig.retryCount, 3);
    assert.equal(typeof functions[name].run, 'function');
  });
}

test('stripeWebhook adds Resend while preserving both Stripe bindings and region', () => {
  const options = endpoint('stripeWebhook', ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'RESEND_API_KEY']);
  assert.deepEqual(options.region, ['us-central1']);
  assert.ok(options.httpsTrigger);
});

test('non-email invitation creation and tree triggers do not receive the Resend secret', () => {
  for (const name of ['createInvitation', 'setTreeOwnerClaim', 'updateTreeMemberCount']) {
    const secrets = functions[name].__endpoint.secretEnvironmentVariables || [];
    assert.equal(secrets.some(secret => secret.key === 'RESEND_API_KEY'), false);
  }
});
