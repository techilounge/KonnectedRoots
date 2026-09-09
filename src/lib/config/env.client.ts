/** Public build-time configuration. Explicit reads are required for Next.js inlining. */
export const clientEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://konnectedroots.app',
  googleSiteVerification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  },
  stripePrices: {
    pro_monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY || '',
    pro_yearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY || '',
    family_monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_FAMILY_MONTHLY || '',
    family_yearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_FAMILY_YEARLY || '',
    ai_pack_monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_AI_PACK || '',
  },
} as const;

export function firebaseBrowserOptions() {
  // SSR never authenticates with this app. Placeholders permit static rendering,
  // but a real browser must have explicit public project configuration.
  if (typeof window !== 'undefined') {
    const required = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'appId'] as const;
    const missing = required.filter(key => !clientEnv.firebase[key]);
    if (missing.length) throw new Error(`Missing public Firebase configuration: ${missing.join(', ')}`);
  }
  return {
    apiKey: clientEnv.firebase.apiKey || 'mock_key_for_build',
    authDomain: clientEnv.firebase.authDomain || 'mock.firebaseapp.com',
    projectId: clientEnv.firebase.projectId || 'mock-project-id',
    storageBucket: clientEnv.firebase.storageBucket || 'mock.appspot.com',
    messagingSenderId: clientEnv.firebase.messagingSenderId || '123456789',
    appId: clientEnv.firebase.appId || '1:123456789:web:abcdef',
  };
}
