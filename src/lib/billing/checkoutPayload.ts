export type CheckoutPlan = 'pro' | 'family';
export type CheckoutInterval = 'month' | 'year';

export type CheckoutPayload = {
  plan: CheckoutPlan;
  interval: CheckoutInterval;
  addons?: { aiPack: true };
};

export function buildCheckoutPayload(
  plan: CheckoutPlan,
  interval: CheckoutInterval,
  withAIPack: boolean,
): CheckoutPayload {
  return {
    plan,
    interval,
    ...(withAIPack ? { addons: { aiPack: true as const } } : {}),
  };
}
