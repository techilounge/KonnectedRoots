/**
 * Entitlements Service for KonnectedRoots
 * 
 * Central logic for checking user entitlements based on their plan.
 * Handles both individual users and family plan members.
 */

import { db } from '@/lib/firebase/clients';
import { doc, getDoc } from 'firebase/firestore';
import type {
    Plan,
    Entitlements,
    UserBilling,
    UserUsage,
    UserFamily,
    FamilyUsage,
    PlanLimits,
} from './types';
import {
    PLAN_LIMITS,
    AI_PACK_BONUS_ACTIONS,
    getCurrentMonthKey,
    needsMonthlyReset,
    getAIAllowance,
} from './constants';
import {
    DEFAULT_USER_BILLING,
    DEFAULT_USER_USAGE,
    DEFAULT_USER_FAMILY,
} from './types';

/**
 * Get a user's billing information from Firestore
 */
export async function getUserBilling(uid: string): Promise<{
    billing: UserBilling;
    usage: UserUsage;
    family: UserFamily;
}> {
    const userDoc = await getDoc(doc(db, 'users', uid));

    if (!userDoc.exists()) {
        return {
            billing: DEFAULT_USER_BILLING,
            usage: DEFAULT_USER_USAGE,
            family: DEFAULT_USER_FAMILY,
        };
    }

    const data = userDoc.data();
    return {
        billing: data.billing || DEFAULT_USER_BILLING,
        usage: data.usage || DEFAULT_USER_USAGE,
        family: data.family || DEFAULT_USER_FAMILY,
    };
}

/**
 * Get family usage (for family plan members)
 */
export async function getFamilyUsage(familyId: string): Promise<FamilyUsage | null> {
    const familyDoc = await getDoc(doc(db, 'families', familyId));

    if (!familyDoc.exists()) {
        return null;
    }

    return familyDoc.data().usage || null;
}

/**
 * Get complete entitlements for a user
 */
export async function getEntitlements(uid: string): Promise<Entitlements> {
    const { billing, usage, family } = await getUserBilling(uid);

    // Determine effective plan
    let effectivePlan: Plan = billing.plan;
    let isFamily = false;
    let familyId: string | null = null;
    let effectiveUsage: UserUsage | FamilyUsage = usage;

    // If user is part of a family, use family's plan and pooled usage
    if (family.familyId) {
        isFamily = true;
        familyId = family.familyId;

        const familyDoc = await getDoc(doc(db, 'families', family.familyId));
        if (familyDoc.exists()) {
            const familyData = familyDoc.data();
            if (familyData.plan?.status === 'active' || familyData.plan?.status === 'trialing') {
                effectivePlan = 'family';
                effectiveUsage = familyData.usage || usage;
            }
        }
    }

    // Get base limits for the plan
    const baseLimits = PLAN_LIMITS[effectivePlan];

    // Adjust AI allowance based on AI Pack add-on
    const hasAIPack = billing.addons?.aiPack || false;
    const aiActionsAllowance = getAIAllowance(effectivePlan, hasAIPack);

    const limits: PlanLimits = {
        ...baseLimits,
        aiActionsAllowance,
    };

    return {
        plan: effectivePlan,
        status: billing.status,
        limits,
        usage: effectiveUsage,
        isFamily,
        familyId,
    };
}

/**
 * Check if user can create more trees
 */
export async function canCreateTree(uid: string): Promise<{
    allowed: boolean;
    reason?: string;
    currentCount?: number;
    limit?: number | null;
}> {
    const entitlements = await getEntitlements(uid);
    const { maxTrees } = entitlements.limits;

    // Unlimited trees
    if (maxTrees === null) {
        return { allowed: true };
    }

    // Count user's trees
    const { getDocs, collection, query, where } = await import('firebase/firestore');
    const treesQuery = query(
        collection(db, 'trees'),
        where('ownerId', '==', uid)
    );
    const treesSnap = await getDocs(treesQuery);
    const currentCount = treesSnap.size;

    if (currentCount >= maxTrees) {
        return {
            allowed: false,
            reason: `You've reached the maximum of ${maxTrees} trees on the Free plan. Upgrade to Pro for unlimited trees.`,
            currentCount,
            limit: maxTrees,
        };
    }

    return { allowed: true, currentCount, limit: maxTrees };
}

/**
 * Check if user can add more people to a tree
 */
export async function canAddPerson(
    uid: string,
    treeId: string
): Promise<{
    allowed: boolean;
    reason?: string;
    currentCount?: number;
    limit?: number | null;
}> {
    const entitlements = await getEntitlements(uid);
    const { maxPeoplePerTree } = entitlements.limits;

    // Unlimited people
    if (maxPeoplePerTree === null) {
        return { allowed: true };
    }

    // Get tree's people count
    const treeDoc = await getDoc(doc(db, 'trees', treeId));
    if (!treeDoc.exists()) {
        return { allowed: false, reason: 'Tree not found' };
    }

    const currentCount = treeDoc.data().memberCount || 0;

    if (currentCount >= maxPeoplePerTree) {
        return {
            allowed: false,
            reason: `This tree has reached the maximum of ${maxPeoplePerTree} people on the Free plan. Upgrade to Pro for unlimited family members.`,
            currentCount,
            limit: maxPeoplePerTree,
        };
    }

    return { allowed: true, currentCount, limit: maxPeoplePerTree };
}

/**
 * Check if user can invite more collaborators
 */
