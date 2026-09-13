import * as admin from 'firebase-admin';
import type { DocumentData, DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

// A storage-only projection, not a new commercial authority or byte ledger.
// Storage rules have room for tree + user, but not tree + user + Family.
function bytes(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function paidEnd(billing: DocumentData): number {
  const end = bytes(billing.currentPeriodEnd);
  const cancellation = bytes(billing.scheduledCancellationAt);
  return cancellation > 0 ? Math.min(end, cancellation) : end;
}

export function deriveStorageAuthority(
  user: DocumentData,
  family: DocumentData = {},
  owner: DocumentData = {},
  now = Date.now(),
) {
  const familyId = typeof user.family?.familyId === 'string' && user.family.familyId ? user.family.familyId : null;
  const plan = family.plan || {};
  const billing = owner.billing || {};
  const matching = familyId !== null && typeof family.ownerUid === 'string' &&
    plan.plan === 'family' && billing.plan === 'family' &&
    typeof plan.stripeCustomerId === 'string' && plan.stripeCustomerId.length > 0 &&
    typeof plan.stripeSubscriptionId === 'string' && plan.stripeSubscriptionId.length > 0 &&
    plan.stripeCustomerId === billing.stripeCustomerId && plan.stripeSubscriptionId === billing.stripeSubscriptionId;
  const paidUntil = matching ? Math.min(paidEnd(plan), paidEnd(billing)) : 0;
  const active = matching && ['active', 'trialing'].includes(plan.status) &&
    ['active', 'trialing'].includes(billing.status) && paidUntil > now;
  return {
    familyId,
    ownerUid: familyId && typeof family.ownerUid === 'string' ? family.ownerUid : null,
    plan: matching ? 'family' : 'free',
    status: active ? 'active' : 'none',
    paidUntil,
    stripeCustomerId: matching ? plan.stripeCustomerId : null,
    stripeSubscriptionId: matching ? plan.stripeSubscriptionId : null,
    // Preserve a conservative known pool floor, including after unlink/downgrade.
    // Exact decreases require the future trusted object reconciliation service.
    storageUsedBytes: Math.max(bytes(user.usage?.storageUsedBytes), bytes(user.storageAuthority?.storageUsedBytes),
      familyId ? bytes(family.usage?.storageUsedBytes) : 0),
  };
}

type StorageWrite = { ref: DocumentReference; authority: ReturnType<typeof deriveStorageAuthority> };

function sameAuthority(previous: unknown, next: ReturnType<typeof deriveStorageAuthority>): boolean {
  if (!previous || typeof previous !== 'object' || Array.isArray(previous)) return false;
  const fields = previous as Record<string, unknown>;
  return Object.keys(fields).length === Object.keys(next).length &&
    Object.entries(next).every(([key, value]) => fields[key] === value);
}

export function applyStorageWrites(transaction: Transaction, writes: StorageWrite[]): void {
  for (const write of writes) transaction.update(write.ref, { storageAuthority: write.authority });
}

// Collect every read before callers begin their billing writes. The incoming
// owner/Family overrides are the same authoritative state that the transaction
// will commit, so revocation is not left to an asynchronous trigger.
export async function familyStorageWrites(
  transaction: Transaction,
  database: Firestore,
  familyId: string,
  family: DocumentData,
  owner: DocumentData,
  now = Date.now(),
): Promise<StorageWrite[]> {
  const members = await transaction.get(database.collection('users').where('family.familyId', '==', familyId).limit(450));
  if (members.size >= 450) throw new Error('Family storage projection exceeds transaction capacity.');
  const writes: StorageWrite[] = [];
  for (const member of members.docs) {
    const data = member.id === family.ownerUid ? { ...member.data(), ...owner } : member.data();
    const authority = deriveStorageAuthority(data, family, owner, now);
    if (!sameAuthority(member.data().storageAuthority, authority)) writes.push({ ref: member.ref, authority });
  }
  return writes;
}

export async function syncUserStorageAuthority(uid: string, database: Firestore = admin.firestore()): Promise<void> {
  const ref = database.collection('users').doc(uid);
  await database.runTransaction(async transaction => {
    const userSnap = await transaction.get(ref);
    if (!userSnap.exists) return;
    const user = userSnap.data() || {};
    const familyId = user.family?.familyId;
    const family = typeof familyId === 'string' && familyId
      ? (await transaction.get(database.collection('families').doc(familyId))).data() || {} : {};
    const owner = family.ownerUid === uid ? user : typeof family.ownerUid === 'string' && family.ownerUid
      ? (await transaction.get(database.collection('users').doc(family.ownerUid))).data() || {} : {};
    if (family.ownerUid === uid) {
      applyStorageWrites(transaction, await familyStorageWrites(transaction, database, familyId, family, user));
      return;
    }
    const authority = deriveStorageAuthority(user, family, owner);
    if (!sameAuthority(user.storageAuthority, authority)) transaction.update(ref, { storageAuthority: authority });
  });
}

export const onStorageUserWritten = onDocumentWritten({ document: 'users/{uid}', retry: true }, async event => {
  await syncUserStorageAuthority(event.params.uid);
});

export const onStorageFamilyWritten = onDocumentWritten({ document: 'families/{familyId}', retry: true }, async event => {
  const database = admin.firestore();
  await database.runTransaction(async transaction => {
    const family = (await transaction.get(database.collection('families').doc(event.params.familyId))).data() || {};
    const owner = typeof family.ownerUid === 'string' && family.ownerUid
      ? (await transaction.get(database.collection('users').doc(family.ownerUid))).data() || {} : {};
    applyStorageWrites(transaction, await familyStorageWrites(transaction, database, event.params.familyId, family, owner));
  });
});

// Lazy initialization for existing accounts, including linked non-owner tree
// owners. Caller selects a tree, never a UID, plan, quota or usage value.
export const prepareStorageUpload = onCall(async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required.');
  const data = request.data;
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
    Object.keys(data).some(key => key !== 'treeId')) throw new HttpsError('invalid-argument', 'Invalid upload selection.');
  let uid = request.auth.uid;
  if ('treeId' in data) {
    if (typeof data.treeId !== 'string' || !data.treeId || data.treeId.includes('/')) throw new HttpsError('invalid-argument', 'Invalid tree selection.');
    const tree = (await admin.firestore().collection('trees').doc(data.treeId).get()).data();
    if (!tree || !(tree.ownerId === uid || ['editor', 'manager'].includes(tree.collaborators?.[uid]))) {
      throw new HttpsError('permission-denied', 'Tree editing permission required.');
    }
    uid = tree.ownerId;
  }
  await syncUserStorageAuthority(uid);
  return { prepared: true };
});
