import 'server-only';
import { serverEnv } from '@/lib/config/env.server';

import { AIError, type ProviderConfig } from '../types';
import { providerSecret } from '../secrets';
import { googleProvider } from './google';
import { deepseekProvider } from './deepseek';
import { openrouterProvider } from './openrouter';
import { openaiProvider } from './openai';
import { anthropicProvider } from './anthropic';
import { compatibleProvider } from './openai-compatible';
export function validateCustomUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new AIError('custom_url_invalid'); }
  const allowed = serverEnv.customAiOrigins;
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !allowed.includes(url.origin)) throw new AIError('custom_url_not_allowed');
  return url.toString().replace(/\/$/, '');
}
export async function getProvider(config: ProviderConfig) {
  const key = await providerSecret(config);
  switch (config.providerId) {
    case 'google': return googleProvider(key);
    case 'deepseek': return deepseekProvider(key);
    case 'openrouter': return openrouterProvider(key);
    case 'openai': return openaiProvider(key);
    case 'anthropic': return anthropicProvider(key);
    case 'custom': return compatibleProvider('custom', validateCustomUrl(config.baseUrl || ''), key);
  }
}
