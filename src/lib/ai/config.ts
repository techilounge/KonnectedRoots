import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { defaults } from './registry';
import { providerIds, type Control, type ProviderConfig } from './types';
import { fingerprint } from './secrets';
export async function loadControl(): Promise<Control> {
  const doc = await adminDb.collection('ai_configuration').doc('control').get();
  return doc.exists ? doc.data() as Control : structuredClone(defaults);
}
export async function loadProviders(): Promise<ProviderConfig[]> {
  const docs = await adminDb.collection('ai_providers').get();
  return providerIds.map(providerId => {
    const saved = docs.docs.find(d => d.id === providerId);
    if (saved) return saved.data() as ProviderConfig;
    const legacy = providerId === 'google' ? process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY : undefined;
    return { providerId, enabled: true, credentialConfigured: Boolean(legacy), credentialFingerprint: legacy ? fingerprint(legacy) : null,
      secretVersion: null, credentialSource: legacy ? 'environment' : 'none', status: 'untested', lastTestedAt: null, lastSuccessfulTest: null };
  });
}
