import type { Plan, BillingStatus, PlanLimits, UserBilling } from './types';
import { getAIAllowance, PLAN_LIMITS } from './constants';

/** Stripe states that grant paid product access. No implicit past-due grace period exists. */
export const PAID_BILLING_STATUSES: readonly BillingStatus[] = ['active', 'trialing'];
export const PAYMENT_ATTENTION_STATUSES: readonly BillingStatus[] = ['past_due', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'];

export function requiresPaymentAttention(plan: Plan, status: BillingStatus): boolean {
  return plan !== 'free' && PAYMENT_ATTENTION_STATUSES.includes(status);
}

export function paidAccessEndsAt(currentPeriodEnd = 0, scheduledCancellationAt: number | null = null): number {
  if (!Number.isFinite(currentPeriodEnd) || currentPeriodEnd <= 0) return 0;
  if (scheduledCancellationAt !== null && Number.isFinite(scheduledCancellationAt) && scheduledCancellationAt > 0) {
    return Math.min(currentPeriodEnd, scheduledCancellationAt);
  }
  return currentPeriodEnd;
}

export function grantsPaidAccess(
  status: BillingStatus,
  currentPeriodEnd = 0,
  now = Date.now(),
  scheduledCancellationAt: number | null = null,
): boolean {
  if (!PAID_BILLING_STATUSES.includes(status)) return false;
  // A scheduled cancellation remains usable until the earlier authoritative
  // cancellation or paid-period timestamp.
  // Missing period data fails closed instead of turning a stale active marker into
  // an indefinite entitlement.
  return paidAccessEndsAt(currentPeriodEnd, scheduledCancellationAt) > now;
}

export function effectivePlan(
  billing: Pick<UserBilling, 'plan' | 'status' | 'currentPeriodEnd'> &
    Partial<Pick<UserBilling, 'scheduledCancellationAt'>>,
  now = Date.now(),
): Plan {
  return grantsPaidAccess(
    billing.status,
    billing.currentPeriodEnd,
    now,
    billing.scheduledCancellationAt ?? null,
  ) ? billing.plan : 'free';
}

export function hasActiveAIPack(
  billing: Partial<Pick<UserBilling,
    'aiPackItemExists' |
    'aiPackStatus' |
    'aiPackPaidThrough' |
    'aiPackCancelAtPeriodEnd' |
    'aiPackScheduledRemovalAt' |
    'addons'>>,
  now = Date.now(),
): boolean {
  const paidThrough = Number(billing.aiPackPaidThrough || 0);
  const scheduledRemovalAt = Number(billing.aiPackScheduledRemovalAt || 0);
  const recurringOrPrepaid = billing.aiPackItemExists === true || (
    billing.aiPackCancelAtPeriodEnd === true &&
    scheduledRemovalAt === paidThrough &&
    scheduledRemovalAt > now
  );
  return recurringOrPrepaid &&
    billing.aiPackStatus === 'active' &&
    billing.addons?.aiPack === true &&
    paidThrough > now;
}

/**
 * Family AI Pack fields are a derived projection of the billing owner's Stripe
 * subscription. Prefer the owner snapshot only when it identifies the same
 * paid Family subscription. A present but mismatched owner snapshot clears the
 * add-on projection so stale Family state cannot overgrant credits; a missing
 * owner snapshot leaves the server-maintained Family projection for later
 * reconciliation.
 */
export function resolveFamilyAIPackAuthority(
  familyPlan: Partial<UserBilling>,
  ownerBilling: Partial<UserBilling> | null | undefined,
): Partial<UserBilling> {
  const familySubscriptionId = typeof familyPlan.stripeSubscriptionId === 'string'
    ? familyPlan.stripeSubscriptionId
    : '';
  const familyCustomerId = typeof familyPlan.stripeCustomerId === 'string'
    ? familyPlan.stripeCustomerId
    : '';
  if (!ownerBilling) return familyPlan;
  if (ownerBilling.plan !== 'family' ||
      !familySubscriptionId ||
      !familyCustomerId ||
      ownerBilling.stripeSubscriptionId !== familySubscriptionId ||
      ownerBilling.stripeCustomerId !== familyCustomerId) {
    return {
      ...familyPlan,
      aiPackItemExists: false,
      aiPackStatus: 'none',
      aiPackPaidThrough: null,
      aiPackOperationId: null,
      aiPackRequestedAt: null,
      aiPackCancelAtPeriodEnd: false,
      aiPackScheduledRemovalAt: null,
      aiPackRemovalOperationId: null,
      aiPackRemovalRequestedAt: null,
      aiPackResumeOperationId: null,
      aiPackResumeRequestedAt: null,
      addons: { ...(familyPlan.addons || {}), aiPack: false },
    };
  }

  return ownerBilling;
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
