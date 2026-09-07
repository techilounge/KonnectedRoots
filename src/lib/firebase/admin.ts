import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

function initializeFirebaseAdmin(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'konnectedroots-u5xtb';
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'konnectedroots-u5xtb.firebasestorage.app';

  // 1. Check for explicit JSON string in environment variable
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      return admin.initializeApp({
        credential: admin.credential.cert(parsed),
        projectId,
        storageBucket,
      });
    } catch (e) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:', e);
    }
  }

  // 2. Check for service-account.json in project root
  const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    try {
      const fileContent = fs.readFileSync(serviceAccountPath, 'utf8');
      const serviceAccount = JSON.parse(fileContent);
      return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
        storageBucket,
      });
    } catch (e) {
      console.error('Failed to load service-account.json:', e);
    }
  }

  // 3. Fall back to application default credentials (GCP / Cloud Run)
  return admin.initializeApp({
    projectId,
    storageBucket,
  });
}

export const adminApp = initializeFirebaseAdmin();
export const adminAuth = admin.auth(adminApp);
export const adminDb = admin.firestore(adminApp);
export const getAdminDb = () => adminDb;
export const getAdminAuth = () => adminAuth;

