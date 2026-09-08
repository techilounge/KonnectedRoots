import { capabilities, type Capability, type Control, type Feature, type Model, type ProviderId, type Route } from './types';

export const requirements: Record<Feature, Capability[]> = {
  generateBiography: ['text', 'structuredOutput'], suggestName: ['text', 'structuredOutput'],
  translateDocument: ['text', 'structuredOutput'], extractDocumentText: ['vision', 'structuredOutput'],
  photoAnalysis: ['vision', 'structuredOutput'], enhancePhoto: ['imageEditing'],
};
export function compatible(feature: Feature, model: Model) { return requirements[feature].every(c => model.capabilities.includes(c)); }
export const adapterCapabilities: Record<ProviderId, readonly Capability[]> = {
  google: capabilities, deepseek: ['text', 'vision', 'structuredOutput', 'toolCalling'],
  openrouter: ['text', 'vision', 'structuredOutput', 'toolCalling'], openai: ['text', 'vision', 'structuredOutput', 'toolCalling'],
  anthropic: ['text', 'vision', 'structuredOutput', 'toolCalling'], custom: ['text', 'vision', 'structuredOutput', 'toolCalling'],
};
const model = (providerId: ProviderId, modelId: string, caps: Capability[], input: number, output: number, quality = 75, imageCost: number | null = null): Model =>
  ({ providerId, modelId, displayName: modelId, capabilities: caps, contextWindow: 1048576, inputCostPerMillion: input, outputCostPerMillion: output, imageCost, enabled: true, quality });
const text: Capability[] = ['text', 'structuredOutput', 'toolCalling'];
const vision: Capability[] = [...text, 'vision'];
export const defaultModels: Model[] = [
  model('google', 'gemini-3.8-flash', vision, 0.75, 3.75, 85),
  { ...model('google', 'gemini-3.1-flash-image', ['text', 'vision', 'imageGeneration', 'imageEditing'], 0.5, 3, 85, 0.067), contextWindow: 131072 },
  model('deepseek', 'deepseek-v4-flash', text, 0.44, 1.32),
  model('deepseek', 'deepseek-v4-pro', text, 1.32, 3.96, 95),
  model('deepseek', 'deepseek-v4-flash-vision-exp', vision, 0.44, 1.32),
];
const google = { providerId: 'google' as const, modelId: 'gemini-3.8-flash' };
const deepseek = { providerId: 'deepseek' as const, modelId: 'deepseek-v4-flash' };
const route = (vision = false): Route => ({ primary: vision ? google : deepseek,
  fallbacks: vision ? [{ providerId: 'deepseek', modelId: 'deepseek-v4-flash-vision-exp' }] : [google],
  mode: 'fixed', maxRequestCost: 0.25, monthlyBudget: null, enabled: true, essential: false, privacy: 'direct_providers_only' });
export const defaults: Control = { models: defaultModels, routes: {
  generateBiography: route(), suggestName: route(), translateDocument: route(), extractDocumentText: route(true), photoAnalysis: route(true),
  enhancePhoto: { ...route(true), primary: { providerId: 'google', modelId: 'gemini-3.1-flash-image' }, fallbacks: [], maxRequestCost: 0.5 },
}, budgets: { monthlyBudget: 100, hardBudget: 125, warningThreshold: 0.8, emergencyThreshold: 0.95, policy: 'alert_only', failureThreshold: 3, cooldownSeconds: 300 } };
export const modelKey = (m: { providerId: string; modelId: string }) => `${m.providerId}:${m.modelId}`;
