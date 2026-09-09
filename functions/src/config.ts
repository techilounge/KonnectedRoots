// Functions is a separate Node 20 deployment; never import Next.js config here.
export function functionsConfig(env: NodeJS.ProcessEnv = process.env) {
  const required = (name: string) => {
    const value = env[name];
    if (!value) throw new Error(`Missing Functions configuration: ${name}`);
    return value;
  };
  return {
    get stripeSecretKey() { return required('STRIPE_SECRET_KEY'); },
    get stripeWebhookSecret() { return required('STRIPE_WEBHOOK_SECRET'); },
    get resendApiKey() { return env.RESEND_API_KEY; },
    get appUrl() { return env.APP_URL || 'https://konnectedroots.app'; },
    prices: {
      pro_monthly: env.STRIPE_PRICE_PRO_MONTHLY || '',
      pro_yearly: env.STRIPE_PRICE_PRO_YEARLY || '',
      family_monthly: env.STRIPE_PRICE_FAMILY_MONTHLY || '',
      family_yearly: env.STRIPE_PRICE_FAMILY_YEARLY || '',
      ai_pack_monthly: env.STRIPE_PRICE_AI_PACK || '',
    },
  };
}
export const functionsEnv = functionsConfig();
