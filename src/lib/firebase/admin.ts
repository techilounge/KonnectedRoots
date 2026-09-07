import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

// Default service account credentials encoded as base64 for seamless cloud deployments (Vercel / AWS)
const FALLBACK_SA_B64 = 'REMOVED_REVOKED_FIREBASE_ADMIN_CREDENTIAL';

function initializeFirebaseAdmin(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'konnectedroots-u5xtb';
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'konnectedroots-u5xtb.firebasestorage.app';

  // 1. Check for explicit JSON or base64 string in environment variable
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      const content = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
      const parsed = JSON.parse(content);
      return admin.initializeApp({
        credential: admin.credential.cert(parsed),
        projectId: parsed.project_id || projectId,
        storageBucket,
      });
    } catch (e) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:', e);
    }
  }

  // 2. Check for service-account.json in project root (local dev)
  const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    try {
      const fileContent = fs.readFileSync(serviceAccountPath, 'utf8');
      const serviceAccount = JSON.parse(fileContent);
      return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || projectId,
        storageBucket,
      });
    } catch (e) {
      console.error('Failed to load service-account.json:', e);
    }
  }

  // 3. Use embedded fallback service account credential for cloud deployment
  try {
    const decoded = Buffer.from(FALLBACK_SA_B64, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);
    return admin.initializeApp({
      credential: admin.credential.cert(parsed),
      projectId: parsed.project_id || projectId,
      storageBucket,
    });
  } catch (e) {
    console.warn('Failed to load fallback service account credential:', e);
  }

  // 4. Fall back to application default credentials (GCP / Cloud Run)
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
