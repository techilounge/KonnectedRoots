import 'server-only';
import { AIError, type AIRequest, type AIResponse, type Model, type Provider, type ProviderId } from '../types';
import { requestJson, tokens } from './http';
export function compatibleProvider(providerId: ProviderId, baseUrl: string, key: string): Provider {
  const headers = { Authorization: `Bearer ${key}` };
  const generate = async (request: AIRequest, model: string): Promise<AIResponse> => {
    const data = await requestJson(`${baseUrl}/chat/completions`, headers, {
      model, messages: [{ role: 'user', content: request.image ? [
        { type: 'text', text: request.prompt }, { type: 'image_url', image_url: { url: `data:${request.image.mimeType};base64,${request.image.base64}` } },
      ] : request.prompt }],
      ...(providerId === 'openai' ? { max_completion_tokens: request.maxOutputTokens } : { max_tokens: request.maxOutputTokens }),
      ...(request.structured ? { response_format: { type: 'json_object' } } : {}),
      ...(providerId === 'deepseek' ? { thinking: { type: 'disabled' } } : {}),
      ...(providerId === 'openrouter' ? { provider: { allow_fallbacks: false, data_collection: 'deny' } } : {}),
    });
    const choice = data.choices?.[0];
    if (choice?.finish_reason === 'content_filter' || choice?.message?.refusal) throw new AIError('content_policy');
    if (!choice?.message?.content) throw new AIError('invalid_response');
    return { text: choice.message.content, inputTokens: tokens(data.usage?.prompt_tokens), outputTokens: tokens(data.usage?.completion_tokens) };
  };
  const listModels = async (): Promise<Partial<Model>[]> => {
    const data = await requestJson(`${baseUrl}/models`, headers);
    return (data.data || []).slice(0, 500).map((m: { id: string; name?: string; context_length?: number; pricing?: { prompt?: string; completion?: string }; architecture?: { input_modalities?: string[] }; supported_parameters?: string[] }) => ({
      providerId, modelId: m.id, displayName: m.name || m.id,
      ...(providerId === 'openrouter' ? { contextWindow: m.context_length || 32768,
        inputCostPerMillion: m.pricing?.prompt ? Number(m.pricing.prompt) * 1000000 : null,
        outputCostPerMillion: m.pricing?.completion ? Number(m.pricing.completion) * 1000000 : null,
        capabilities: ['text', ...(m.architecture?.input_modalities?.includes('image') ? ['vision'] : []),
          ...(m.supported_parameters?.includes('response_format') ? ['structuredOutput'] : [])],
      } : {}),
    })) as Partial<Model>[];
  };
  return { generateText: generate, generateStructured: generate, analyzeImage: generate, listModels, testConnection: async () => { await listModels(); } };
}
