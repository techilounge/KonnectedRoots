export const LOCAL_FIREBASE_PROJECT_ID = 'demo-konnectedroots-phase2';
export const LOCAL_FIREBASE_STORAGE_BUCKET = `${LOCAL_FIREBASE_PROJECT_ID}.appspot.com`;
export const LOCAL_FIREBASE_EMULATOR_HOST = '127.0.0.1';
export const LOCAL_FIREBASE_AUTH_EMULATOR_HOST = `${LOCAL_FIREBASE_EMULATOR_HOST}:9099`;
export const LOCAL_FIRESTORE_EMULATOR_HOST = `${LOCAL_FIREBASE_EMULATOR_HOST}:8080`;

type Environment = Record<string, string | undefined>;

/**
 * Resolve the credential-free Admin SDK configuration for the dedicated local
 * billing harness. An explicit but unsafe configuration fails closed instead
 * of falling through to production credentials or ADC.
 */
export function localAdminEmulatorOptions(env: Environment): {
  projectId: string;
  storageBucket: string;
} | null {
  if (env.USE_FIREBASE_EMULATORS !== 'true') return null;

  if (env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test') {
    throw new Error('Firebase emulator mode is restricted to development and test.');
  }
  if (env.FIREBASE_AUTH_EMULATOR_HOST !== LOCAL_FIREBASE_AUTH_EMULATOR_HOST ||
      env.FIRESTORE_EMULATOR_HOST !== LOCAL_FIRESTORE_EMULATOR_HOST) {
    throw new Error('Firebase emulator mode requires the fixed local Auth and Firestore emulator hosts.');
  }

  const configuredProject = env.GCLOUD_PROJECT || env.GOOGLE_CLOUD_PROJECT || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (configuredProject && configuredProject !== LOCAL_FIREBASE_PROJECT_ID) {
    throw new Error(`Firebase emulator mode requires project ${LOCAL_FIREBASE_PROJECT_ID}.`);
  }

  return {
    projectId: LOCAL_FIREBASE_PROJECT_ID,
    storageBucket: LOCAL_FIREBASE_STORAGE_BUCKET,
  };
}
