const fs = require('node:fs');
const path = require('node:path');
function loadInvitations(database, auth, firestore = require('firebase-admin/firestore')) {
  class HttpsError extends Error {constructor(code, message) {super(message); this.code = code;}}
  const mocks = {
    './config': {functionsEnv: {appUrl: 'http://127.0.0.1:9002'}},
    'firebase-admin': {initializeApp() {}, firestore: () => database, auth: () => auth},
    'firebase-functions/logger': {info() {}, warn() {}, error() {}},
    'firebase-functions/v2/firestore': {onDocumentCreated: (...a) => a.at(-1), onDocumentWritten: (...a) => a.at(-1)},
    'firebase-functions/v2/https': {onCall: (...a) => a.at(-1), HttpsError},
    'firebase-admin/firestore': firestore,
    './collaborationPolicy': require('../../lib/collaborationPolicy'),
    './sendEmail': {sendEmail: async () => ({success: true, delivery: 'suppressed'})},
    './emailTemplates': {welcomeEmail: () => ({subject: 'Synthetic', html: 'Synthetic'}), invitationAcceptedEmail: () => ({subject: 'Synthetic', html: 'Synthetic'}), treeInviteEmail: () => ({subject: 'Synthetic', html: 'Synthetic'})},
    './stripeWebhook': {}, './stripeBilling': {}, './familyDowngrade': {}, './scheduledTasks': {}, './storageAuthority': {},
  };
  const mod = {exports: {}};
  new Function('require', 'module', 'exports', fs.readFileSync(path.join(__dirname, '../../lib/index.js'), 'utf8'))(name => {
    if (!(name in mocks)) throw Error(`Unexpected import ${name}`); return mocks[name];
  }, mod, mod.exports);
  return mod.exports;
}
module.exports = {loadInvitations};
