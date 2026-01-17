/**
 * Usage Tracking Service for KonnectedRoots
 * 
 * Handles incrementing/decrementing usage counters with lazy monthly reset.
 */

import { db } from '@/lib/firebase/clients';
import { doc, getDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import type { UserUsage, FamilyUsage, Plan } from './types';
import { getCurrentMonthKey, PLAN_LIMITS, getAIAllowance } from './constants';
import { DEFAULT_USER_USAGE } from './types';

/**
 * Get or create usage document for a user
 */
async function getOrCreateUsage(uid: string): Promise<UserUsage> {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
        return DEFAULT_USER_USAGE;
    }

    return userDoc.data().usage || DEFAULT_USER_USAGE;
}

/**
 * Lazy reset: Check if usage needs to be reset for new month
 * If so, reset and return new usage object
 */
async function lazyResetIfNeeded(
    uid: string,
    usage: UserUsage,
    plan: 'free' | 'pro' | 'family',
    hasAIPack: boolean
): Promise<UserUsage> {
    const currentMonth = getCurrentMonthKey();

    if (usage.monthKey === currentMonth) {
        // No reset needed
        return usage;
    }

    // Reset counters for new month
    const newUsage: UserUsage = {
        monthKey: currentMonth,
        exportsUsed: 0,
        aiActionsUsed: 0,
        aiActionsAllowance: getAIAllowance(plan, hasAIPack),
        storageUsedBytes: usage.storageUsedBytes, // Storage doesn't reset
    };

    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { usage: newUsage });

    return newUsage;
}

/**
 * Increment export counter
 * Returns false if limit reached
 */
export async function incrementExportCount(uid: string): Promise<{
    success: boolean;
    newCount: number;
    limit: number | null;
}> {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
        return { success: false, newCount: 0, limit: 2 };
    }

    const data = userDoc.data();
    const billing = data.billing || { plan: 'free', addons: { aiPack: false } };
    const usage: UserUsage = data.usage || DEFAULT_USER_USAGE;

    // Lazy reset if new month
    const currentUsage = await lazyResetIfNeeded(
        uid,
        usage,
        billing.plan || 'free',
        billing.addons?.aiPack || false
    );

    const plan = (billing.plan || 'free') as Plan;
    const limit = PLAN_LIMITS[plan].exportLimitPerMonth;

    // Check if unlimited
    if (limit === null) {
        await updateDoc(userRef, {
            'usage.exportsUsed': increment(1),
        });
        return { success: true, newCount: currentUsage.exportsUsed + 1, limit: null };
    }

    // Check limit
    if (currentUsage.exportsUsed >= limit) {
        return { success: false, newCount: currentUsage.exportsUsed, limit };
    }

    // Increment
    await updateDoc(userRef, {
        'usage.exportsUsed': increment(1),
    });

    return { success: true, newCount: currentUsage.exportsUsed + 1, limit };
}

/**
 * Consume AI actions
 * Returns false if not enough credits
 */
export async function consumeAIActions(
    uid: string,
    actionsToConsume: number = 1
): Promise<{
    success: boolean;
    remaining: number;
    consumed: number;
}> {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
        return { success: false, remaining: 0, consumed: 0 };
    }

    const data = userDoc.data();
    const billing = data.billing || { plan: 'free', addons: { aiPack: false } };
    const usage: UserUsage = data.usage || DEFAULT_USER_USAGE;
    const familyInfo = data.family || { familyId: null };

    // If in family, charge family pool instead
    if (familyInfo.familyId && billing.plan === 'family') {
        return consumeFamilyAIActions(familyInfo.familyId, actionsToConsume);
    }

    // Lazy reset if new month
    const currentUsage = await lazyResetIfNeeded(
        uid,
        usage,
        billing.plan || 'free',
        billing.addons?.aiPack || false
    );

    const allowance = getAIAllowance(billing.plan || 'free', billing.addons?.aiPack || false);
    const remaining = allowance - currentUsage.aiActionsUsed;

    // Check if enough credits
    if (remaining < actionsToConsume) {
        return { success: false, remaining, consumed: 0 };
    }

    // Consume
    await updateDoc(userRef, {
        'usage.aiActionsUsed': increment(actionsToConsume),
    });

    return {
        success: true,
        remaining: remaining - actionsToConsume,
        consumed: actionsToConsume,
    };
}

/**
 * Consume AI actions from family pool
 */
