import type Stripe from 'stripe';

export type ProductPlan = 'pro' | 'family';
export type BillingInterval = 'month' | 'year';
export type AddonId = 'ai_pack';

export interface BillingPrices {
  pro_monthly: string;
  pro_yearly: string;
  family_monthly: string;
  family_yearly: string;
  ai_pack_monthly: string;
}

export function billingCatalog(prices: BillingPrices) {
  return {
    pro: { month: prices.pro_monthly, year: prices.pro_yearly },
    family: { month: prices.family_monthly, year: prices.family_yearly },
    ai_pack: { month: prices.ai_pack_monthly },
  } as const;
}

export function resolvePlanPrice(prices: BillingPrices, plan: unknown, interval: unknown): string | null {
  if ((plan !== 'pro' && plan !== 'family') || (interval !== 'month' && interval !== 'year')) return null;
  const price = billingCatalog(prices)[plan][interval];
  return price || null;
}

export function isPaidSubscriptionStatus(status: Stripe.Subscription.Status | string): boolean {
  return status === 'active' || status === 'trialing';
}

export function isSupportedWebhookType(type: string): boolean {
  return [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.payment_succeeded',
    'invoice.payment_failed',
  ].includes(type);
}
