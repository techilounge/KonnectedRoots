const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {FieldValue} = require('firebase-admin/firestore');

test('installed Firebase Admin modular FieldValue creates a server timestamp sentinel', () => {
  const timestamp = FieldValue.serverTimestamp();
  assert.ok(timestamp);
  assert.equal(typeof timestamp.isEqual, 'function');
});

function loadIndex(emailResult) {
  const logs = [];
  const updates = [];
  let timestampCalls = 0;
  const emptyQuery = {
    where() { return this; },
    async get() { return {empty: true}; },
  };
  const db = {
    collection(name) {
      if (name === 'invitations') return emptyQuery;
      return {doc: () => ({})};
    },
  };
  class HttpsError extends Error {}
  const mocks = {
    './config': {functionsEnv: {appUrl: 'http://127.0.0.1:9002'}},
    'firebase-functions/logger': {
      info: (...args) => logs.push(['info', ...args]),
      warn: (...args) => logs.push(['warn', ...args]),
      error: (...args) => logs.push(['error', ...args]),
    },
    'firebase-functions/v2/firestore': {
      onDocumentWritten: (...args) => args.at(-1),
      onDocumentCreated: (...args) => args.at(-1),
    },
    'firebase-functions/v2/https': {
      onCall: (...args) => args.at(-1),
      HttpsError,
    },
    'firebase-admin': {
      initializeApp() {},
      firestore: () => db,
    },
    'firebase-admin/firestore': {
      FieldValue: {
        serverTimestamp() {
          timestampCalls++;
          return 'server-timestamp-fixture';
        },
      },
    },
    './sendEmail': {sendEmail: async () => emailResult},
    './emailTemplates': {
      welcomeEmail: () => ({subject: 'Synthetic welcome', html: 'Synthetic body'}),
      invitationAcceptedEmail: () => ({subject: 'Synthetic', html: 'Synthetic'}),
      treeInviteEmail: () => ({subject: 'Synthetic', html: 'Synthetic'}),
    },
    './collaborationPolicy': {validateCollaboratorAdd: () => ({allowed: true})},
    './stripeWebhook': {stripeWebhook: {}},
    './stripeBilling': {createCheckoutSession: {}, createPortalSession: {}, upgradeToFamily: {}, addAIPack: {}, removeAIPack: {}, resumeAIPack: {}},
    './familyDowngrade': {scheduleDowngradeToPro: {}, cancelScheduledDowngrade: {}, reconcileScheduledBilling: {}},
    './scheduledTasks': {weeklyActivityDigest: {}, inactivityReminder: {}, planExpirationReminder: {}},
    './storageAuthority': {},
  };
  const mod = {exports: {}};
  new Function('require', 'module', 'exports', fs.readFileSync(path.join(__dirname, '../lib/index.js'), 'utf8'))(
    name => {if (!(name in mocks)) throw Error(`Unexpected import: ${name}`); return mocks[name];}, mod, mod.exports);
  const event = {
    data: {
      data: () => ({email: 'phase2-billing@example.test', displayName: 'Phase 2 Billing Test'}),
      ref: {update: async fields => updates.push(fields)},
    },
    params: {userId: 'phase2-user'},
  };
  return {handler: mod.exports.onUserCreated, event, logs, updates, timestampCalls: () => timestampCalls};
}

test('onUserCreated uses modular FieldValue.serverTimestamp for a delivered welcome email', async () => {
  const fixture = loadIndex({success: true, delivery: 'sent', emailId: 'email_fixture'});
  await fixture.handler(fixture.event);
  assert.equal(fixture.timestampCalls(), 1);
  assert.deepEqual(fixture.updates, [{
    welcomeEmailSent: true,
    welcomeEmailSentAt: 'server-timestamp-fixture',
  }]);
  assert.equal(fixture.logs.some(entry => String(entry[1]).startsWith('Welcome email sent to ')), true);
});

test('onUserCreated completes locally without claiming a suppressed email was sent', async () => {
  const fixture = loadIndex({success: true, delivery: 'suppressed'});
  await fixture.handler(fixture.event);
  assert.equal(fixture.timestampCalls(), 0);
  assert.deepEqual(fixture.updates, []);
  assert.equal(fixture.logs.some(entry => String(entry[1]).includes('email sent')), false);
  assert.equal(JSON.stringify(fixture.logs).includes('phase2-billing@example.test'), false);
});