async function consumeFamilyAIActions(
    familyId: string,
    actionsToConsume: number
): Promise<{
    success: boolean;
    remaining: number;
    consumed: number;
}> {
    const familyRef = doc(db, 'families', familyId);
    const familyDoc = await getDoc(familyRef);

    if (!familyDoc.exists()) {
        return { success: false, remaining: 0, consumed: 0 };
    }

    const data = familyDoc.data();
    const usage: FamilyUsage = data.usage || {
        monthKey: '',
        exportsUsed: 0,
        aiActionsUsed: 0,
        aiActionsAllowance: 600,
        storageUsedBytes: 0,
    };

    const currentMonth = getCurrentMonthKey();

    // Check if needs reset
    if (usage.monthKey !== currentMonth) {
        const hasAIPack = data.plan?.addons?.aiPack || false;
        const newAllowance = getAIAllowance('family', hasAIPack);

        await updateDoc(familyRef, {
            'usage.monthKey': currentMonth,
            'usage.exportsUsed': 0,
            'usage.aiActionsUsed': 0,
            'usage.aiActionsAllowance': newAllowance,
        });

        // Fresh month, all actions available
        if (actionsToConsume > newAllowance) {
            return { success: false, remaining: newAllowance, consumed: 0 };
        }

        await updateDoc(familyRef, {
            'usage.aiActionsUsed': actionsToConsume,
        });

        return {
            success: true,
            remaining: newAllowance - actionsToConsume,
            consumed: actionsToConsume,
        };
    }

    const remaining = usage.aiActionsAllowance - usage.aiActionsUsed;

    if (remaining < actionsToConsume) {
        return { success: false, remaining, consumed: 0 };
    }

    await updateDoc(familyRef, {
        'usage.aiActionsUsed': increment(actionsToConsume),
    });

    return {
        success: true,
        remaining: remaining - actionsToConsume,
        consumed: actionsToConsume,
    };
}

/**
 * Update storage used (increment or decrement)
 */
export async function updateStorageUsed(
    uid: string,
    deltaBytes: number // positive = added, negative = removed
): Promise<{
    success: boolean;
    newTotal: number;
    quota: number;
}> {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
        return { success: false, newTotal: 0, quota: PLAN_LIMITS.free.storageQuotaBytes };
    }

    const data = userDoc.data();
    const billing = data.billing || { plan: 'free' };
    const usage: UserUsage = data.usage || DEFAULT_USER_USAGE;
    const familyInfo = data.family || { familyId: null };

    const plan = (billing.plan || 'free') as Plan;
    const quota = PLAN_LIMITS[plan].storageQuotaBytes;

    // If in family, update family storage instead
    if (familyInfo.familyId && billing.plan === 'family') {
        return updateFamilyStorageUsed(familyInfo.familyId, deltaBytes);
    }

    const currentUsed = usage.storageUsedBytes || 0;
    const newTotal = Math.max(0, currentUsed + deltaBytes);

    // Check quota for additions
    if (deltaBytes > 0 && newTotal > quota) {
        return { success: false, newTotal: currentUsed, quota };
    }

    await updateDoc(userRef, {
        'usage.storageUsedBytes': newTotal,
    });

    return { success: true, newTotal, quota };
}

/**
 * Update family storage used
 */
async function updateFamilyStorageUsed(
    familyId: string,
    deltaBytes: number
): Promise<{
    success: boolean;
    newTotal: number;
    quota: number;
}> {
    const familyRef = doc(db, 'families', familyId);
    const familyDoc = await getDoc(familyRef);

    if (!familyDoc.exists()) {
        return { success: false, newTotal: 0, quota: PLAN_LIMITS.family.storageQuotaBytes };
    }

    const data = familyDoc.data();
    const usage: FamilyUsage = data.usage || { storageUsedBytes: 0 };
    const quota = PLAN_LIMITS.family.storageQuotaBytes;

    const currentUsed = usage.storageUsedBytes || 0;
    const newTotal = Math.max(0, currentUsed + deltaBytes);

    if (deltaBytes > 0 && newTotal > quota) {
        return { success: false, newTotal: currentUsed, quota };
    }

    await updateDoc(familyRef, {
        'usage.storageUsedBytes': newTotal,
    });

    return { success: true, newTotal, quota };
}

/**
 * Calculate AI actions needed based on token usage
 * Per spec: 1 action = 1000 input + 500 output tokens, cap at 5
 */
export function calculateAIActionsNeeded(
    inputTokens: number,
    outputTokens: number
): number {
    const inputActions = Math.ceil(inputTokens / 1000);
    const outputActions = Math.ceil(outputTokens / 500);
    const actions = Math.max(inputActions, outputActions);
    return Math.min(actions, 5); // Cap at 5
}
