/**
 * Plan Limits & Constants for KonnectedRoots Pricing
 * 
 * Source of truth for all plan entitlements.
 * Based on KonnectedRoots_Pricing_Specs.md
 */

import type { Plan, PlanLimits } from './types';

// Bytes constants
const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

/**
 * Plan limits configuration
 */
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
    free: {
        maxTrees: 3,
        maxPeoplePerTree: 500,
        maxCollaboratorsPerTree: 2,
        allowedCollaboratorRoles: ['viewer'], // Free tier: Viewer only
        exportLimitPerMonth: 2, // PNG + PDF combined
        watermarkExports: true,
        allowGedcomExport: false,
        allowGedcomImport: false,
        storageQuotaBytes: 1 * GB,
        aiActionsAllowance: 10,
    },
    pro: {
        maxTrees: null, // unlimited
        maxPeoplePerTree: null, // unlimited
        maxCollaboratorsPerTree: 10,
        allowedCollaboratorRoles: ['viewer', 'editor', 'manager'],
        exportLimitPerMonth: null, // unlimited
        watermarkExports: false,
        allowGedcomExport: true,
        allowGedcomImport: true,
        storageQuotaBytes: 50 * GB,
        aiActionsAllowance: 200,
    },
    family: {
        maxTrees: null, // unlimited
        maxPeoplePerTree: null, // unlimited
        maxCollaboratorsPerTree: 20,
        allowedCollaboratorRoles: ['viewer', 'editor', 'manager'],
        exportLimitPerMonth: null, // unlimited
        watermarkExports: false,
        allowGedcomExport: true,
        allowGedcomImport: true,
        storageQuotaBytes: 100 * GB, // shared across family
        aiActionsAllowance: 600, // pooled across family
    },
};

/**
 * AI Pack add-on bonus
 */
export const AI_PACK_BONUS_ACTIONS = 1000;

/**
 * Family plan seat limit
 */
export const FAMILY_SEAT_LIMIT = 6; // owner + 5 members

/**
 * Max file upload size (already enforced in storage.rules)
 */
export const MAX_FILE_SIZE_BYTES = 5 * MB;

/**
 * Stripe Price IDs (to be replaced with actual IDs after Stripe setup)
 * These are placeholders - update after creating products in Stripe
 */
export const STRIPE_PRICES = {
    pro_monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY || '',
    pro_yearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY || '',
    family_monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_FAMILY_MONTHLY || '',
    family_yearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_FAMILY_YEARLY || '',
    ai_pack_monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_AI_PACK || '',
};

/**
 * Pricing display values (USD)
 */
export const PRICING = {
    pro: {
        monthly: 5.99,
        yearly: 59.99,
        yearlySavings: '17%', // (5.99*12 - 59.99) / (5.99*12)
    },
    family: {
        monthly: 9.99,
        yearly: 99.99,
        yearlySavings: '17%',
        seats: 6,
    },
    aiPack: {
        monthly: 3.99,
        actions: 1000,
    },
};

/**
 * AI action token budgets
 * 1 AI action = up to 1,000 input tokens + 500 output tokens
 */
export const AI_ACTION_BUDGET = {
    inputTokens: 1000,
    outputTokens: 500,
    maxActionsPerRequest: 5, // cap for large requests
};

/**
 * Feature flags
 */
export const BILLING_CONFIG = {
    enableFreeTrial: false, // 7-day trial (off by default as per spec)
    trialDays: 7,
    requirePaymentForTrial: true,
};

/**
 * Helper: Get current month key
 */
export function getCurrentMonthKey(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

/**
 * Helper: Check if usage needs monthly reset
 */
export function needsMonthlyReset(storedMonthKey: string): boolean {
    return storedMonthKey !== getCurrentMonthKey();
}

/**
 * AI Action Weights (how many "credits" each action consumes)
 */
export const AI_ACTION_WEIGHTS = {
    'suggest_name': 1,
    'generate_biography': 1,
    'find_relationship': 1,
    'translate_document': 2,
    'ocr_document': 1,
    'enhance_photo': 5,
};

/**
 * Helper: Get AI allowance for a plan (including AI Pack if applicable)
 */
export function getAIAllowance(plan: Plan, hasAIPack: boolean): number {
    const base = PLAN_LIMITS[plan].aiActionsAllowance;
    return hasAIPack ? base + AI_PACK_BONUS_ACTIONS : base;
}

/**
 * Helper: Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Helper: Format storage quota for display
 */
export function formatStorageQuota(plan: Plan): string {
    const bytes = PLAN_LIMITS[plan].storageQuotaBytes;
    return formatBytes(bytes);
}
