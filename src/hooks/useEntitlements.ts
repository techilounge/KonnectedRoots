/** Client view of server-resolved billing. It never treats a browser Firestore write as authority. */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getAuthoritativeBillingView } from '@/app/billing/actions';
import type { Entitlements, PlanLimits, Plan } from '@/lib/billing/types';
import { PLAN_LIMITS } from '@/lib/billing/constants';
import { DEFAULT_USER_USAGE } from '@/lib/billing/types';

interface UseEntitlementsReturn {
  entitlements: Entitlements | null;
  loading: boolean;
  error: Error | null;
  plan: Plan;
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
  hasAIPack: boolean;
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
  const [billingDetails, setBillingDetails] = useState<{ renewsAt: number | null; cancelAtPeriodEnd: boolean; hasAIPack: boolean; hasStripeCustomer: boolean; interval: 'month' | 'year' | null } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const refresh = useCallback(() => setRefreshTrigger((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    if (!user?.uid) {
      setEntitlements(null);
      setLoading(false);
      return () => { cancelled = true; };
    }
    setLoading(true);
    user.getIdToken().then((token) => getAuthoritativeBillingView(token)).then((view) => {
      if (cancelled) return;
      setEntitlements({ plan: view.plan, status: view.status, limits: view.limits, usage: view.usage, isFamily: view.isFamily, familyId: view.familyId });
      setBillingDetails({ renewsAt: view.renewsAt, cancelAtPeriodEnd: view.cancelAtPeriodEnd, hasAIPack: view.hasAIPack, hasStripeCustomer: view.hasStripeCustomer, interval: view.interval });
      setError(null);
    }).catch((cause) => {
      if (cancelled) return;
      setError(cause instanceof Error ? cause : new Error('Unable to load billing state'));
      setEntitlements(null);
      setBillingDetails(null);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.uid, refreshTrigger]);

  const plan = entitlements?.plan || 'free';
  const limits = entitlements?.limits || PLAN_LIMITS.free;
  const usage = entitlements?.usage || DEFAULT_USER_USAGE;
  const aiRemaining = Math.max(0, limits.aiActionsAllowance - usage.aiActionsUsed);
  const exportsRemaining = limits.exportLimitPerMonth === null ? null : Math.max(0, limits.exportLimitPerMonth - usage.exportsUsed);
  return {
    entitlements, loading, error, plan,
    isPro: plan === 'pro', isFamily: plan === 'family', isFree: plan === 'free', limits,
    aiRemaining, exportsRemaining,
    storageUsedBytes: usage.storageUsedBytes || 0,
    storageQuotaBytes: limits.storageQuotaBytes,
    subscriptionStatus: entitlements?.status || 'none',
    billingInterval: billingDetails?.interval || null,
    renewsAt: billingDetails?.renewsAt || null,
    cancelAtPeriodEnd: billingDetails?.cancelAtPeriodEnd || false,
    hasAIPack: billingDetails?.hasAIPack || false,
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
