import { AIError, type AIRequest, type Control, type Feature, type ProviderConfig } from './types';
import { compatible, modelKey } from './registry';
import { estimate } from './cost-engine';
export const qualifyingFailure = (code: string) => ['timeout', 'rate_limited', 'provider_5xx', 'provider_outage', 'model_unavailable'].includes(code);
export function nextCircuit(previous: { failures?: number; unavailableUntil?: number }, code: string | null, threshold: number, cooldown: number, now = Date.now()) {
  if (!code) return { failures: 0, unavailableUntil: 0 };
  if (!qualifyingFailure(code)) return previous;
  const failures = (previous.failures || 0) + 1;
  return { failures, unavailableUntil: failures >= threshold ? now + cooldown * 1000 : 0 };
}
export function candidates(control: Control, providers: ProviderConfig[], feature: Feature, request: AIRequest, cheaper = false) {
  const route = control.routes[feature];
  if (!route.enabled) throw new AIError('feature_disabled');
  const selected = [route.primary, ...route.fallbacks].map(t => control.models.find(m => modelKey(m) === modelKey(t)))
    .filter(m => m && m.enabled && compatible(feature, m) &&
      (route.privacy !== 'direct_providers_only' || !['openrouter', 'custom'].includes(m.providerId)) &&
      providers.some(p => p.providerId === m.providerId && p.enabled && p.credentialConfigured));
  const scored = selected.flatMap(m => {
    if (!m) return [];
    try { const price = estimate(m, request); return price <= route.maxRequestCost ? [{ m, price }] : []; } catch { return []; }
  });
  const mode = cheaper ? 'lowest_cost' : route.mode;
  if (mode === 'lowest_cost') scored.sort((a, b) => a.price - b.price);
  if (mode === 'quality_first') scored.sort((a, b) => b.m.quality - a.m.quality);
  if (mode === 'balanced') scored.sort((a, b) => (a.price / Math.max(a.m.quality, 1)) - (b.price / Math.max(b.m.quality, 1)));
  if (!scored.length) throw new AIError('no_eligible_model');
  return scored.map(x => x.m);
}
