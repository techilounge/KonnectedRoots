import { adapterCapabilities, requirements } from './registry';
import type { Feature, Model, ProviderConfig, Route } from './types';

export function modelUnavailableReason(model: Model, feature: Feature, route: Route, provider?: Pick<ProviderConfig, 'enabled' | 'credentialConfigured'>): string | null {
  if (!model.enabled) return 'Model is disabled.';
  if (!provider?.enabled) return 'Provider is disabled.';
  if (!provider.credentialConfigured) return 'Add a credential for this provider in Providers.';
  if (model.capabilities.some(c => !adapterCapabilities[model.providerId].includes(c))) return 'Remove capabilities unsupported by this provider adapter.';
  const missing = requirements[feature].filter(c => !model.capabilities.includes(c));
  if (missing.length) return `This feature requires: ${missing.join(', ')}.`;
  if (!route.enabled) return 'Enable this feature in Feature Routing.';
  if (route.privacy === 'direct_providers_only' && ['openrouter', 'custom'].includes(model.providerId)) return 'Set feature Privacy to aggregator_allowed to use this provider.';
  if (model.inputCostPerMillion === null || model.outputCostPerMillion === null || (feature === 'enhancePhoto' && model.imageCost === null)) return 'Review and fill in token prices and, for image output, Per image. Blank prices are unknown.';
  return null;
}
