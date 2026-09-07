"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useEntitlements } from '@/hooks/useEntitlements';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
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

export default function BillingSettingsPage() {
    const { user, userProfile, loading: authLoading } = useAuth();
    const { entitlements, plan, limits, isPro, isFamily, isFree, aiRemaining, exportsRemaining } = useEntitlements();
    const { toast } = useToast();
    const [isOpeningPortal, setIsOpeningPortal] = useState(false);

    const billing = (userProfile as any)?.billing;
    const usage = entitlements?.usage;
    const hasStripeCustomer = Boolean(billing?.stripeCustomerId);
    const isSubscriptionActive = billing?.status === 'active' || billing?.status === 'trialing';

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
        } catch (error: any) {
            console.error("Error opening customer portal:", error);
            const msg = error?.message || "Failed to open billing portal. Please try again.";
            toast({
                variant: "destructive",
                title: "Portal Error",
                description: msg,
            });
            setIsOpeningPortal(false);
        }
    };

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

    const aiAllowance = usage?.aiActionsAllowance || limits.aiActionsAllowance || 10;
    const aiUsed = usage?.aiActionsUsed || 0;
    const aiPercent = Math.min(100, Math.round((aiUsed / (aiAllowance || 1)) * 100));

    const exportLimit = limits.exportLimitPerMonth;
    const exportsUsed = usage?.exportsUsed || 0;
    const exportPercent = exportLimit ? Math.min(100, Math.round((exportsUsed / exportLimit) * 100)) : 0;

    const periodEndFormatted = billing?.currentPeriodEnd
        ? new Date(billing.currentPeriodEnd).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
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
                            {plan} Plan
                        </Badge>
                    </div>
                </CardHeader>

                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/40 rounded-lg border border-border/50">
                        <div>
                            <p className="text-xs text-muted-foreground uppercase font-medium">Status</p>
                            <p className="text-base font-semibold capitalize flex items-center gap-1.5 mt-0.5">
                                {isSubscriptionActive ? (
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
                                {billing?.cancelAtPeriodEnd ? "Expires On" : "Next Renewal"}
                            </p>
                            <p className="text-base font-semibold mt-0.5">
                                {periodEndFormatted || "N/A"}
                            </p>
                        </div>
                    </div>

                    {billing?.cancelAtPeriodEnd && (
                        <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md text-amber-800 dark:text-amber-300 text-sm">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>
                                Your subscription will cancel on <strong>{periodEndFormatted}</strong>. You will retain Pro features until that date.
                            </span>
                        </div>
                    )}
                </CardContent>

                <CardFooter className="flex flex-wrap gap-3 pt-2 justify-end border-t bg-muted/20">
                    {hasStripeCustomer ? (
                        <Button
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
                            High-resolution PDF, PNG canvas exports and GEDCOM files.
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
                                {limits.allowGedcomExport ? "GEDCOM Export & Import" : "No GEDCOM Support"}
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
