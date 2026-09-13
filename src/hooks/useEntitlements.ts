/** Client view of server-resolved billing. It never treats a browser Firestore write as authority. */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getAuthoritativeBillingView } from '@/app/billing/actions';
import type { AIPackStatus, Entitlements, EntitlementReason, PlanChangeStatus, PlanLimits, Plan, UserBilling, ScheduledPlanChange } from '@/lib/billing/types';
import { PLAN_LIMITS } from '@/lib/billing/constants';
import { DEFAULT_USER_USAGE } from '@/lib/billing/types';
import { db } from '@/lib/firebase/clients';
import { doc, onSnapshot } from 'firebase/firestore';
import { subscribeToBillingSignals } from '@/lib/billing/liveSync';
import { markBillingReadBoundary } from '@/lib/billing/notificationFreshness';

interface UseEntitlementsReturn {
  billingViewUid: string | null;
  billingReadStartedAt: number;
  billingScheduleCleanupRequired: boolean;
  billingScheduleReleaseConfirmed: boolean;
  scheduledDowngrade: ScheduledPlanChange | null;
  canManageFamilyBilling: boolean;
  entitlements: Entitlements | null;
  loading: boolean;
  error: Error | null;
  plan: Plan;
  canonicalPlan: Plan;
  canonicalStatus: Entitlements['status'];
  effectivePaidEntitlement: boolean;
  paymentAttentionRequired: boolean;
  entitlementReason: EntitlementReason;
  familyWorkspacePreserved: boolean;
  aiPackEntitlementValid: boolean;
  isPro: boolean;
  isFamily: boolean;
  isFree: boolean;
  limits: PlanLimits;
  aiRemaining: number;
  exportsRemaining: number | null;
  storageUsedBytes: number;
  storageQuotaBytes: number;
  subscriptionStatus: Entitlements['status'];
  billingInterval: 'month' | 'year' | null;
  renewsAt: number | null;
  cancelAtPeriodEnd: boolean;
  scheduledCancellationAt: number | null;
  hasAIPack: boolean;
  aiPackItemExists: boolean;
  aiPackStatus: AIPackStatus;
  aiPackPaidThrough: number | null;
  aiPackCancelAtPeriodEnd: boolean;
  aiPackScheduledRemovalAt: number | null;
  aiPackRemovalPending: boolean;
  aiPackResumePending: boolean;
  planChangeStatus: PlanChangeStatus;
  planChangeFailure: UserBilling['planChangeFailure'];
  hasStripeCustomer: boolean;
  canCreateTree: () => boolean;
  canUseAI: (actionsNeeded?: number) => boolean;
  canExportPngPdf: () => boolean;
  canExportGedcom: () => boolean;
  shouldWatermark: () => boolean;
  refresh: () => void;
}

