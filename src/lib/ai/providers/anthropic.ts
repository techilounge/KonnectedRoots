import 'server-only';
import { AIError, type AIRequest, type AIResponse, type Provider } from '../types';
import { requestJson, tokens } from './http';
export function anthropicProvider(key: string): Provider {
  const headers = { 'x-api-key': key, 'anthropic-version': '2023-06-01' };
  const generate = async (r: AIRequest, model: string): Promise<AIResponse> => {
    const data = await requestJson('https://api.anthropic.com/v1/messages', headers, {
      model, max_tokens: r.maxOutputTokens,
      messages: [{ role: 'user', content: [{ type: 'text', text: r.prompt }, ...(r.image ? [{ type: 'image', source: { type: 'base64', media_type: r.image.mimeType, data: r.image.base64 } }] : [])] }],
    });
    if (data.stop_reason === 'refusal') throw new AIError('content_policy');
    const text = (data.content || []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('');
    if (!text) throw new AIError('invalid_response');
    return { text, inputTokens: tokens(data.usage?.input_tokens), outputTokens: tokens(data.usage?.output_tokens) };
  };
  const listModels = async () => {
    const data = await requestJson('https://api.anthropic.com/v1/models?limit=100', headers);
    return (data.data || []).map((m: { id: string; display_name: string }) => ({ providerId: 'anthropic' as const, modelId: m.id, displayName: m.display_name }));
  };
  return { generateText: generate, generateStructured: generate, analyzeImage: generate, listModels, testConnection: async () => { await listModels(); } };
}
