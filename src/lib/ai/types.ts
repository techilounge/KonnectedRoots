import { z } from 'zod';

export const providerIds = ['google', 'deepseek', 'openrouter', 'openai', 'anthropic', 'custom'] as const;
export const features = ['generateBiography', 'suggestName', 'extractDocumentText', 'translateDocument', 'photoAnalysis', 'enhancePhoto'] as const;
export const capabilities = ['text', 'vision', 'structuredOutput', 'toolCalling', 'imageGeneration', 'imageEditing'] as const;
export type ProviderId = typeof providerIds[number];
export type Feature = typeof features[number];
export type Capability = typeof capabilities[number];
export const targetSchema = z.object({ providerId: z.enum(providerIds), modelId: z.string().min(1).max(160).regex(/^[a-zA-Z0-9._:/-]+$/) }).strict();
export type Target = z.infer<typeof targetSchema>;
const money = z.number().finite().min(0).max(1000000);
export const modelSchema = targetSchema.extend({
  displayName: z.string().min(1).max(160), capabilities: z.array(z.enum(capabilities)).max(6),
  contextWindow: z.number().int().min(1024).max(10000000), inputCostPerMillion: money.nullable(),
  outputCostPerMillion: money.nullable(), imageCost: money.nullable(), enabled: z.boolean(),
  quality: z.number().min(0).max(100),
});
export type Model = z.infer<typeof modelSchema>;
export const routeSchema = z.object({
  primary: targetSchema, fallbacks: z.array(targetSchema).max(5),
  mode: z.enum(['fixed', 'lowest_cost', 'balanced', 'quality_first']),
  maxRequestCost: money.positive(), monthlyBudget: money.nullable(), enabled: z.boolean(), essential: z.boolean(),
  privacy: z.enum(['aggregator_allowed', 'direct_providers_only']),
}).strict();
export type Route = z.infer<typeof routeSchema>;
export const budgetSchema = z.object({
  monthlyBudget: money.positive(), warningThreshold: z.number().min(0).max(1),
  emergencyThreshold: z.number().min(0).max(1), hardBudget: money.positive(),
  policy: z.enum(['alert_only', 'prefer_cheaper_models', 'disable_nonessential_ai']),
  failureThreshold: z.number().int().min(1).max(20), cooldownSeconds: z.number().int().min(30).max(86400),
}).strict().refine(b => b.warningThreshold <= b.emergencyThreshold && b.monthlyBudget <= b.hardBudget, 'Invalid budget threshold order');
export type Budgets = z.infer<typeof budgetSchema>;
export type ProviderConfig = { providerId: ProviderId; enabled: boolean; credentialConfigured: boolean;
  credentialFingerprint: string | null; secretVersion: string | null; credentialSource: 'environment' | 'vault' | 'none';
  status: string; lastTestedAt: string | null; lastSuccessfulTest: string | null; baseUrl?: string };
export type Control = { models: Model[]; routes: Record<Feature, Route>; budgets: Budgets };
export type AIRequest = { prompt: string; image?: { base64: string; mimeType: string }; maxOutputTokens: number; structured?: boolean; responseSchema?: Record<string, unknown>; imageOutput?: boolean };
export type AIResponse = { text: string; image?: { base64: string; mimeType: string }; inputTokens: number | null; outputTokens: number | null; textOutputTokens?: number | null; reportedCostUsd?: number | null };
export interface Provider {
  testConnection(): Promise<void>;
  listModels(): Promise<Partial<Model>[]>;
  generateText(request: AIRequest, model: string): Promise<AIResponse>;
  generateStructured?(request: AIRequest, model: string): Promise<AIResponse>;
  analyzeImage?(request: AIRequest, model: string): Promise<AIResponse>;
  generateImage?(request: AIRequest, model: string): Promise<AIResponse>;
  imageEdit?(request: AIRequest, model: string): Promise<AIResponse>;
}
export class AIError extends Error {
  constructor(public code: string) { super(`AI request failed (${code}).`); this.name = 'AIError'; }
}
export type BillingContext = { uid: string; familyId: string | null; plan: string; playground?: boolean };
export type Invocation = Target & BillingContext & { feature: Feature; timestamp: string; latencyMs: number;
  inputTokens: number | null; outputTokens: number | null; estimatedCostUsd: number; success: boolean;
  fallbackUsed: boolean; errorCode: string | null; costIsReservation: boolean };
