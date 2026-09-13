"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useEntitlements } from '@/hooks/useEntitlements';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
    CreditCard,
    Sparkles,
    Download,
    HardDrive,
    ExternalLink,
    Loader2,
    CheckCircle2,
    AlertCircle,
    ArrowLeft,
    Shield
} from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase/clients';
import FamilyDowngradeControls from '@/components/billing/FamilyDowngradeControls';
import ScheduledBillingReconciliation from '@/components/billing/ScheduledBillingReconciliation';
import BillingActionFeedback, { useBillingProgress } from '@/components/billing/BillingActionFeedback';
import { billingError, billingNotifications, billingRequestRejected } from '@/lib/billing/notifications';
import { unavailableBillingNotice } from '@/lib/billing/notificationTracker';
import { resolveAIUsageDisplay } from '@/lib/billing/usageDisplay';
import { resolveSubscriptionPeriodDisplay } from '@/lib/billing/subscriptionDisplay';

export default function BillingSettingsPage() {
    const { user, loading: authLoading } = useAuth();
    const { billingScheduleCleanupRequired, billingScheduleReleaseConfirmed, billingViewUid, billingReadStartedAt, scheduledDowngrade, canManageFamilyBilling, loading: entitlementLoading, entitlements, plan, canonicalPlan, canonicalStatus, effectivePaidEntitlement, paymentAttentionRequired, entitlementReason, limits, isPro, isFamily, isFree, exportsRemaining, subscriptionStatus, billingInterval, renewsAt, cancelAtPeriodEnd, scheduledCancellationAt, hasAIPack, aiPackItemExists, aiPackStatus, aiPackPaidThrough, aiPackCancelAtPeriodEnd, aiPackScheduledRemovalAt, aiPackRemovalPending, aiPackResumePending, hasStripeCustomer, refresh: refreshEntitlements } = useEntitlements();
    const billingProgress = useBillingProgress();
    const [isOpeningPortal, setIsOpeningPortal] = useState(false);
    const [isRemovingAIPack, setIsRemovingAIPack] = useState(false);
    const [isResumingAIPack, setIsResumingAIPack] = useState(false);
    const [isAwaitingAIPackResume, setIsAwaitingAIPackResume] = useState(false);
    const [aiPackResumeError, setAIPackResumeError] = useState<string | null>(null);

    const billing = { status: subscriptionStatus, interval: billingInterval, currentPeriodEnd: renewsAt, cancelAtPeriodEnd, scheduledCancellationAt };
    const usage = entitlements?.usage;
    const isSubscriptionActive = effectivePaidEntitlement;

    const handleOpenPortal = async () => {
        if (!user) return;
        setIsOpeningPortal(true);

        try {
            const functions = getFunctions(app, 'us-central1');
            const createPortalSessionFn = httpsCallable(functions, 'createPortalSession');
            const res = await createPortalSessionFn();
            const data = res.data as { url: string };

            if (data?.url) {
                window.location.href = data.url;
            } else {
                throw new Error("No portal URL returned.");
            }
        } catch {
            billingError({ variant: 'destructive', title: 'Billing portal unavailable', description: 'Please try opening your billing portal again.' });
            setIsOpeningPortal(false);
        }
    };

    const handleRemoveAIPack = async () => {
        if (paymentAttentionRequired) { billingError(unavailableBillingNotice); return; }
        if (!user || entitlementLoading || !effectivePaidEntitlement || scheduledDowngrade || isRemovingAIPack || aiPackCancelAtPeriodEnd) return;
        const notifications = billingNotifications();
        const operation = notifications.begin(user.uid, 'stop_ai_pack');
        if (!operation) return;
        setIsRemovingAIPack(true);
        try {
            const functions = getFunctions(app, 'us-central1');
            const removeAIPackFn = httpsCallable(functions, 'removeAIPack');
            const result = await removeAIPackFn({}) as {
                data: { success?: boolean; status?: 'none' | 'scheduled'; endsAt?: number | null };
            };
            if (!result.data.success) throw new Error('AI Pack removal was not accepted.');
            notifications.accepted(operation);
        } catch (error) {
            notifications.failed(operation, billingRequestRejected(error));
        } finally {
            refreshEntitlements();
            setIsRemovingAIPack(false);
        }
    };

    const handleResumeAIPack = async () => {
        if (paymentAttentionRequired) { billingError(unavailableBillingNotice); return; }
        if (!user || entitlementLoading || !effectivePaidEntitlement || scheduledDowngrade || isResumingAIPack || !aiPackCancelAtPeriodEnd || aiPackItemExists) return;
        const notifications = billingNotifications();
        const operation = notifications.begin(user.uid, 'resume_ai_pack');
        if (!operation) return;
        setIsResumingAIPack(true);
        setIsAwaitingAIPackResume(false);
        setAIPackResumeError(null);
        try {
            const functions = getFunctions(app, 'us-central1');
            const resumeAIPackFn = httpsCallable(functions, 'resumeAIPack');
            const result = await resumeAIPackFn({}) as {
                data: { success?: boolean; status?: 'resuming' | 'renewing'; paidThrough?: number | null };
            };
            if (!result.data.success) throw new Error('AI Pack renewal request was not accepted.');
            notifications.accepted(operation);
            setIsAwaitingAIPackResume(true);
            refreshEntitlements();
        } catch (error) {
            notifications.failed(operation, billingRequestRejected(error));
            setIsAwaitingAIPackResume(false);
            setAIPackResumeError('AI Pack renewal update could not be confirmed. Refresh your billing status before trying again.');
        } finally {
            refreshEntitlements();
            setIsResumingAIPack(false);
        }
    };

    useEffect(() => {
        if (entitlementLoading || !isAwaitingAIPackResume || !aiPackItemExists || aiPackCancelAtPeriodEnd) return;
        const confirmation = window.setTimeout(() => {
            setIsAwaitingAIPackResume(false);
            setAIPackResumeError(null);
        }, 0);
        return () => window.clearTimeout(confirmation);
    }, [entitlementLoading, aiPackCancelAtPeriodEnd, aiPackItemExists, isAwaitingAIPackResume]);

    useEffect(() => {
        if (!isAwaitingAIPackResume && !aiPackResumePending) return;
        const interval = window.setInterval(refreshEntitlements, 5_000);
        return () => window.clearInterval(interval);
    }, [aiPackResumePending, isAwaitingAIPackResume, refreshEntitlements]);

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="container max-w-4xl py-12 text-center">
                <p className="text-muted-foreground mb-4">Please log in to manage your billing settings.</p>
                <Button asChild>
                    <Link href="/login">Sign In</Link>
                </Button>
            </div>
        );
    }

    const {
        allowance: aiAllowance,
        used: aiUsed,
        remaining: aiRemaining,
        percentUsed: aiPercent,
    } = resolveAIUsageDisplay(limits, usage);

    const exportLimit = limits.exportLimitPerMonth;
    const exportsUsed = usage?.exportsUsed || 0;
    const exportPercent = exportLimit ? Math.min(100, Math.round((exportsUsed / exportLimit) * 100)) : 0;

    const subscriptionPeriod = resolveSubscriptionPeriodDisplay(
        billing.currentPeriodEnd,
        billing.cancelAtPeriodEnd,
        billing.scheduledCancellationAt,
    );
    const subscriptionDateFormatted = subscriptionPeriod.timestamp
        ? new Date(subscriptionPeriod.timestamp).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        })
        : null;
    const aiPackEndTimestamp = aiPackScheduledRemovalAt || aiPackPaidThrough;
    const aiPackEndDateFormatted = aiPackEndTimestamp
        ? new Date(aiPackEndTimestamp).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        })
        : null;

    return (
        <div className="container max-w-4xl py-8 space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" asChild className="gap-1 px-2">
                            <Link href="/settings">
                                <ArrowLeft className="h-4 w-4" /> Settings
                            </Link>
                        </Button>
                    </div>
                    <h1 className="text-3xl font-headline font-bold">Billing & Subscription</h1>
                    <p className="text-muted-foreground text-sm">
                        Manage your subscription plan, payment methods, and monthly usage allowances.
                    </p>
                </div>
            </div>

            <BillingActionFeedback refresh={refreshEntitlements} />
            <ScheduledBillingReconciliation needed={billingScheduleCleanupRequired} released={billingScheduleReleaseConfirmed}
                viewUid={billingViewUid} readStartedAt={billingReadStartedAt} loading={entitlementLoading}
                plan={plan} status={canonicalStatus} paid={effectivePaidEntitlement} paymentAttention={paymentAttentionRequired}
                disabled={Boolean(billingProgress)} refresh={refreshEntitlements} />
            {/* Current Plan Overview Card */}
            <Card className="shadow-sm border-border">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-xl flex items-center gap-2 font-headline">
                                <CreditCard className="h-5 w-5 text-primary" />
                                Current Subscription
                            </CardTitle>
                            <CardDescription>
                                Your active plan and renewal status
                            </CardDescription>
                        </div>
                        <Badge
                            className="text-sm font-semibold capitalize px-3 py-1"
                            variant={isFree ? "secondary" : "default"}
                        >
                            {canonicalPlan} Plan
                        </Badge>
                    </div>
                </CardHeader>

                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/40 rounded-lg border border-border/50">
                        <div>
                            <p className="text-xs text-muted-foreground uppercase font-medium">Status</p>
                            <p className="text-base font-semibold capitalize flex items-center gap-1.5 mt-0.5">
                                {paymentAttentionRequired ? (
                                    <>
                                        <AlertCircle className="h-4 w-4 text-amber-600" />
                                        Payment required
                                    </>
                                ) : subscriptionStatus === 'canceled' || entitlementReason === 'subscription_canceled' ? (
                                    <>
                                        <Shield className="h-4 w-4 text-muted-foreground" />
                                        Canceled
                                    </>
                                ) : isSubscriptionActive ? (
                                    <>
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                        Active
                                    </>
                                ) : (
                                    <>
                                        <Shield className="h-4 w-4 text-muted-foreground" />
                                        Free Tier
                                    </>
                                )}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs text-muted-foreground uppercase font-medium">Billing Cycle</p>
                            <p className="text-base font-semibold capitalize mt-0.5">
                                {billing?.interval ? `${billing.interval}ly` : "None"}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs text-muted-foreground uppercase font-medium">
                                {subscriptionPeriod.label}
                            </p>
                            <p className="text-base font-semibold mt-0.5">
                                {subscriptionDateFormatted || "N/A"}
                            </p>
                        </div>
                    </div>

                    {paymentAttentionRequired && (
                        <div role="alert" className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-md text-amber-900 dark:text-amber-200 text-sm">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <div className="space-y-1">
                                <p className="font-semibold">Payment required</p>
                                <p>Your {canonicalPlan === 'family' ? 'Family' : 'Pro'} subscription is {canonicalStatus.replace('_', ' ')}. Paid features are paused until Stripe confirms payment.</p>
                                <Link href="#manage-billing" className="font-medium underline">Fix payment method in Stripe Portal</Link>
                            </div>
                        </div>
                    )}

                    {subscriptionPeriod.isCancellationScheduled && (
                        <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md text-amber-800 dark:text-amber-300 text-sm">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>
                                Your subscription will cancel on <strong>{subscriptionDateFormatted}</strong>. You will retain {isFamily ? 'Family' : 'Pro'} features until that date.
                            </span>
                        </div>
                    )}
                </CardContent>

                {canManageFamilyBilling && <div className="px-6 pb-6">
                    <FamilyDowngradeControls scheduled={scheduledDowngrade} periodEnd={renewsAt} interval={billingInterval}
                        hasAIPack={hasAIPack} refresh={refreshEntitlements}
                        disabled={entitlementLoading || Boolean(billingProgress) || paymentAttentionRequired || cancelAtPeriodEnd || plan !== 'family'} />
                </div>}
                <CardFooter className="flex flex-wrap gap-3 pt-2 justify-end border-t bg-muted/20">
                    {!scheduledDowngrade && !paymentAttentionRequired && hasAIPack && !aiPackCancelAtPeriodEnd && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={entitlementLoading || Boolean(billingProgress) || isRemovingAIPack}>
                                    {isRemovingAIPack && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {isRemovingAIPack
                                        ? 'Removing AI Pack...'
                                        : aiPackRemovalPending ? 'Retry Remove AI Pack' : 'Remove AI Pack'}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Stop AI Pack renewal?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Your {isFamily ? 'Family' : 'Pro'} subscription will remain active. The AI Pack will not renew, and your already-paid 1,000 additional AI credits will remain available{aiPackEndDateFormatted ? ` through ${aiPackEndDateFormatted}` : ' through the current paid period'}.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Not now</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleRemoveAIPack} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                        Stop AI Pack renewal
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                    {!scheduledDowngrade && !paymentAttentionRequired && hasAIPack && aiPackCancelAtPeriodEnd && !aiPackItemExists && aiPackEndDateFormatted && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" disabled={entitlementLoading || Boolean(billingProgress) || isResumingAIPack}>
                                    {isResumingAIPack && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {isResumingAIPack
                                        ? 'Resuming...'
                                        : aiPackResumePending ? 'Retry Keep AI Pack' : 'Keep AI Pack'}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Keep AI Pack renewing?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Your AI Pack access is already paid through {aiPackEndDateFormatted}. You will not be charged today. AI Pack billing will resume with your next renewal.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Not now</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleResumeAIPack}>
                                        Keep AI Pack
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                    {hasStripeCustomer ? (
                        <Button
                            id="manage-billing"
                            onClick={handleOpenPortal}
                            disabled={isOpeningPortal}
                            className="gap-2"
                        >
                            {isOpeningPortal ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <ExternalLink className="h-4 w-4" />
                            )}
                            Manage Billing in Stripe Portal
                        </Button>
                    ) : (
                        <Button asChild className="gap-2">
                            <Link href="/pricing">
                                <Sparkles className="h-4 w-4" />
                                Upgrade Plan
                            </Link>
                        </Button>
                    )}
                </CardFooter>
            </Card>

            {/* Monthly Allowances & Usage */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* AI Actions Usage */}
                <Card className="shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-headline flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            AI Credits Usage
                        </CardTitle>
                        <CardDescription>
                            Monthly credits for smart biography, relationships, name suggestions, and photo enhancement.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Credits Used:</span>
                            <span className="font-semibold">{aiUsed} / {aiAllowance}</span>
                        </div>
                        <Progress value={aiPercent} className="h-2" />
                        <p className="text-xs text-muted-foreground">
                            {aiRemaining} credit(s) remaining for the current month. Credits reset automatically on the 1st of each month.
                        </p>
                        {aiPackStatus === 'pending' && (
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                                AI Pack payment is processing. The additional 1,000 credits become available after Stripe confirms payment.
                            </p>
                        )}
                        {aiPackRemovalPending && (
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                                AI Pack removal still needs confirmation. Your paid access remains active; retrying uses the same safe operation.
                            </p>
                        )}
                        {hasAIPack && aiPackCancelAtPeriodEnd && aiPackEndDateFormatted && (
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                                AI Pack ends on {aiPackEndDateFormatted}. Your {isFamily ? 'Family' : 'Pro'} subscription remains active.
                            </p>
                        )}
                        {(isResumingAIPack || isAwaitingAIPackResume || aiPackResumePending) && (
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                                Resuming AI Pack renewal. This page will update automatically after the authoritative billing state is confirmed.
                            </p>
                        )}
                        {aiPackResumeError && (
                            <p role="alert" className="text-xs text-destructive">{aiPackResumeError}</p>
                        )}
                    </CardContent>
                </Card>

                {/* Tree Exports Usage */}
                <Card className="shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-headline flex items-center gap-2">
                            <Download className="h-4 w-4 text-primary" />
                            Monthly Tree Exports
                        </CardTitle>
                        <CardDescription>
                            High-resolution PDF and PNG tree exports.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Exports Generated:</span>
                            <span className="font-semibold">
                                {exportLimit === null ? `${exportsUsed} (Unlimited)` : `${exportsUsed} / ${exportLimit}`}
                            </span>
                        </div>
                        {exportLimit !== null ? (
                            <Progress value={exportPercent} className="h-2" />
                        ) : (
                            <div className="h-2 bg-emerald-500/20 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full w-full" />
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                            {exportLimit === null
                                ? "You have unlimited PDF & PNG tree exports on your current plan."
                                : `Free tier is limited to 2 exports per month. Upgrade to Pro for unlimited exports.`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            GEDCOM import/export is available on all plans and does not count toward your visual export allowance.
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Plan Features Breakdown */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg font-headline">Features Included in Your Plan</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            <span>
                                {limits.maxTrees === null ? "Unlimited Trees" : `Up to ${limits.maxTrees} Trees`}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            <span>
                                {limits.maxPeoplePerTree === null ? "Unlimited People / Tree" : `Up to ${limits.maxPeoplePerTree} People / Tree`}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            <span>
                                {limits.maxCollaboratorsPerTree} Collaborator(s) / Tree
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            <span>
                                GEDCOM Import & Export (all plans)
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            <span>
                                {limits.watermarkExports ? "Watermarked Exports" : "Watermark-Free Exports"}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            <span>
                                Storage Quota: {isFree ? "1 GB" : isPro ? "50 GB" : "100 GB"}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