export function useEntitlements(): UseEntitlementsReturn {
  const { user } = useAuth();
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [billingDetails, setBillingDetails] = useState<{ renewsAt: number | null; cancelAtPeriodEnd: boolean; scheduledCancellationAt: number | null; hasAIPack: boolean; aiPackItemExists: boolean; aiPackStatus: AIPackStatus; aiPackPaidThrough: number | null; aiPackCancelAtPeriodEnd: boolean; aiPackScheduledRemovalAt: number | null; aiPackRemovalPending: boolean; aiPackResumePending: boolean; planChangeStatus: PlanChangeStatus; planChangeFailure: UserBilling['planChangeFailure']; hasStripeCustomer: boolean; interval: 'month' | 'year' | null } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [scheduledDowngrade, setScheduledDowngrade] = useState<ScheduledPlanChange | null>(null);
  const [canManageFamilyBilling, setCanManageFamilyBilling] = useState(false);
  const [scheduleConfirmation, setScheduleConfirmation] = useState({ required: false, released: false });
  const [billingReadStartedAt, setBillingReadStartedAt] = useState(0);
  const [billingViewUid, setBillingViewUid] = useState<string | null>(null);
  const refresh = useCallback(() => {
    setLoading(true);
    setRefreshTrigger((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!user?.uid) {
      setBillingViewUid(null);
      setScheduledDowngrade(null);
      setScheduleConfirmation({ required: false, released: false });
      setCanManageFamilyBilling(false);
      setEntitlements(null);
      setLoading(false);
      return () => { cancelled = true; };
    }
    setLoading(true);
    const readStartedAt = markBillingReadBoundary();
    user.getIdToken().then((token) => getAuthoritativeBillingView(token)).then((view) => {
      if (cancelled) return;
      setBillingViewUid(user.uid);
      setBillingReadStartedAt(readStartedAt);
      setScheduledDowngrade(view.scheduledDowngrade);
      setScheduleConfirmation({ required: view.billingScheduleCleanupRequired, released: view.billingScheduleReleaseConfirmed });
      setCanManageFamilyBilling(view.canManageFamilyBilling);
      setEntitlements({
        plan: view.plan,
        status: view.status,
        limits: view.limits,
        usage: view.usage,
        isFamily: view.isFamily,
        familyId: view.familyId,
        canonicalPlan: view.canonicalPlan,
        canonicalStatus: view.canonicalStatus,
        effectivePaidEntitlement: view.effectivePaidEntitlement,
        paymentAttentionRequired: view.paymentAttentionRequired,
        entitlementReason: view.entitlementReason,
        familyWorkspacePreserved: view.familyWorkspacePreserved,
        aiPackEntitlementValid: view.aiPackEntitlementValid,
      });
      setBillingDetails({ renewsAt: view.renewsAt, cancelAtPeriodEnd: view.cancelAtPeriodEnd, scheduledCancellationAt: view.scheduledCancellationAt, hasAIPack: view.hasAIPack, aiPackItemExists: view.aiPackItemExists, aiPackStatus: view.aiPackStatus, aiPackPaidThrough: view.aiPackPaidThrough, aiPackCancelAtPeriodEnd: view.aiPackCancelAtPeriodEnd, aiPackScheduledRemovalAt: view.aiPackScheduledRemovalAt, aiPackRemovalPending: view.aiPackRemovalPending, aiPackResumePending: view.aiPackResumePending, planChangeStatus: view.planChangeStatus, planChangeFailure: view.planChangeFailure, hasStripeCustomer: view.hasStripeCustomer, interval: view.interval });
      setError(null);
    }).catch((cause) => {
      if (cancelled) return;
      setError(cause instanceof Error ? cause : new Error('Unable to load billing state'));
      setScheduleConfirmation({ required: false, released: false });
      setEntitlements(null);
      setBillingDetails(null);
      setScheduledDowngrade(null);
      setCanManageFamilyBilling(false);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.uid, refreshTrigger]);

  useEffect(() => {
    if (!user?.uid) return;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        refresh();
      }, 100);
    };
    const unsubscribe = subscribeToBillingSignals(
      (target, onChange) => onSnapshot(
        doc(db, target.collection, target.id),
        () => onChange(),
        () => undefined,
      ),
      user.uid,
      entitlements?.familyId || null,
      scheduleRefresh,
    );
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      unsubscribe();
    };
  }, [user?.uid, entitlements?.familyId, refresh]);

  const plan = entitlements?.plan || 'free';
  const canonicalPlan = entitlements?.canonicalPlan || plan;
  const canonicalStatus = entitlements?.canonicalStatus || entitlements?.status || 'none';
  const effectivePaidEntitlement = entitlements?.effectivePaidEntitlement ?? plan !== 'free';
  const paymentAttentionRequired = entitlements?.paymentAttentionRequired ?? false;
  const entitlementReason = entitlements?.entitlementReason || (effectivePaidEntitlement ? 'active' : 'free_plan');
  const familyWorkspacePreserved = entitlements?.familyWorkspacePreserved ?? Boolean(entitlements?.familyId);
  const aiPackEntitlementValid = entitlements?.aiPackEntitlementValid ?? Boolean(billingDetails?.hasAIPack);
  const limits = entitlements?.limits || PLAN_LIMITS.free;
  const usage = entitlements?.usage || DEFAULT_USER_USAGE;
  const aiRemaining = Math.max(0, limits.aiActionsAllowance - usage.aiActionsUsed);
  const exportsRemaining = limits.exportLimitPerMonth === null ? null : Math.max(0, limits.exportLimitPerMonth - usage.exportsUsed);
  return {
    billingViewUid,
    billingReadStartedAt,
    billingScheduleCleanupRequired: scheduleConfirmation.required,
    billingScheduleReleaseConfirmed: scheduleConfirmation.released,
    scheduledDowngrade, canManageFamilyBilling,
    entitlements, loading, error, plan,
    canonicalPlan, canonicalStatus, effectivePaidEntitlement, paymentAttentionRequired,
    entitlementReason, familyWorkspacePreserved, aiPackEntitlementValid,
    isPro: plan === 'pro', isFamily: plan === 'family', isFree: plan === 'free', limits,
    aiRemaining, exportsRemaining,
    storageUsedBytes: usage.storageUsedBytes || 0,
    storageQuotaBytes: limits.storageQuotaBytes,
    subscriptionStatus: entitlements?.status || 'none',
    billingInterval: billingDetails?.interval || null,
    renewsAt: billingDetails?.renewsAt || null,
    cancelAtPeriodEnd: billingDetails?.cancelAtPeriodEnd || false,
    scheduledCancellationAt: billingDetails?.scheduledCancellationAt || null,
    hasAIPack: billingDetails?.hasAIPack || false,
    aiPackItemExists: billingDetails?.aiPackItemExists || false,
    aiPackStatus: billingDetails?.aiPackStatus || 'none',
    aiPackPaidThrough: billingDetails?.aiPackPaidThrough || null,
    aiPackCancelAtPeriodEnd: billingDetails?.aiPackCancelAtPeriodEnd || false,
    aiPackScheduledRemovalAt: billingDetails?.aiPackScheduledRemovalAt || null,
    aiPackRemovalPending: billingDetails?.aiPackRemovalPending || false,
    aiPackResumePending: billingDetails?.aiPackResumePending || false,
    planChangeStatus: billingDetails?.planChangeStatus || 'none',
    planChangeFailure: billingDetails?.planChangeFailure || null,
    hasStripeCustomer: billingDetails?.hasStripeCustomer || false,
    canCreateTree: () => limits.maxTrees === null,
    canUseAI: (actionsNeeded = 1) => !loading && aiRemaining >= actionsNeeded,
    canExportPngPdf: () => !loading && (exportsRemaining === null || exportsRemaining > 0),
    canExportGedcom: () => !loading && limits.allowGedcomExport,
    shouldWatermark: () => limits.watermarkExports,
    refresh,
  };
}

export function useCanPerformAction(action: 'createTree' | 'addPerson' | 'invite' | 'export' | 'useAI' | 'upload') {
  const { isFree, limits, aiRemaining, exportsRemaining, loading } = useEntitlements();
  if (loading) return { allowed: false, loading: true };
  if (action === 'useAI' && aiRemaining <= 0) return { allowed: false, loading: false, reason: isFree ? 'You have used your Free AI allowance.' : 'You have used your available AI actions.' };
  if (action === 'export' && exportsRemaining !== null && exportsRemaining <= 0) return { allowed: false, loading: false, reason: 'Monthly export limit reached.' };
  if (action === 'invite' && limits.maxCollaboratorsPerTree <= 0) return { allowed: false, loading: false, reason: 'Collaboration is unavailable for this plan.' };
  return { allowed: true, loading: false };
}
