import { compatibleProvider } from './openai-compatible';
export const openaiProvider = (key: string) => compatibleProvider('openai', 'https://api.openai.com/v1', key);
