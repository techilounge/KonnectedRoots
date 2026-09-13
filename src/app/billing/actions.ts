'use server';

import 'server-only';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { DEFAULT_USER_BILLING, DEFAULT_USER_FAMILY, DEFAULT_USER_USAGE, type BillingStatus, type EntitlementReason, type Plan, type PlanChangeStatus, type UserBilling, type UserUsage, type ScheduledPlanChange } from '@/lib/billing/types';
import { effectivePlan, grantsPaidAccess, hasActiveAIPack, limitsForPlan, requiresPaymentAttention, resolveFamilyAIPackAuthority } from '@/lib/billing/plan';
import { getCurrentMonthKey, needsMonthlyReset } from '@/lib/billing/constants';
import { billingEvaluationTime } from '@/lib/billing/evaluationTime.server';

export interface AuthoritativeBillingView {
  billingScheduleCleanupRequired: boolean;
  billingScheduleReleaseConfirmed: boolean;
  scheduledDowngrade: ScheduledPlanChange | null;
  canManageFamilyBilling: boolean;
  plan: Plan;
  status: BillingStatus;
  interval: UserBilling['interval'];
  limits: ReturnType<typeof limitsForPlan>;
  usage: UserUsage;
  isFamily: boolean;
  familyId: string | null;
  renewsAt: number | null;
  cancelAtPeriodEnd: boolean;
  scheduledCancellationAt: number | null;
  hasAIPack: boolean;
  aiPackItemExists: boolean;
  aiPackStatus: UserBilling['aiPackStatus'];
  aiPackPaidThrough: number | null;
  aiPackCancelAtPeriodEnd: boolean;
  aiPackScheduledRemovalAt: number | null;
  aiPackRemovalPending: boolean;
  aiPackResumePending: boolean;
  planChangeStatus: PlanChangeStatus;
  planChangeFailure: UserBilling['planChangeFailure'];
  hasStripeCustomer: boolean;
  canonicalPlan: Plan;
  canonicalStatus: BillingStatus;
  effectivePaidEntitlement: boolean;
  paymentAttentionRequired: boolean;
  entitlementReason: EntitlementReason;
  familyWorkspacePreserved: boolean;
  aiPackEntitlementValid: boolean;
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
  const now = await billingEvaluationTime(billing, decoded.uid);
  const family = { ...DEFAULT_USER_FAMILY, ...(data.family || {}) };
  const usage = { ...DEFAULT_USER_USAGE, ...(data.usage || {}) } as UserUsage;
  let plan = effectivePlan(billing, now);
  let resolvedInterval = billing.interval;
  let resolvedPeriodEnd = billing.currentPeriodEnd;
  let resolvedCancelAtPeriodEnd = Boolean(billing.cancelAtPeriodEnd);
  let resolvedScheduledCancellationAt = billing.scheduledCancellationAt;
  let hasAIPack = plan !== 'free' && hasActiveAIPack(billing, now);
  let resolvedAIPackItemExists = Boolean(billing.aiPackItemExists);
  let resolvedAIPackStatus = billing.aiPackStatus;
  let resolvedAIPackPaidThrough = billing.aiPackPaidThrough;
  let resolvedAIPackCancelAtPeriodEnd = billing.aiPackCancelAtPeriodEnd;
  let resolvedAIPackScheduledRemovalAt = billing.aiPackScheduledRemovalAt;
  let resolvedAIPackRemovalPending = Boolean(billing.aiPackRemovalOperationId);
  let resolvedAIPackResumePending = Boolean(billing.aiPackResumeOperationId);
  let resolvedUsage = usage;
  const currentMonth = getCurrentMonthKey();
  let isFamily = false;
  let canonicalPlan: Plan = billing.plan;
  let canonicalStatus: BillingStatus = billing.status;
  let familyWorkspacePreserved = false;
  let canManageFamilyBilling = false;
  if (family.familyId) {
    const familySnap = await adminDb.collection('families').doc(family.familyId).get();
    familyWorkspacePreserved = familySnap.exists;
    const familyData = familySnap.data() || {};
    const familyPlan = familyData.plan || {};
    const ownerUid = typeof familyData.ownerUid === 'string' ? familyData.ownerUid : '';
    const ownerBilling = ownerUid === decoded.uid
      ? billing
      : ownerUid
        ? normalizeBilling((await adminDb.collection('users').doc(ownerUid).get()).data()?.billing)
        : null;
    const hasCanonicalFamilyPlan = familyPlan.plan === 'family' && ownerBilling?.plan === 'family';
    const familyNow = ownerBilling && ownerUid !== decoded.uid ? await billingEvaluationTime(ownerBilling, ownerUid) : now;
    canManageFamilyBilling = ownerUid === decoded.uid && billing.plan === 'family';
    if (hasCanonicalFamilyPlan) {
      canonicalPlan = 'family';
      canonicalStatus = ['active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'paused', 'unpaid', 'none'].includes(String(familyPlan.status))
        ? familyPlan.status as BillingStatus
        : 'none';
      resolvedInterval = familyPlan.interval || resolvedInterval;
      resolvedPeriodEnd = Number(familyPlan.currentPeriodEnd || 0);
      resolvedCancelAtPeriodEnd = Boolean(familyPlan.cancelAtPeriodEnd);
      resolvedScheduledCancellationAt = Number(familyPlan.scheduledCancellationAt || 0) || null;
    }
    const ownerBillingIsPaidFamily = ownerBilling !== null && ownerBilling.plan === 'family' && grantsPaidAccess(
      ownerBilling.status,
      Number(ownerBilling.currentPeriodEnd || 0),
      familyNow,
      Number(ownerBilling.scheduledCancellationAt || 0) || null,
    );
    const familyPaid = hasCanonicalFamilyPlan && grantsPaidAccess(
      canonicalStatus,
      Number(familyPlan.currentPeriodEnd || 0),
      familyNow,
      Number(familyPlan.scheduledCancellationAt || 0) || null,
    ) && ownerBillingIsPaidFamily && ownerBilling !== null
      && ownerBilling.stripeCustomerId === familyPlan.stripeCustomerId
      && ownerBilling.stripeSubscriptionId === familyPlan.stripeSubscriptionId;
    if (familyPaid) {
      isFamily = true;
      plan = 'family';
      const familyAIPackAuthority = resolveFamilyAIPackAuthority(familyPlan, ownerBilling!);
      hasAIPack = hasActiveAIPack(familyAIPackAuthority, familyNow);
      resolvedAIPackItemExists = Boolean(familyAIPackAuthority.aiPackItemExists);
      resolvedAIPackStatus = ['pending', 'active'].includes(String(familyAIPackAuthority.aiPackStatus))
        ? familyAIPackAuthority.aiPackStatus as UserBilling['aiPackStatus']
        : billing.aiPackStatus;
      resolvedAIPackPaidThrough = Number(familyAIPackAuthority.aiPackPaidThrough || 0) || null;
      resolvedAIPackCancelAtPeriodEnd = Boolean(familyAIPackAuthority.aiPackCancelAtPeriodEnd);
      resolvedAIPackScheduledRemovalAt = Number(familyAIPackAuthority.aiPackScheduledRemovalAt || 0) || null;
      resolvedAIPackRemovalPending = Boolean(familyAIPackAuthority.aiPackRemovalOperationId);
      resolvedAIPackResumePending = Boolean(familyAIPackAuthority.aiPackResumeOperationId);
      resolvedUsage = { ...DEFAULT_USER_USAGE, ...(familyData.usage || {}) } as UserUsage;
    } else if (hasCanonicalFamilyPlan) {
      // Preserve the commercial Family record and workspace, but never retain
      // paid Family capabilities while the authoritative status is non-entitled.
      plan = 'free';
      hasAIPack = false;
    }
  }
  const normalizedUsage = needsMonthlyReset(resolvedUsage.monthKey) ? {
    ...resolvedUsage,
    monthKey: currentMonth,
    exportsUsed: 0,
    aiActionsUsed: 0,
  } : resolvedUsage;
  const effectivePaidEntitlement = plan !== 'free';
  const paymentAttentionRequired = requiresPaymentAttention(canonicalPlan, canonicalStatus);
  const entitlementReason: EntitlementReason = effectivePaidEntitlement
    ? canonicalStatus === 'trialing' ? 'trialing' : 'active'
    : canonicalStatus === 'past_due' ? 'past_due'
      : canonicalStatus === 'incomplete_expired' ? 'subscription_expired'
        : paymentAttentionRequired ? 'payment_required'
          : canonicalStatus === 'canceled' ? 'subscription_canceled'
            : canonicalPlan === 'free' ? 'free_plan'
              : 'paid_entitlement_unavailable';
  return {
    billingScheduleCleanupRequired: canonicalPlan === 'pro' && Boolean(billing.hasBasePlanSchedule) && !billing.scheduleReleaseConfirmed,
    billingScheduleReleaseConfirmed: billing.scheduleReleaseConfirmed === true && billing.scheduleReconciliationStatus === 'released',
    scheduledDowngrade: canManageFamilyBilling && billing.scheduledPlan === 'pro' &&
      billing.scheduledChangeStatus === 'scheduled' && billing.scheduledChangeType === 'downgrade' &&
      (billing.scheduledInterval === 'month' || billing.scheduledInterval === 'year') &&
      Number(billing.scheduledChangeAt || 0) > 0 ? {
        scheduledPlan: 'pro', scheduledInterval: billing.scheduledInterval,
        scheduledChangeAt: Number(billing.scheduledChangeAt), scheduledChangeType: 'downgrade', scheduledChangeStatus: 'scheduled',
      } : null,
    canManageFamilyBilling,
    plan,
    status: canonicalStatus,
    limits: limitsForPlan(isFamily ? 'family' : plan, hasAIPack),
    usage: normalizedUsage,
    isFamily,
    familyId: family.familyId,
    renewsAt: resolvedPeriodEnd > 0 ? resolvedPeriodEnd : null,
    cancelAtPeriodEnd: resolvedCancelAtPeriodEnd,
    scheduledCancellationAt: resolvedScheduledCancellationAt,
    hasAIPack,
    aiPackItemExists: resolvedAIPackItemExists,
    aiPackStatus: hasAIPack ? 'active' : resolvedAIPackItemExists || resolvedAIPackStatus === 'pending' ? 'pending' : 'none',
    aiPackPaidThrough: resolvedAIPackPaidThrough,
    aiPackCancelAtPeriodEnd: resolvedAIPackCancelAtPeriodEnd && hasAIPack,
    aiPackScheduledRemovalAt: resolvedAIPackCancelAtPeriodEnd && hasAIPack
      ? resolvedAIPackScheduledRemovalAt
      : null,
    aiPackRemovalPending: resolvedAIPackRemovalPending && hasAIPack,
    aiPackResumePending: resolvedAIPackResumePending && hasAIPack && !resolvedAIPackItemExists,
    planChangeStatus: billing.planChangeStatus,
    planChangeFailure: billing.planChangeFailure,
    hasStripeCustomer: Boolean(billing.stripeCustomerId),
    interval: resolvedInterval,
    canonicalPlan,
    canonicalStatus,
    effectivePaidEntitlement,
    paymentAttentionRequired,
    entitlementReason,
    familyWorkspacePreserved,
    aiPackEntitlementValid: hasAIPack,
  };
}
