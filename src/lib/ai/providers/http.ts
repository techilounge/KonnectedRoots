import 'server-only';
import { AIError } from '../types';
export async function requestJson(url: string, headers: Record<string, string>, body?: unknown) {
  try {
    const response = await fetch(url, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(90000), redirect: 'error', cache: 'no-store' });
    if (!response.ok) {
      const status = response.status;
      // Never surface provider bodies, which can echo prompts or authorization input.
      throw new AIError(status === 429 ? 'rate_limited' : status >= 500 ? 'provider_5xx' : status === 401 || status === 403 ? 'authentication' : status === 404 || status === 410 ? 'model_unavailable' : 'invalid_request');
    }
    try { return await response.json(); } catch { throw new AIError('invalid_response'); }
  } catch (error) {
    if (error instanceof AIError) throw error;
    if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) throw new AIError('timeout');
    throw new AIError('provider_outage');
  }
}
export const tokens = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
