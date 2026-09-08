import 'server-only';
import { AIError, type AIRequest, type AIResponse, type Provider } from '../types';
import { requestJson, tokens } from './http';
export function googleProvider(key: string): Provider {
  const base = 'https://generativelanguage.googleapis.com/v1beta';
  const headers = { 'x-goog-api-key': key };
  const generate = async (r: AIRequest, model: string): Promise<AIResponse> => {
    const data = await requestJson(`${base}/models/${encodeURIComponent(model)}:generateContent`, headers, {
      contents: [{ role: 'user', parts: [{ text: r.prompt }, ...(r.image ? [{ inlineData: { mimeType: r.image.mimeType, data: r.image.base64 } }] : [])] }],
      generationConfig: { maxOutputTokens: r.maxOutputTokens,
        ...(r.imageOutput ? { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { imageSize: '1K' } } : r.structured ? { responseMimeType: 'application/json' } : {}) },
    });
    const candidate = data.candidates?.[0];
    if (data.promptFeedback?.blockReason || ['SAFETY', 'PROHIBITED_CONTENT', 'IMAGE_SAFETY', 'RECITATION'].includes(candidate?.finishReason)) throw new AIError('content_policy');
    const parts = candidate?.content?.parts || [];
    const image = parts.find((p: { inlineData?: unknown }) => p.inlineData)?.inlineData;
    const text = parts.filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought).map((p: { text: string }) => p.text).join('');
    if (!text && !image) throw new AIError('invalid_response');
    // Image output is priced separately, avoiding charging image tokens at the text rate.
    const detail = data.usageMetadata?.candidatesTokensDetails;
    const textOutput = r.imageOutput ? (Array.isArray(detail) ? detail.filter((d: { modality: string }) => d.modality === 'TEXT').reduce((n: number, d: { tokenCount: number }) => n + d.tokenCount, 0) : undefined) : data.usageMetadata?.candidatesTokenCount;
    return { text, ...(image ? { image: { base64: image.data, mimeType: image.mimeType } } : {}),
      inputTokens: tokens(data.usageMetadata?.promptTokenCount),
      outputTokens: tokens(data.usageMetadata?.candidatesTokenCount === undefined ? undefined : data.usageMetadata.candidatesTokenCount + (data.usageMetadata?.thoughtsTokenCount || 0)),
      textOutputTokens: tokens(textOutput === undefined ? undefined : textOutput + (data.usageMetadata?.thoughtsTokenCount || 0)) };
  };
  const listModels = async () => {
    const data = await requestJson(`${base}/models?pageSize=1000`, headers);
    return (data.models || []).filter((m: { supportedGenerationMethods?: string[] }) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m: { name: string; displayName: string; inputTokenLimit: number }) => ({ providerId: 'google' as const, modelId: m.name.replace(/^models\//, ''), displayName: m.displayName, contextWindow: m.inputTokenLimit }));
  };
  return { generateText: generate, generateStructured: generate, analyzeImage: generate, generateImage: generate, imageEdit: generate, listModels, testConnection: async () => { await listModels(); } };
}
