'use server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { AIError, budgetSchema, features, modelSchema, providerIds, routeSchema, targetSchema, type Control, type Feature, type ProviderId } from '@/lib/ai/types';
import { adapterCapabilities, compatible, modelKey } from '@/lib/ai/registry';
import { loadControl, loadProviders } from '@/lib/ai/config';
import { addSecretVersion, destroySecretVersion, fingerprint } from '@/lib/ai/secrets';
import { getProvider, validateCustomUrl } from '@/lib/ai/providers';
import { audit, readUsage } from '@/lib/ai/telemetry';
import { generate, withPlayground } from '@/lib/ai/gateway';

async function caller(token: string, superOnly = false) {
  let user;
  try { user = await adminAuth.verifyIdToken(token, true); } catch { throw new Error('Authentication required.'); }
  // Credential control relies on verified Auth claims, never client-writable profile flags.
  if (superOnly ? user.role !== 'super_admin' : !(user.admin === true || ['admin', 'super_admin'].includes(user.role))) throw new Error('Insufficient administrator role.');
  return user;
}
export async function getAIConfiguration(token: string) {
  const user = await caller(token);
  const [control, providers, usage, health] = await Promise.all([loadControl(), loadProviders(), readUsage(), adminDb.collection('ai_model_health').get()]);
  return { control, providers: providers.map(p => ({ providerId: p.providerId, enabled: p.enabled,
    credentialConfigured: p.credentialConfigured, credentialFingerprint: p.credentialFingerprint, credentialSource: p.credentialSource,
    secretVersion: null, status: p.status, lastTestedAt: p.lastTestedAt, lastSuccessfulTest: p.lastSuccessfulTest, ...(p.baseUrl ? { baseUrl: p.baseUrl } : {}) })), usage,
    health: health.docs.map(d => ({ providerId: d.data().providerId as string, modelId: d.data().modelId as string, failures: Number(d.data().failures || 0), unavailableUntil: Number(d.data().unavailableUntil || 0) })),
    isSuperAdmin: user.role === 'super_admin' };
}
export async function saveAIControl(token: string, input: unknown) {
  const user = await caller(token);
  const parsed = z.object({ models: z.array(modelSchema).min(1).max(1000), routes: z.record(z.enum(features), routeSchema), budgets: budgetSchema }).strict().parse(input);
  const control = parsed as Control;
  if (new Set(control.models.map(modelKey)).size !== control.models.length) throw new Error('Duplicate models.');
  for (const model of control.models) if (model.capabilities.some(c => !adapterCapabilities[model.providerId].includes(c))) throw new Error('The adapter does not support these capabilities.');
  for (const feature of features) {
    const route = control.routes[feature];
    if (!route) throw new Error('Every feature needs a routing policy.');
    for (const target of [route.primary, ...route.fallbacks]) {
      const model = control.models.find(m => modelKey(m) === modelKey(target));
      if (!model || !compatible(feature, model) || (route.enabled && !model.enabled)) throw new Error(`Incompatible or disabled model for ${feature}.`);
      if (route.privacy === 'direct_providers_only' && ['openrouter', 'custom'].includes(model.providerId)) throw new Error('Privacy policy disallows this provider.');
    }
  }
  const batch = adminDb.batch();
  batch.set(adminDb.collection('ai_configuration').doc('control'), control);
  batch.create(adminDb.collection('audit_logs').doc(), { timestamp: FieldValue.serverTimestamp(), adminUid: user.uid, action: 'AI_CONTROL_UPDATED', category: 'configuration', details: 'Updated AI catalog, routing and budgets.' });
  await batch.commit();
}
export async function saveProvider(token: string, input: unknown) {
  const user = await caller(token);
  const data = z.object({ providerId: z.enum(providerIds), enabled: z.boolean(), baseUrl: z.string().max(300).optional() }).strict().parse(input);
  if (data.baseUrl !== undefined) {
    await caller(token, true);
    if (data.providerId !== 'custom') throw new Error('Only custom providers accept a base URL.');
    data.baseUrl = validateCustomUrl(data.baseUrl);
  }
  const previous = (await loadProviders()).find(p => p.providerId === data.providerId)!;
  const ref = adminDb.collection('ai_providers').doc(data.providerId);
  await adminDb.runTransaction(async tx => {
    const doc = await tx.get(ref);
    if ((doc.data()?.lockUntil || 0) > Date.now()) throw new Error('A credential change is in progress.');
    tx.set(ref, doc.exists ? data : { ...previous, ...data }, { merge: true });
    tx.create(adminDb.collection('audit_logs').doc(), { timestamp: FieldValue.serverTimestamp(), adminUid: user.uid, action: 'AI_PROVIDER_UPDATED', category: 'configuration', details: data.providerId });
  });
}
export async function mutateCredential(token: string, input: unknown) {
  const user = await caller(token, true);
  // Do not let validation errors echo the submitted key.
  const parsed = z.object({ providerId: z.enum(providerIds), operation: z.enum(['save', 'remove']), key: z.string().trim().min(8).max(8192).optional() }).strict().safeParse(input);
  if (!parsed.success || (parsed.data.operation === 'save' && !parsed.data.key)) throw new Error('Invalid credential input.');
  const { providerId, operation, key } = parsed.data;
  const previous = (await loadProviders()).find(p => p.providerId === providerId)!;
  const ref = adminDb.collection('ai_providers').doc(providerId);
  const lock = randomUUID();
  await adminDb.runTransaction(async tx => {
    const doc = await tx.get(ref);
    if ((doc.data()?.lockUntil || 0) > Date.now()) throw new Error('A credential change is already in progress.');
    if ((doc.data()?.secretVersion || null) !== previous.secretVersion) throw new Error('Provider changed; reload and retry.');
    tx.set(ref, { ...previous, lock, lockUntil: Date.now() + 120000 }, { merge: true });
    tx.create(adminDb.collection('audit_logs').doc(), { timestamp: FieldValue.serverTimestamp(), adminUid: user.uid, action: `AI_CREDENTIAL_${operation.toUpperCase()}_REQUESTED`, category: 'security', details: providerId });
  });
  let version: string | null = null;
  try {
    if (operation === 'save') version = await addSecretVersion(providerId, key!);
    await adminDb.runTransaction(async tx => {
      const doc = await tx.get(ref);
      if (doc.data()?.lock !== lock) throw new Error('Credential lock expired.');
      tx.update(ref, { credentialConfigured: operation === 'save', credentialFingerprint: key ? fingerprint(key) : null,
        secretVersion: version, credentialSource: operation === 'save' ? 'vault' : 'none', status: 'untested',
        lastTestedAt: null, lastSuccessfulTest: null, lock: FieldValue.delete(), lockUntil: FieldValue.delete() });
      tx.create(adminDb.collection('audit_logs').doc(), { timestamp: FieldValue.serverTimestamp(), adminUid: user.uid, action: `AI_CREDENTIAL_${operation.toUpperCase()}_COMPLETED`, category: 'security', details: providerId });
    });
  } catch {
    if (version) { try { await destroySecretVersion(providerId, version); } catch { await audit('AI_SECRET_CLEANUP_REQUIRED', user.uid, providerId, 'Unused version requires manual cleanup.'); } }
    await adminDb.runTransaction(async tx => { const doc = await tx.get(ref); if (doc.data()?.lock === lock) tx.update(ref, { lock: FieldValue.delete(), lockUntil: FieldValue.delete() }); });
    await audit('AI_CREDENTIAL_CHANGE_FAILED', user.uid, providerId, 'Credential mutation failed; no credential contents recorded.');
    throw new Error('Credential update failed. Check Secret Manager setup and IAM.');
  }
  if (previous.secretVersion) {
    try { await destroySecretVersion(providerId, previous.secretVersion); }
    catch { await audit('AI_SECRET_CLEANUP_REQUIRED', user.uid, providerId, 'Previous credential version requires manual destruction.'); return { cleanupRequired: true }; }
  }
  return { cleanupRequired: previous.credentialSource === 'environment' };
}
export async function testProvider(token: string, id: ProviderId) {
  const user = await caller(token); const providerId = z.enum(providerIds).parse(id);
  const config = (await loadProviders()).find(p => p.providerId === providerId)!;
  let status = 'connected';
  try { await (await getProvider(config)).testConnection(); } catch (error) { status = error instanceof AIError ? error.code : 'connection_failed'; }
  const now = new Date().toISOString();
  const ref = adminDb.collection('ai_providers').doc(providerId);
  await adminDb.runTransaction(async tx => {
    const doc = await tx.get(ref);
    if ((doc.data()?.lockUntil || 0) > Date.now() || (doc.data()?.secretVersion || null) !== config.secretVersion) throw new Error('Credential changed during test. Test again.');
    tx.set(ref, { ...(doc.exists ? {} : config), status, lastTestedAt: now, lastSuccessfulTest: status === 'connected' ? now : config.lastSuccessfulTest }, { merge: true });
  });
  await audit('AI_PROVIDER_TESTED', user.uid, providerId, status);
  return { status };
}
export async function syncModels(token: string, id: ProviderId) {
  const user = await caller(token); const providerId = z.enum(providerIds).parse(id);
  const provider = (await loadProviders()).find(p => p.providerId === providerId)!;
  const discovered = await (await getProvider(provider)).listModels();
  const ref = adminDb.collection('ai_configuration').doc('control');
  const initial = await loadControl();
  await adminDb.runTransaction(async tx => {
    const snap = await tx.get(ref); const control = snap.exists ? snap.data() as Control : initial;
    for (const raw of discovered) {
      if (!raw.modelId || control.models.some(m => m.providerId === providerId && m.modelId === raw.modelId)) continue;
      const model = modelSchema.safeParse({ providerId, displayName: raw.modelId, capabilities: [], contextWindow: 32768,
        inputCostPerMillion: null, outputCostPerMillion: null, imageCost: null, quality: 50, ...raw, enabled: false });
      if (model.success && control.models.length < 1000) control.models.push(model.data);
    }
    tx.set(ref, control);
  });
  await audit('AI_MODELS_SYNCED', user.uid, providerId, 'Discovered models are disabled pending capability and pricing review.');
}
export async function testModel(token: string, input: unknown) {
  const user = await caller(token);
  try {
  const data = z.object({ target: targetSchema, feature: z.enum(features) }).strict().parse(input);
  // A fixed synthetic fixture prevents uploading private documents through the playground.
  const vision = ['extractDocumentText', 'photoAnalysis', 'enhancePhoto'].includes(data.feature);
  const sharp = (await import('sharp')).default;
  const image = vision ? { base64: (await sharp({ create: { width: 64, height: 64, channels: 3, background: '#bfa889' } }).png().toBuffer()).toString('base64'), mimeType: 'image/png' } : undefined;
  const imageOutput = data.feature === 'enhancePhoto';
  const result = await withPlayground(user.uid, () => generate(data.feature, { prompt: imageOutput ? 'Restore this synthetic plain color image without adding objects.' : 'This is a synthetic connection test. Return JSON with a single string property result describing this test.', image, imageOutput, structured: !imageOutput, maxOutputTokens: 512 }, imageOutput ? undefined : text => { z.object({ result: z.string() }).parse(JSON.parse(text)); }, data.target));
  return { response: result.image ? `data:${result.image.mimeType};base64,${result.image.base64}` : result.text, ...result.invocation, structuredOutputValid: imageOutput ? null : true };
  } catch (error) {
    const allowed = ['no_eligible_model', 'feature_disabled', 'pricing_missing', 'budget_exceeded', 'budget_nonessential_disabled', 'request_cost_exceeded', 'circuit_open', 'providers_unavailable', 'authentication', 'rate_limited', 'timeout', 'provider_5xx', 'provider_outage', 'model_unavailable', 'invalid_request', 'invalid_image_response', 'invalid_response', 'invalid_structured_output', 'content_policy', 'secret_store_unavailable', 'credential_missing', 'configuration_changed'];
    return { error: error instanceof AIError && allowed.includes(error.code) ? error.code : 'test_failed' };
  }
}
