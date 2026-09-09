'use server';

import 'server-only';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { DEFAULT_USER_BILLING, DEFAULT_USER_FAMILY, DEFAULT_USER_USAGE, type BillingStatus, type Plan, type UserBilling, type UserUsage } from '@/lib/billing/types';
import { effectivePlan, grantsPaidAccess, limitsForPlan } from '@/lib/billing/plan';
import { getCurrentMonthKey, needsMonthlyReset } from '@/lib/billing/constants';

export interface AuthoritativeBillingView {
  plan: Plan;
  status: BillingStatus;
  interval: UserBilling['interval'];
  limits: ReturnType<typeof limitsForPlan>;
  usage: UserUsage;
  isFamily: boolean;
  familyId: string | null;
  renewsAt: number | null;
  cancelAtPeriodEnd: boolean;
  hasAIPack: boolean;
  hasStripeCustomer: boolean;
}

function normalizeBilling(value: unknown): UserBilling {
  const data = (value || {}) as Partial<UserBilling>;
  return {
    ...DEFAULT_USER_BILLING,
    ...data,
    plan: data.plan === 'pro' || data.plan === 'family' ? data.plan : 'free',
    status: ['active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'paused', 'unpaid', 'none'].includes(String(data.status)) ? data.status as BillingStatus : 'none',
    addons: { ...DEFAULT_USER_BILLING.addons, ...(data.addons || {}) },
  };
}

export async function getAuthoritativeBillingView(idToken: string | undefined): Promise<AuthoritativeBillingView> {
  if (!idToken) throw new Error('Authentication required');
  const decoded = await adminAuth.verifyIdToken(idToken);
  const snap = await adminDb.collection('users').doc(decoded.uid).get();
  const data = snap.exists ? snap.data() || {} : {};
  const billing = normalizeBilling(data.billing);
  const family = { ...DEFAULT_USER_FAMILY, ...(data.family || {}) };
  const usage = { ...DEFAULT_USER_USAGE, ...(data.usage || {}) } as UserUsage;
  let plan = effectivePlan(billing);
  let resolvedStatus = billing.status;
  let resolvedInterval = billing.interval;
  let resolvedPeriodEnd = billing.currentPeriodEnd;
  let resolvedCancelAtPeriodEnd = Boolean(billing.cancelAtPeriodEnd);
  let hasAIPack = plan !== 'free' && Boolean(billing.addons?.aiPack);
  let resolvedUsage = usage;
  const currentMonth = getCurrentMonthKey();
  let isFamily = false;
  if (family.familyId) {
    const familySnap = await adminDb.collection('families').doc(family.familyId).get();
    const familyData = familySnap.data() || {};
    const familyPlan = familyData.plan || {};
    if (grantsPaidAccess(familyPlan.status || 'none', Number(familyPlan.currentPeriodEnd || 0))) {
      isFamily = true;
      plan = 'family';
      resolvedStatus = familyPlan.status as BillingStatus;
      resolvedInterval = familyPlan.interval || resolvedInterval;
      resolvedPeriodEnd = Number(familyPlan.currentPeriodEnd || 0);
      resolvedCancelAtPeriodEnd = Boolean(familyPlan.cancelAtPeriodEnd);
      hasAIPack = Boolean(familyPlan.addons?.aiPack);
      resolvedUsage = { ...DEFAULT_USER_USAGE, ...(familyData.usage || {}) } as UserUsage;
    }
  }
  const normalizedUsage = needsMonthlyReset(resolvedUsage.monthKey) ? {
    ...resolvedUsage,
    monthKey: currentMonth,
    exportsUsed: 0,
    aiActionsUsed: 0,
  } : resolvedUsage;
  return {
    plan,
    status: resolvedStatus,
    limits: limitsForPlan(isFamily ? 'family' : plan, hasAIPack),
    usage: normalizedUsage,
    isFamily,
    familyId: family.familyId,
    renewsAt: resolvedPeriodEnd > 0 ? resolvedPeriodEnd : null,
    cancelAtPeriodEnd: resolvedCancelAtPeriodEnd,
    hasAIPack,
    hasStripeCustomer: Boolean(billing.stripeCustomerId),
    interval: resolvedInterval,
  };
}
