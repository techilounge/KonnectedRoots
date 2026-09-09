import 'server-only';
import { serverEnv } from '@/lib/config/env.server';

import { createHash } from 'node:crypto';
import { adminApp } from '@/lib/firebase/admin';
import { AIError, type ProviderConfig, type ProviderId } from './types';

export const fingerprint = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 12);
function secretName(provider: ProviderId) {
  const project = serverEnv.aiSecretProjectId;
  if (!project || !/^[a-zA-Z0-9-]+$/.test(project)) throw new AIError('secret_project_missing');
  return `projects/${project}/secrets/konnectedroots-ai-${provider}`;
}
async function vault(path: string, method = 'GET', body?: unknown) {
  try {
    const token = await adminApp.options.credential!.getAccessToken();
    const response = await fetch(`https://secretmanager.googleapis.com/v1/${path}`, {
      method, headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new AIError('secret_store_unavailable');
    return await response.json();
  } catch { throw new AIError('secret_store_unavailable'); }
}
export async function addSecretVersion(provider: ProviderId, key: string): Promise<string> {
  // Secret containers are provisioned manually; runtime cannot create arbitrary secrets.
  const result = await vault(`${secretName(provider)}:addVersion`, 'POST', { payload: { data: Buffer.from(key).toString('base64') } });
  return result.name;
}
export async function destroySecretVersion(provider: ProviderId, version: string) {
  await vault(`${await verifiedVersion(provider, version)}:destroy`, 'POST', {});
}
async function verifiedVersion(provider: ProviderId, version: string): Promise<string> {
  const match = /^projects\/([a-zA-Z0-9-]+)\/secrets\/([^/]+)\/versions\/([0-9]+)$/.exec(version);
  if (!match || match[2] !== `konnectedroots-ai-${provider}`) throw new AIError('secret_reference_invalid');
  const expected = `${secretName(provider)}/versions/${match[3]}`;
  if (version === expected) return expected;
  // Google canonicalizes project IDs to numbers. Verify the alias against
  // metadata in the configured project before reading or destroying a payload.
  if (!/^\d+$/.test(match[1])) throw new AIError('secret_reference_invalid');
  const metadata = await vault(expected);
  if (metadata.name !== version) throw new AIError('secret_reference_invalid');
  return expected;
}
export async function providerSecret(config: ProviderConfig): Promise<string> {
  if (!config.credentialConfigured) throw new AIError('credential_missing');
  if (config.credentialSource === 'environment' && config.providerId === 'google') {
    const key = serverEnv.legacyGoogleKey;
    if (key) return key;
  }
  if (config.credentialSource !== 'vault' || !config.secretVersion) throw new AIError('credential_missing');
  const result = await vault(`${await verifiedVersion(config.providerId, config.secretVersion)}:access`);
  if (!result.payload?.data) throw new AIError('credential_missing');
  return Buffer.from(result.payload.data, 'base64').toString('utf8');
}
