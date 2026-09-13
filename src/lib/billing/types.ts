/**
 * Billing & Subscription Types for KonnectedRoots
 */

// Plan types
export type Plan = 'free' | 'pro' | 'family';
export type BillingInterval = 'month' | 'year' | null;
export type BillingStatus = 'none' | 'active' | 'trialing' | 'past_due' | 'unpaid' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'paused';
export type FamilyRole = 'owner' | 'member';
export type SeatStatus = 'active' | 'invited';
export type AIPackStatus = 'none' | 'pending' | 'active';
export type PlanChangeStatus = 'none' | 'pending' | 'failed';
export type EntitlementReason =
    | 'active'
    | 'trialing'
    | 'free_plan'
    | 'past_due'
    | 'payment_required'
    | 'subscription_canceled'
    | 'subscription_expired'
    | 'paid_entitlement_unavailable';

// Billing addon flags
export interface BillingAddons {
    aiPack: boolean;
}

// User billing information (stored in users/{uid}.billing)
export interface ScheduledPlanChange {
    scheduledPlan: 'pro' | null;
    scheduledInterval: 'month' | 'year' | null;
    scheduledChangeAt: number | null;
    scheduledChangeType: 'downgrade' | null;
    scheduledChangeStatus: 'scheduled' | null;
}

export interface UserBilling extends Partial<ScheduledPlanChange> {
    scheduleReconciliationStatus?: 'none' | 'scheduled' | 'partial_owned' | 'applied_pro' | 'released' | 'canceled' | 'completed' | 'unknown';
    scheduleReleaseConfirmed?: boolean;
    hasBasePlanSchedule?: boolean;
    plan: Plan;
    status: BillingStatus;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    currentPeriodEnd: number; // timestamp in ms
    cancelAtPeriodEnd: boolean;
    scheduledCancellationAt: number | null; // canonical Stripe cancellation timestamp in ms
    aiPackItemExists: boolean;
    aiPackStatus: AIPackStatus;
    aiPackPaidThrough: number | null;
    aiPackOperationId: string | null;
    aiPackRequestedAt: number | null;
    aiPackCancelAtPeriodEnd: boolean;
    aiPackScheduledRemovalAt: number | null;
    aiPackRemovalOperationId: string | null;
    aiPackRemovalRequestedAt: number | null;
    aiPackResumeOperationId: string | null;
    aiPackResumeRequestedAt: number | null;
    planChangeStatus: PlanChangeStatus;
    planChangeTarget: 'family' | null;
    planChangeInterval: BillingInterval;
    planChangeFamilyId: string | null;
    planChangeOperationId: string | null;
    planChangeRequestedAt: number | null;
    planChangeFailure: 'payment_failed' | 'payment_expired' | null;
    priceId: string | null;
    interval: BillingInterval;
    addons: BillingAddons;
    updatedAt: number;
}

// User family membership (stored in users/{uid}.family)
export interface UserFamily {
    familyId: string | null;
    role: FamilyRole | null;
    joinedAt: number | null;
}

// User usage tracking (stored in users/{uid}.usage)
export interface UserUsage {
    monthKey: string; // Format: "YYYY-MM"
    exportsUsed: number;
    aiActionsUsed: number;
    aiActionsAllowance: number;
    storageUsedBytes: number;
}

// Server-owned storage-only Family projection; exact byte accounting is deferred.
export interface StorageAuthority {
    familyId: string | null;
    ownerUid: string | null;
    plan: 'free' | 'family';
    status: 'active' | 'none';
    paidUntil: number;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    storageUsedBytes: number;
}

// Complete user document with billing
export interface UserWithBilling {
    uid: string;
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
    createdAt: number;
    billing: UserBilling;
    family: UserFamily;
    usage: UserUsage;
    storageAuthority?: StorageAuthority;
}

// Family plan structure (stored in families/{familyId})
export interface FamilyPlan extends Partial<ScheduledPlanChange> {
    plan: Plan; // preserved workspace may hold an inactive Pro/Free projection
    paidSeatEntitlementActive?: boolean;
    status: BillingStatus;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    currentPeriodEnd: number;
    cancelAtPeriodEnd: boolean;
    scheduledCancellationAt: number | null;
    aiPackItemExists: boolean;
    aiPackStatus: AIPackStatus;
    aiPackPaidThrough: number | null;
    aiPackCancelAtPeriodEnd: boolean;
    aiPackScheduledRemovalAt: number | null;
    aiPackRemovalOperationId: string | null;
    aiPackRemovalRequestedAt: number | null;
    aiPackResumeOperationId: string | null;
    aiPackResumeRequestedAt: number | null;
    priceId: string | null;
    interval: BillingInterval;
    seatLimit: number;
    addons: BillingAddons;
    updatedAt: number;
}

