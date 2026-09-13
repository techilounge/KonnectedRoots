import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Local Test Clock time is commercial time, not webhook creation/wall time.
 * This GET-only adapter is unreachable on Vercel/production. It reuses the
 * existing gitignored local Functions sandbox secret, never public config.
 */
export async function billingEvaluationTime(billing: { stripeCustomerId?: string | null }, uid: string): Promise<number> {
  if (!['development', 'test'].includes(process.env.NODE_ENV || '') || process.env.VERCEL || process.env.VERCEL_ENV ||
      process.env.GCLOUD_PROJECT !== 'demo-konnectedroots-phase2' ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' ||
      process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || !billing.stripeCustomerId) return Date.now();
  let secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    try { secret = readFileSync(join(process.cwd(), 'functions', '.secret.local'), 'utf8').match(/^STRIPE_SECRET_KEY=(.+)$/m)?.[1]?.trim(); }
    catch { throw new Error('Local billing clock configuration unavailable.'); }
  }
  if (!secret?.startsWith('sk_test_')) throw new Error('Local billing clock requires sandbox configuration.');
  const get = async (resource: string) => {
    try {
      const response = await fetch(`https://api.stripe.com/v1/${resource}`, { method: 'GET', headers: { Authorization: `Bearer ${secret}` }, cache: 'no-store', signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error();
      return await response.json();
    } catch { throw new Error('Local billing clock read unavailable.'); }
  };
  const customer = await get(`customers/${encodeURIComponent(billing.stripeCustomerId)}`);
  if (customer.deleted || customer.id !== billing.stripeCustomerId || customer.livemode !== false || customer.metadata?.kr_uid !== uid) throw new Error('Local billing clock ownership mismatch.');
  if (!customer.test_clock) return Date.now();
  if (!['phase2_family_downgrade', 'phase2_pastdue_test_clock'].includes(customer.metadata?.kr_test_scenario)) throw new Error('Local billing clock scope mismatch.');
  const clockId = typeof customer.test_clock === 'string' ? customer.test_clock : customer.test_clock.id;
  const clock = await get(`test_helpers/test_clocks/${encodeURIComponent(clockId)}`);
  if (clock.id !== clockId || clock.livemode !== false || !Number.isSafeInteger(clock.frozen_time) || clock.frozen_time <= 0) throw new Error('Local billing clock evidence invalid.');
  return clock.frozen_time * 1000;
}