export async function canInviteCollaborator(
    uid: string,
    treeId: string,
    role: 'viewer' | 'editor' | 'manager'
): Promise<{
    allowed: boolean;
    reason?: string;
    roleAllowed?: boolean;
}> {
    const entitlements = await getEntitlements(uid);
    const { maxCollaboratorsPerTree, allowedCollaboratorRoles } = entitlements.limits;

    // Check if role is allowed on this plan
    if (!allowedCollaboratorRoles.includes(role)) {
        return {
            allowed: false,
            reason: `${role.charAt(0).toUpperCase() + role.slice(1)} role is not available on the Free plan. Upgrade to Pro to invite Editors and Managers.`,
            roleAllowed: false,
        };
    }

    // Get current collaborator count
    const treeDoc = await getDoc(doc(db, 'trees', treeId));
    if (!treeDoc.exists()) {
        return { allowed: false, reason: 'Tree not found' };
    }

    const collaborators = treeDoc.data().collaborators || {};
    const currentCount = Object.keys(collaborators).length;

    if (currentCount >= maxCollaboratorsPerTree) {
        return {
            allowed: false,
            reason: `You've reached the maximum of ${maxCollaboratorsPerTree} collaborators on your plan. Upgrade for more collaboration.`,
        };
    }

    return { allowed: true, roleAllowed: true };
}

/**
 * Check if user can export
 */
export async function canExport(
    uid: string,
    exportType: 'png' | 'pdf' | 'gedcom'
): Promise<{
    allowed: boolean;
    reason?: string;
    watermark?: boolean;
    remaining?: number | null;
}> {
    const entitlements = await getEntitlements(uid);
    const { exportLimitPerMonth, watermarkExports, allowGedcomExport } = entitlements.limits;

    // Check GEDCOM permission
    if (exportType === 'gedcom' && !allowGedcomExport) {
        return {
            allowed: false,
            reason: 'GEDCOM export is only available on Pro and Family plans.',
        };
    }

    // Unlimited exports
    if (exportLimitPerMonth === null) {
        return { allowed: true, watermark: watermarkExports };
    }

    // Check monthly limit
    const usage = entitlements.usage;

    // Check if needs reset (lazy reset will happen on actual export)
    const exportsUsed = needsMonthlyReset(usage.monthKey) ? 0 : usage.exportsUsed;
    const remaining = exportLimitPerMonth - exportsUsed;

    if (remaining <= 0) {
        return {
            allowed: false,
            reason: `You've used your ${exportLimitPerMonth} free exports this month. Upgrade to Pro for unlimited exports.`,
            remaining: 0,
        };
    }

    return {
        allowed: true,
        watermark: watermarkExports,
        remaining,
    };
}

/**
 * Check if user can use AI features
 */
export async function canUseAI(
    uid: string,
    actionsNeeded: number = 1
): Promise<{
    allowed: boolean;
    reason?: string;
    remaining?: number;
}> {
    const entitlements = await getEntitlements(uid);
    const usage = entitlements.usage;

    // Calculate remaining (with lazy reset consideration)
    const monthKey = getCurrentMonthKey();
    let aiActionsUsed = usage.aiActionsUsed;
    let allowance = entitlements.limits.aiActionsAllowance;

    if (needsMonthlyReset(usage.monthKey)) {
        aiActionsUsed = 0;
    }

    const remaining = allowance - aiActionsUsed;

    if (remaining < actionsNeeded) {
        return {
            allowed: false,
            reason: `You've used all ${allowance} AI actions this month. ${entitlements.plan === 'free'
                    ? 'Upgrade to Pro for 200 AI actions/month.'
                    : 'Add the AI Pack for 1,000 extra actions/month.'
                }`,
            remaining: Math.max(0, remaining),
        };
    }

    return { allowed: true, remaining };
}

/**
 * Check if user can upload (storage quota)
 */
export async function canUpload(
    uid: string,
    fileSizeBytes: number
): Promise<{
    allowed: boolean;
    reason?: string;
    usedBytes?: number;
    quotaBytes?: number;
}> {
    const entitlements = await getEntitlements(uid);
    const { storageQuotaBytes } = entitlements.limits;
    const usage = entitlements.usage;

    const usedBytes = usage.storageUsedBytes || 0;
    const availableBytes = storageQuotaBytes - usedBytes;

    if (fileSizeBytes > availableBytes) {
        return {
            allowed: false,
            reason: `Upload would exceed your storage quota. You have ${Math.round(availableBytes / (1024 * 1024))}MB remaining.`,
            usedBytes,
            quotaBytes: storageQuotaBytes,
        };
    }

    return { allowed: true, usedBytes, quotaBytes: storageQuotaBytes };
}

/**
 * Get summary of entitlements for display
 */
export function getEntitlementsSummary(entitlements: Entitlements): {
    planDisplay: string;
    features: string[];
} {
    const planNames: Record<Plan, string> = {
        free: 'Free',
        pro: 'Pro',
        family: 'Family',
    };

    const features: string[] = [];
    const limits = entitlements.limits;

    if (limits.maxTrees === null) {
        features.push('Unlimited trees');
    } else {
        features.push(`Up to ${limits.maxTrees} trees`);
    }

    if (limits.maxPeoplePerTree === null) {
        features.push('Unlimited family members');
    } else {
        features.push(`Up to ${limits.maxPeoplePerTree} people per tree`);
    }

    features.push(`${limits.maxCollaboratorsPerTree} collaborators per tree`);
    features.push(`${limits.aiActionsAllowance} AI actions/month`);

    if (limits.allowGedcomExport) {
        features.push('GEDCOM import/export');
    }

    if (!limits.watermarkExports) {
        features.push('Watermark-free exports');
    }

    return {
        planDisplay: planNames[entitlements.plan],
        features,
    };
}
