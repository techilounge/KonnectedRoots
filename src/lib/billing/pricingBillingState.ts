import type { BillingStatus, Plan } from './types';
import { requiresPaymentAttention } from './plan';

export function resolvePricingBillingState({
  currentPlan,
  canonicalPlan,
  canonicalStatus,
  paymentAttentionRequired,
  loading,
}: {
  currentPlan: Plan;
  canonicalPlan: Plan;
  canonicalStatus: BillingStatus;
  paymentAttentionRequired: boolean;
  loading: boolean;
}) {
  const paymentRequired = paymentAttentionRequired || requiresPaymentAttention(canonicalPlan, canonicalStatus);
  const canMutatePaidBilling = !loading && !paymentRequired;
  return {
    paymentRequired,
    canMutatePaidBilling,
    canStartProCheckout: canMutatePaidBilling && currentPlan === 'free',
    canStartFamilyCheckout: canMutatePaidBilling && currentPlan === 'free',
    canUpgradeToFamily: canMutatePaidBilling && currentPlan === 'pro',
    canMutateAddons: canMutatePaidBilling && currentPlan !== 'free',
    isOrdinaryFree: currentPlan === 'free' && !paymentRequired,
  };
}

export function familyUpgradeFailureMessage(
  failure: 'payment_expired' | 'payment_failed' | 'request_failed',
  hasAIPack: boolean,
): string {
  const reason = failure === 'payment_expired'
    ? 'The Family upgrade payment expired.'
    : failure === 'payment_failed'
      ? 'The Family upgrade payment failed.'
      : 'Family upgrade could not be completed.';
  return `${reason} ${hasAIPack ? 'Your Pro plan and AI Pack remain active.' : 'Your Pro plan remains active.'}`;
}
