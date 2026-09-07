import { adminAuth, adminDb } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';
import { getCurrentMonthKey, getAIAllowance, AI_ACTION_WEIGHTS, PLAN_LIMITS } from './constants';
import { DEFAULT_USER_USAGE } from './types';
import type { UserUsage, Plan } from './types';

export interface VerifyAndDeductResult {
    success: boolean;
    uid?: string;
    error?: string;
    cost?: number;
}

/**
 * Verifies the user's Firebase Auth ID token and atomically deducts the appropriate
 * number of AI action credits using the Firebase Admin SDK.
 * 
 * Also updates `lastActivityAt` for inactivity tracking.
 */
export async function verifyAuthAndDeductAICredits(
    idToken: string | undefined,
    actionType: keyof typeof AI_ACTION_WEIGHTS
): Promise<VerifyAndDeductResult> {
    if (!idToken) {
        return { success: false, error: "Authentication required to use AI features. Please sign in." };
    }

    let uid: string;
    try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        uid = decoded.uid;
    } catch (err) {
        console.error("Token verification failed in AI server action:", err);
        return { success: false, error: "Invalid or expired session. Please sign in again." };
    }

    const cost = AI_ACTION_WEIGHTS[actionType] ?? 1;
    const userRef = adminDb.collection('users').doc(uid);

    try {
        const result = await adminDb.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) {
                return { success: false, error: "User profile record not found." };
            }

            const userData = userDoc.data() || {};
            const billing = userData.billing || { plan: 'free', addons: { aiPack: false } };
            let usage: UserUsage = userData.usage || DEFAULT_USER_USAGE;
            const currentMonth = getCurrentMonthKey();
            const plan = billing.plan || 'free';
            const hasAIPack = billing.addons?.aiPack || false;
            const allowance = getAIAllowance(plan, hasAIPack);

            // Lazy monthly reset if new month
            if (usage.monthKey !== currentMonth) {
                usage = {
                    monthKey: currentMonth,
                    exportsUsed: 0,
                    aiActionsUsed: 0,
                    aiActionsAllowance: allowance,
                    storageUsedBytes: usage.storageUsedBytes || 0,
                };
            }

            const remaining = allowance - (usage.aiActionsUsed || 0);
            if (remaining < cost) {
                return {
                    success: false,
                    error: `Insufficient AI credits. This action requires ${cost} credit(s), but you have ${Math.max(0, remaining)} remaining this month.`,
                };
            }

            // Deduct credits and track user activity
            transaction.update(userRef, {
                'usage.monthKey': usage.monthKey,
                'usage.aiActionsAllowance': allowance,
                'usage.aiActionsUsed': (usage.aiActionsUsed || 0) + cost,
                lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            return { success: true };
        });

        if (!result.success) {
            return { success: false, error: result.error };
        }

        return { success: true, uid, cost };
    } catch (error) {
        console.error("Error verifying and deducting AI credits:", error);
        return { success: false, error: "Failed to verify credit balance. Please try again." };
    }
}

/**
 * Refunds consumed AI credits if the downstream AI flow execution fails.
 */
export async function refundAICredits(uid: string, cost: number): Promise<void> {
    if (!uid || cost <= 0) return;
    try {
        const userRef = adminDb.collection('users').doc(uid);
        await userRef.update({
            'usage.aiActionsUsed': admin.firestore.FieldValue.increment(-cost),
        });
    } catch (error) {
        console.error(`Failed to refund ${cost} AI credits to user ${uid}:`, error);
    }
}

/**
 * Checks export limits and records a tree export on the server.
 */
export async function recordExportOnServer(idToken: string | undefined): Promise<{
    success: boolean;
    error?: string;
    exportsUsed?: number;
    limit?: number | null;
}> {
    if (!idToken) {
        return { success: false, error: "Authentication required to export trees." };
    }

    let uid: string;
    try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        uid = decoded.uid;
    } catch {
        return { success: false, error: "Invalid or expired session. Please sign in." };
    }

    const userRef = adminDb.collection('users').doc(uid);

    try {
        return await adminDb.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) {
                return { success: false, error: "User profile not found." };
            }

            const userData = userDoc.data() || {};
            const billing = userData.billing || { plan: 'free' };
            let usage: UserUsage = userData.usage || DEFAULT_USER_USAGE;
            const currentMonth = getCurrentMonthKey();
            const plan = (billing.plan || 'free') as Plan;
            const limit = PLAN_LIMITS[plan]?.exportLimitPerMonth ?? 2;

            // Monthly reset if needed
            if (usage.monthKey !== currentMonth) {
                usage = {
                    monthKey: currentMonth,
                    exportsUsed: 0,
                    aiActionsUsed: 0,
                    aiActionsAllowance: getAIAllowance(plan, Boolean(billing.addons?.aiPack)),
                    storageUsedBytes: usage.storageUsedBytes || 0,
                };
            }

            if (limit !== null && (usage.exportsUsed || 0) >= limit) {
                return {
                    success: false,
                    error: `Monthly export limit reached (${limit} exports/month on ${plan} plan). Please upgrade to Pro for unlimited exports.`,
                    exportsUsed: usage.exportsUsed,
                    limit,
                };
            }

            const newExportsUsed = (usage.exportsUsed || 0) + 1;
            transaction.update(userRef, {
                'usage.monthKey': usage.monthKey,
                'usage.exportsUsed': newExportsUsed,
                lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            return {
                success: true,
                exportsUsed: newExportsUsed,
                limit,
            };
        });
    } catch (error) {
        console.error("Error recording export:", error);
        return { success: false, error: "Failed to record export." };
    }
}
