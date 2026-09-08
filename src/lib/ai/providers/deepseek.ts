import { compatibleProvider } from './openai-compatible';
export const deepseekProvider = (key: string) => compatibleProvider('deepseek', 'https://api.deepseek.com', key);
