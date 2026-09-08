import { compatibleProvider } from './openai-compatible';
import sharp from 'sharp';
import { AIError, type AIRequest, type AIResponse, type Model, type Provider } from '../types';
import { requestJson, tokens } from './http';

export function openrouterProvider(key: string): Provider {
  const base = 'https://openrouter.ai/api/v1';
  const headers = { Authorization: `Bearer ${key}` };
  const text = compatibleProvider('openrouter', base, key);
  const image = async (request: AIRequest, model: string): Promise<AIResponse> => {
    const response = await requestJson(`${base}/images`, headers, {
      model, prompt: request.prompt, n: 1, output_format: 'png',
      provider: { allow_fallbacks: false, data_collection: 'deny' },
      ...(request.image ? { input_references: [{ type: 'image_url', image_url: { url: `data:${request.image.mimeType};base64,${request.image.base64}` } }] } : {}),
    });
    const output = response.data?.[0];
    if (!Array.isArray(response.data) || response.data.length !== 1 || typeof output?.b64_json !== 'string' ||
        output.b64_json.length > 20000000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(output.b64_json) ||
        (output.media_type && !['image/png', 'image/jpeg', 'image/webp'].includes(output.media_type))) throw new AIError('invalid_image_response');
    let png: Buffer;
    try {
      const bytes = Buffer.from(output.b64_json, 'base64');
      if (bytes.toString('base64').replace(/=+$/, '') !== output.b64_json.replace(/=+$/, '')) throw new Error();
      const decoder = sharp(bytes, { limitInputPixels: 25000000 });
      const metadata = await decoder.metadata();
      if (!['png', 'jpeg', 'webp'].includes(metadata.format || '') || (metadata.pages || 1) > 1) throw new Error();
      png = await decoder.png().toBuffer();
      if (png.length > 15000000) throw new Error();
    } catch { throw new AIError('invalid_image_response'); }
    return { text: '', image: { base64: png.toString('base64'), mimeType: 'image/png' },
      inputTokens: tokens(response.usage?.prompt_tokens), outputTokens: tokens(response.usage?.completion_tokens),
      reportedCostUsd: tokens(response.usage?.cost) };
  };
  const listModels = async (): Promise<Partial<Model>[]> => {
    const [models, images] = await Promise.all([text.listModels(), requestJson(`${base}/images/models`, headers)]);
    for (const raw of (images.data || []).slice(0, 500)) {
      if (typeof raw.id !== 'string') continue;
      const existing = models.find(m => m.modelId === raw.id);
      const capabilities: Model['capabilities'] = ['imageGeneration', ...(raw.architecture?.input_modalities?.includes('image') ? ['imageEditing' as const, 'vision' as const] : [])];
      if (existing) existing.capabilities = [...new Set([...(existing.capabilities || []), ...capabilities])];
      else models.push({ providerId: 'openrouter', modelId: raw.id, displayName: raw.name || raw.id, capabilities });
      // Endpoint pricing can depend on resolution, references and tokens. Leave
      // per-image estimates unknown until an administrator reviews those rates.
    }
    return models;
  };
  return { ...text, listModels, generateImage: image, imageEdit: image };
}
