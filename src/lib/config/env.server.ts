import 'server-only';

/** Lazy reads keep build-time imports independent of private runtime credentials. */
export const serverEnv = {
  get firebaseServiceAccount() { return process.env.FIREBASE_SERVICE_ACCOUNT; },
  get firebaseProjectId() { return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID; },
  get firebaseStorageBucket() { return process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET; },
  get isVercel() { return process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV); },
  get isLocalDevelopment() { return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'; },
  get hasAdcEnvironment() { return Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.K_SERVICE || process.env.FUNCTION_NAME || process.env.GAE_ENV); },
  get aiSecretProjectId() { return process.env.AI_SECRET_PROJECT_ID; },
  get legacyGoogleKey() { return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY; },
  get customAiOrigins() { return (process.env.AI_CUSTOM_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean); },
};
