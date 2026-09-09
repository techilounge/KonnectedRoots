import 'server-only';
import { serverEnv } from '@/lib/config/env.server';

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

function parseCredential(value: string, source: string) {
  try {
    const raw = value.trim();
    let content = raw;
    if (!raw.startsWith('{')) {
      // Buffer decoding alone tolerates invalid characters and truncated input.
      if (!raw || !/^[A-Za-z0-9+/]+={0,2}$/.test(raw) || raw.length % 4 === 1) {
        throw new Error();
      }
      const decoded = Buffer.from(raw, 'base64');
      if (decoded.toString('base64').replace(/=+$/, '') !== raw.replace(/=+$/, '')) {
        throw new Error();
      }
      content = decoded.toString('utf8');
    }
    const account = JSON.parse(content);
    if (!account || account.type !== 'service_account' ||
        !['project_id', 'client_email', 'private_key'].every(
          field => typeof account[field] === 'string' && account[field].trim().length > 0
        )) {
      throw new Error();
    }
    return {
      credential: admin.credential.cert(account),
      projectId: account.project_id as string,
    };
  } catch {
    // Never include parser/SDK errors: they can contain credential input.
    throw new Error(`Invalid Firebase Admin credentials in ${source}. Expected valid service-account JSON (raw or Base64-encoded) with project_id, client_email, and a valid private key.`);
  }
}

function initializeFirebaseAdmin(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const projectId = serverEnv.firebaseProjectId;
  const storageBucket = serverEnv.firebaseStorageBucket;

  if (serverEnv.firebaseServiceAccount !== undefined) {
    return admin.initializeApp({
      ...parseCredential(serverEnv.firebaseServiceAccount, 'FIREBASE_SERVICE_ACCOUNT'),
      storageBucket,
    });
  }

  const isVercel = serverEnv.isVercel;
  if (isVercel) {
    throw new Error('Firebase Admin requires the server-only FIREBASE_SERVICE_ACCOUNT environment variable on Vercel. Local files and implicit Application Default Credentials are disabled.');
  }

  const isLocalDevelopment = serverEnv.isLocalDevelopment;
  if (isLocalDevelopment) {
    const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
      let content: string;
      try {
        content = fs.readFileSync(serviceAccountPath, 'utf8');
      } catch {
        throw new Error('Unable to read local Firebase Admin service-account.json.');
      }
      return admin.initializeApp({
        ...parseCredential(content, 'local service-account.json'),
        storageBucket,
      });
    }
  }

  // ADC is appropriate for local gcloud credentials, explicitly configured
  // credentials/workload identity, or Google-hosted attached service identities.
  const hasAdcEnvironment = serverEnv.hasAdcEnvironment;
  if (!isLocalDevelopment && !hasAdcEnvironment) {
    throw new Error('Firebase Admin credentials are missing. Set server-only FIREBASE_SERVICE_ACCOUNT or configure Application Default Credentials through workload identity (GOOGLE_APPLICATION_CREDENTIALS) or a Google-hosted service identity.');
  }
  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
    storageBucket,
  });
}

export const adminApp = initializeFirebaseAdmin();
export const adminAuth = admin.auth(adminApp);
export const adminDb = admin.firestore(adminApp);
export const getAdminDb = () => adminDb;
export const getAdminAuth = () => adminAuth;
