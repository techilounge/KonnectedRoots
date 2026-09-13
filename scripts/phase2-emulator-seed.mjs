import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'demo-konnectedroots-phase2';
const TEST_EMAIL = 'phase2-billing@example.test';
const TEST_PASSWORD = 'LocalPhase2!2026-Test';
const DISPLAY_NAME = 'Phase 2 Billing Test';

function assertLocalEmulators() {
  const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (projectId !== PROJECT_ID ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' ||
      process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') {
    throw new Error(`Refusing to seed: set the exact local emulator hosts and GCLOUD_PROJECT=${PROJECT_ID}.`);
  }
}

assertLocalEmulators();
const app = getApps().find(candidate => candidate.name === 'phase2-billing-seed') ||
  initializeApp({projectId: PROJECT_ID}, 'phase2-billing-seed');
const auth = getAuth(app);
const db = getFirestore(app);

let account;
try {
  account = await auth.getUserByEmail(TEST_EMAIL);
  account = await auth.updateUser(account.uid, {
    displayName: DISPLAY_NAME,
    password: TEST_PASSWORD,
    emailVerified: true,
    disabled: false,
  });
} catch (error) {
  if (error?.code !== 'auth/user-not-found') throw error;
  account = await auth.createUser({
    email: TEST_EMAIL,
    displayName: DISPLAY_NAME,
    password: TEST_PASSWORD,
    emailVerified: true,
  });
}

const now = Date.now();
await db.collection('users').doc(account.uid).set({
  uid: account.uid,
  email: TEST_EMAIL,
  displayName: DISPLAY_NAME,
  photoURL: null,
  createdAt: now,
  updatedAt: now,
  billing: {
    plan: 'free',
    status: 'none',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodEnd: 0,
    cancelAtPeriodEnd: false,
    scheduledCancellationAt: null,
    aiPackItemExists: false,
    aiPackStatus: 'none',
    aiPackPaidThrough: null,
    aiPackOperationId: null,
    aiPackRequestedAt: null,
    aiPackCancelAtPeriodEnd: false,
    aiPackScheduledRemovalAt: null,
    aiPackRemovalOperationId: null,
    aiPackRemovalRequestedAt: null,
    aiPackResumeOperationId: null,
    aiPackResumeRequestedAt: null,
    priceId: null,
    interval: null,
    addons: {aiPack: false},
    latestStripeEventCreated: 0,
    updatedAt: now,
  },
  family: {familyId: null, role: null, joinedAt: null},
  usage: {
    monthKey: '',
    exportsUsed: 0,
    aiActionsUsed: 0,
    aiActionsAllowance: 10,
    storageUsedBytes: 0,
  },
});

console.log(JSON.stringify({
  uid: account.uid,
  email: TEST_EMAIL,
  plan: 'free',
  status: 'none',
}, null, 2));
