import type { Plan, BillingStatus, PlanLimits, UserBilling } from './types';
import { getAIAllowance, PLAN_LIMITS } from './constants';

/** Stripe states that grant paid product access. No implicit past-due grace period exists. */
export const PAID_BILLING_STATUSES: readonly BillingStatus[] = ['active', 'trialing'];

export function grantsPaidAccess(status: BillingStatus, currentPeriodEnd = 0, now = Date.now()): boolean {
  if (!PAID_BILLING_STATUSES.includes(status)) return false;
  // A cancel-at-period-end subscription remains usable until its paid period expires.
  // Missing period data fails closed instead of turning a stale active marker into
  // an indefinite entitlement.
  return currentPeriodEnd > now;
}

export function effectivePlan(billing: Pick<UserBilling, 'plan' | 'status' | 'currentPeriodEnd'>): Plan {
  return grantsPaidAccess(billing.status, billing.currentPeriodEnd) ? billing.plan : 'free';
}

export function limitsForPlan(plan: Plan, hasAIPack: boolean): PlanLimits {
  return { ...PLAN_LIMITS[plan], aiActionsAllowance: getAIAllowance(plan, hasAIPack) };
}

export function billingStatusLabel(status: BillingStatus): string {
  if (status === 'none') return 'free';
  if (status === 'past_due') return 'payment action required';
  if (status === 'canceled') return 'canceled';
  return status;
}