// Family usage (stored in families/{familyId}.usage)
export interface FamilyUsage {
    monthKey: string;
    exportsUsed: number;
    aiActionsUsed: number;
    aiActionsAllowance: number;
    storageUsedBytes: number;
}

// Complete family document
export interface Family {
    ownerUid: string;
    createdAt: number;
    plan: FamilyPlan;
    usage: FamilyUsage;
}

// Family seat (stored in families/{familyId}/seats/{uid})
export interface FamilySeat {
    uid: string;
    email: string;
    status: SeatStatus;
    invitedAt: number;
    joinedAt: number | null;
}

// Billing event for audit trail (stored in billing_events/{eventId})
export interface BillingEvent {
    eventId: string;
    type: string;
    receivedAt: number;
    processed: boolean;
    processedAt?: number;
    error?: string;
    stripeObjectId: string;
    uid: string | null;
    familyId: string | null;
}

// Plan limits (returned by entitlements service)
export interface PlanLimits {
    maxTrees: number | null; // null = unlimited
    maxPeoplePerTree: number | null;
    maxCollaboratorsPerTree: number;
    maxEditorsPerTree: number | null;
    allowedCollaboratorRoles: ('viewer' | 'editor' | 'manager')[];
    exportLimitPerMonth: number | null;
    watermarkExports: boolean;
    allowGedcomExport: boolean;
    allowGedcomImport: boolean;
    storageQuotaBytes: number;
    aiActionsAllowance: number;
}

// Complete entitlements object
export interface Entitlements {
    plan: Plan;
    status: BillingStatus;
    limits: PlanLimits;
    usage: UserUsage | FamilyUsage;
    isFamily: boolean;
    familyId: string | null;
    /** Server-reported commercial state retained for billing attention/history. */
    canonicalPlan?: Plan;
    canonicalStatus?: BillingStatus;
    effectivePaidEntitlement?: boolean;
    paymentAttentionRequired?: boolean;
    entitlementReason?: EntitlementReason;
    familyWorkspacePreserved?: boolean;
    aiPackEntitlementValid?: boolean;
}

// Stripe metadata keys (for type safety)
export interface StripeProductMetadata {
    kr_item_type: 'plan' | 'addon';
    kr_plan?: 'pro' | 'family';
    kr_addon?: 'ai_pack';
    kr_seat_limit?: string;
    kr_ai_actions?: string;
}

export interface StripePriceMetadata {
    kr_plan?: 'pro' | 'family';
    kr_addon?: 'ai_pack';
    kr_interval?: 'month' | 'year';
    kr_seat_limit?: string;
    kr_ai_actions?: string;
}

// Checkout session request
export interface CreateCheckoutRequest {
    plan: 'pro' | 'family';
    interval: 'month' | 'year';
    familyId?: string;
    addons?: {
        aiPack?: boolean;
    };
}

// Default billing values for new users
export const DEFAULT_USER_BILLING: UserBilling = {
    scheduledPlan: null,
    scheduledInterval: null,
    scheduledChangeAt: null,
    scheduledChangeType: null,
    scheduledChangeStatus: null,
    plan: 'free',
    status: 'none',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodEnd: 0,
    cancelAtPeriodEnd: false,
    scheduledCancellationAt: null,
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
    planChangeStatus: 'none',
    planChangeTarget: null,
    planChangeInterval: null,
    planChangeFamilyId: null,
    planChangeOperationId: null,
    planChangeRequestedAt: null,
    planChangeFailure: null,
    priceId: null,
    interval: null,
    addons: { aiPack: false },
    updatedAt: 0,
};

export const DEFAULT_USER_FAMILY: UserFamily = {
    familyId: null,
    role: null,
    joinedAt: null,
};

export const DEFAULT_USER_USAGE: UserUsage = {
    monthKey: '',
    exportsUsed: 0,
    aiActionsUsed: 0,
    aiActionsAllowance: 10, // Free tier default
    storageUsedBytes: 0,
};
