/**
 * React hook for accessing user entitlements
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase/clients';
import { doc, onSnapshot } from 'firebase/firestore';
import type {
    Plan,
    Entitlements,
    UserBilling,
    UserUsage,
    UserFamily,
    PlanLimits,
} from '@/lib/billing/types';
import {
    PLAN_LIMITS,
    getAIAllowance,
    getCurrentMonthKey,
    needsMonthlyReset,
} from '@/lib/billing/constants';
import {
    DEFAULT_USER_BILLING,
    DEFAULT_USER_USAGE,
    DEFAULT_USER_FAMILY,
} from '@/lib/billing/types';

interface UseEntitlementsReturn {
    entitlements: Entitlements | null;
    loading: boolean;
    error: Error | null;
    // Convenience getters
    plan: Plan;
    isPro: boolean;
    isFamily: boolean;
    isFree: boolean;
    limits: PlanLimits;
    // Usage
    aiRemaining: number;
    exportsRemaining: number | null; // null = unlimited
    storageUsedBytes: number;
    storageQuotaBytes: number;
    // Helpers
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
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const refresh = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

    useEffect(() => {
        if (!user?.uid) {
            setEntitlements(null);
            setLoading(false);
            return;
        }

        setLoading(true);

        // Subscribe to user document for real-time updates
        const unsubscribe = onSnapshot(
            doc(db, 'users', user.uid),
            async (snapshot) => {
                try {
                    const data = snapshot.exists() ? snapshot.data() : {};
                    const billing: UserBilling = data.billing || DEFAULT_USER_BILLING;
                    const usage: UserUsage = data.usage || DEFAULT_USER_USAGE;
                    const family: UserFamily = data.family || DEFAULT_USER_FAMILY;

                    let effectivePlan: Plan = billing.plan || 'free';
                    let isFamily = false;
                    let familyId: string | null = null;
                    let effectiveUsage = usage;

                    // Check if part of a family plan
                    if (family.familyId) {
                        // For now, just mark as family - full family doc subscription would need separate listener
                        isFamily = true;
                        familyId = family.familyId;
                        // In a full implementation, we'd subscribe to the family doc too
                        // For now, we'll use the user's billing which should be synced
                        if (billing.plan === 'family') {
                            effectivePlan = 'family';
                        }
                    }

                    const baseLimits = PLAN_LIMITS[effectivePlan];
                    const hasAIPack = billing.addons?.aiPack || false;
                    const aiActionsAllowance = getAIAllowance(effectivePlan, hasAIPack);

                    const limits: PlanLimits = {
                        ...baseLimits,
                        aiActionsAllowance,
                    };

                    const ent: Entitlements = {
                        plan: effectivePlan,
                        status: billing.status || 'none',
                        limits,
                        usage: effectiveUsage,
                        isFamily,
                        familyId,
                    };

                    setEntitlements(ent);
                    setError(null);
                } catch (err) {
                    console.error('Error processing entitlements:', err);
                    setError(err instanceof Error ? err : new Error('Unknown error'));
                } finally {
                    setLoading(false);
                }
            },
            (err) => {
                console.error('Error subscribing to user doc:', err);
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [user?.uid, refreshTrigger]);

    // Compute convenience values
    const plan = entitlements?.plan || 'free';
    const limits = entitlements?.limits || PLAN_LIMITS.free;
    const usage = entitlements?.usage || DEFAULT_USER_USAGE;

    // Check if usage needs monthly reset
    const monthKey = getCurrentMonthKey();
    const needsReset = needsMonthlyReset(usage.monthKey);

    const aiUsed = needsReset ? 0 : usage.aiActionsUsed;
    const aiRemaining = limits.aiActionsAllowance - aiUsed;

    const exportsUsed = needsReset ? 0 : usage.exportsUsed;
    const exportsRemaining = limits.exportLimitPerMonth === null
        ? null
        : limits.exportLimitPerMonth - exportsUsed;

    return {
        entitlements,
        loading,
        error,
        plan,
        isPro: plan === 'pro',
        isFamily: plan === 'family',
        isFree: plan === 'free',
        limits,
        aiRemaining: Math.max(0, aiRemaining),
        exportsRemaining,
        storageUsedBytes: usage.storageUsedBytes || 0,
        storageQuotaBytes: limits.storageQuotaBytes,
        canCreateTree: () => {
            if (limits.maxTrees === null) return true;
            // This would need tree count from a separate query
            // For now, return true - actual check happens server-side
            return true;
        },
        canUseAI: (actionsNeeded = 1) => {
            return aiRemaining >= actionsNeeded;
        },
        canExportPngPdf: () => {
            if (exportsRemaining === null) return true;
            return exportsRemaining > 0;
        },
        canExportGedcom: () => {
            return limits.allowGedcomExport;
        },
        shouldWatermark: () => {
            return limits.watermarkExports;
        },
        refresh,
    };
}

/**
 * Hook to check if a specific action is allowed
 */
export function useCanPerformAction(
    action: 'createTree' | 'addPerson' | 'invite' | 'export' | 'useAI' | 'upload'
): { allowed: boolean; loading: boolean; reason?: string } {
    const { isFree, limits, aiRemaining, exportsRemaining, loading } = useEntitlements();

    if (loading) {
        return { allowed: false, loading: true };
    }

    switch (action) {
        case 'createTree':
            if (limits.maxTrees === null) {
                return { allowed: true, loading: false };
            }
            // Would need tree count check
            return { allowed: true, loading: false };

        case 'useAI':
            if (aiRemaining <= 0) {
                return {
                    allowed: false,
                    loading: false,
                    reason: isFree
                        ? 'You\'ve used all 10 AI actions this month. Upgrade to Pro for 200 actions.'
                        : 'You\'ve used all your AI actions. Add the AI Pack for 1,000 more.',
                };
            }
            return { allowed: true, loading: false };

        case 'export':
            if (exportsRemaining !== null && exportsRemaining <= 0) {
                return {
                    allowed: false,
                    loading: false,
                    reason: 'You\'ve used your 2 free exports this month. Upgrade for unlimited exports.',
                };
            }
            return { allowed: true, loading: false };

        default:
            return { allowed: true, loading: false };
    }
}
