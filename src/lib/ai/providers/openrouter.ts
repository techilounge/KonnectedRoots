import { compatibleProvider } from './openai-compatible';
export const openrouterProvider = (key: string) => compatibleProvider('openrouter', 'https://openrouter.ai/api/v1', key);
