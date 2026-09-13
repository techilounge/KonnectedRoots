'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useEntitlements } from '@/hooks/useEntitlements';
import { functions } from '@/lib/firebase/clients';
import { httpsCallable } from 'firebase/functions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertCircle, Check, Loader2, Sparkles, Users, Crown, Zap } from 'lucide-react';
import { PRICING } from '@/lib/billing/constants';
import { buildCheckoutPayload } from '@/lib/billing/checkoutPayload';
import Link from 'next/link';
import PricingComparison from '@/components/billing/PricingComparison';
import FamilyDowngradeControls from '@/components/billing/FamilyDowngradeControls';
import BillingActionFeedback, { useBillingProgress } from '@/components/billing/BillingActionFeedback';
import { billingError, billingNotifications, billingRequestRejected } from '@/lib/billing/notifications';
import { unavailableBillingNotice } from '@/lib/billing/notificationTracker';
import { resolveAIPackPricingState } from '@/lib/billing/aiPackPricingState';
import { familyUpgradeFailureMessage, resolvePricingBillingState } from '@/lib/billing/pricingBillingState';

const features = {
    free: [
        'Up to 3 family trees',
        'Up to 500 people per tree',
        '2 collaborators per tree (up to 1 Editor, remaining Viewers)',
        'GEDCOM import/export',
        '10 AI actions/month',
        '1 GB storage',
        '2 exports/month (with watermark)',
    ],
    pro: [
        'Unlimited family trees',
        'Unlimited people per tree',
        '10 collaborators per tree',
        '200 AI actions/month',
        '50 GB storage',
        'Unlimited exports (no watermark)',
        'GEDCOM import/export',
        'All collaboration roles',
    ],
    family: [
        'Everything in Pro, plus:',
        '6 family member accounts',
        '20 collaborators per tree',
        '600 pooled AI actions/month',
        '100 GB shared storage',
        'Family workspace management',
    ],
    aiPack: [
        '+1,000 AI actions/month',
        'Works with Pro or Family',
        'Pooled across all seats (Family)',
    ],
};

export default function PricingPage() {
    const { user } = useAuth();
    const { plan: currentPlan, canonicalPlan, canonicalStatus, paymentAttentionRequired, loading: entitlementLoading, canManageFamilyBilling, scheduledDowngrade, renewsAt, billingInterval, cancelAtPeriodEnd, hasAIPack, aiPackItemExists, aiPackStatus, aiPackPaidThrough, aiPackCancelAtPeriodEnd, planChangeStatus, planChangeFailure, refresh: refreshEntitlements } = useEntitlements();
    const router = useRouter();
    const billingProgress = useBillingProgress();
    const [isYearly, setIsYearly] = useState(false);
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
    const [aiPackError, setAIPackError] = useState<string | null>(null);
    const [familyUpgradeError, setFamilyUpgradeError] = useState<string | null>(null);
    const [processingDelayed, setProcessingDelayed] = useState(false);
    const billingView = resolvePricingBillingState({
        currentPlan, canonicalPlan, canonicalStatus, paymentAttentionRequired, loading: entitlementLoading,
    });

    useEffect(() => {
        if (aiPackStatus !== 'pending') return;
        const timeout = window.setTimeout(() => setProcessingDelayed(true), 45_000);
        return () => window.clearTimeout(timeout);
    }, [aiPackStatus]);

    useEffect(() => {
        if (planChangeStatus !== 'pending') return;
        const interval = window.setInterval(refreshEntitlements, 5_000);
        return () => window.clearInterval(interval);
    }, [planChangeStatus, refreshEntitlements]);

    useEffect(() => {
        if (currentPlan === 'family') {
            setFamilyUpgradeError(null);
        } else if (planChangeStatus === 'failed') {
            setFamilyUpgradeError(familyUpgradeFailureMessage(
                planChangeFailure === 'payment_expired' ? 'payment_expired' : 'payment_failed',
                hasAIPack,
            ));
        }
    }, [currentPlan, hasAIPack, planChangeFailure, planChangeStatus]);

    const aiPackView = resolveAIPackPricingState(
        aiPackStatus,
        loadingPlan === 'aipack',
        processingDelayed,
    );
    const aiPackRenewalStopped = aiPackStatus === 'active' &&
        aiPackCancelAtPeriodEnd &&
        !aiPackItemExists &&
        Boolean(aiPackPaidThrough);
    const aiPackEndDateFormatted = aiPackRenewalStopped && aiPackPaidThrough
        ? new Date(aiPackPaidThrough).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        })
        : null;

    const handleSubscribe = async (plan: 'pro' | 'family', withAIPack = false) => {
        if (!user) {
            router.push('/signup?redirect=/pricing');
            return;
        }
        if (billingView.paymentRequired) {
            billingError(unavailableBillingNotice);
            router.push('/settings/billing');
            return;
        }
        if (!billingView.canMutatePaidBilling ||
            (plan === 'pro' && !billingView.canStartProCheckout) ||
            (plan === 'family' && !billingView.canStartFamilyCheckout && !billingView.canUpgradeToFamily)) return;

        const notifications = billingNotifications();
        const operation = notifications.begin(user.uid, currentPlan === 'pro' && plan === 'family' ? 'family_upgrade' : plan === 'family' ? 'family_checkout' : 'pro_checkout', withAIPack);
        if (!operation) return;
        setLoadingPlan(plan);
        if (plan === 'family') setFamilyUpgradeError(null);

        try {
            if (currentPlan === 'pro' && plan === 'family') {
                const upgradeToFamily = httpsCallable(functions, 'upgradeToFamily');
                const result = await upgradeToFamily({
                    plan: 'family',
                    interval: isYearly ? 'year' : 'month',
                }) as { data: { success?: boolean; status?: 'pending' | 'payment_failed' } };
                if (!result.data.success || result.data.status === 'payment_failed') {
                    notifications.failed(operation);
                    refreshEntitlements();
                    return;
                }
                notifications.accepted(operation);
                refreshEntitlements();
                return;
            }
            const createCheckout = httpsCallable(functions, 'createCheckoutSession');
            const checkoutPayload = buildCheckoutPayload(
                plan,
                isYearly ? 'year' : 'month',
                withAIPack,
            );
            const result = await createCheckout(checkoutPayload) as { data: { url: string } };

            if (result.data.url) {
                notifications.accepted(operation);
                window.location.href = result.data.url;
            } else notifications.failed(operation);
        } catch (error) {
            notifications.failed(operation, billingRequestRejected(error));
            if (plan === 'family' && currentPlan === 'pro') {
                setFamilyUpgradeError('Billing update could not be confirmed. Refresh your billing status before trying again.');
                refreshEntitlements();
            }
        } finally {
            setLoadingPlan(null);
        }
    };

    const handleAddAIPack = async () => {
        if (!user) {
            router.push('/signup?redirect=/pricing');
            return;
        }
        if (billingView.paymentRequired) {
            billingError(unavailableBillingNotice);
            router.push('/settings/billing');
            return;
        }
        if (!billingView.canMutateAddons || scheduledDowngrade) return;

        const notifications = billingNotifications();
        const operation = notifications.begin(user.uid, 'add_ai_pack');
        if (!operation) return;
        setLoadingPlan('aipack');
        setAIPackError(null);
        setProcessingDelayed(false);

        try {
            const addAIPack = httpsCallable(functions, 'addAIPack');
            const result = await addAIPack({}) as { data: { success?: boolean; status?: 'pending' | 'active'; error?: string } };

            if (!result.data.success) {
                throw new Error('AI Pack request was not accepted.');
            }
            notifications.accepted(operation);
        } catch (error) {
            notifications.failed(operation, billingRequestRejected(error));
            setAIPackError('AI Pack update could not be confirmed. Refresh your billing status before trying again.');
        } finally {
            refreshEntitlements();
            setLoadingPlan(null);
        }
    };

    const getPrice = (plan: 'pro' | 'family') => {
        const prices = PRICING[plan];
        return isYearly ? prices.yearly : prices.monthly;
    };

    const getBillingText = () => isYearly ? '/year' : '/month';

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30">
            {/* Header */}
            <div className="container mx-auto px-4 py-16 text-center">
                <Badge variant="outline" className="mb-4">Pricing</Badge>
                <h1 className="text-4xl font-bold mb-4">
                    Simple, Transparent Pricing
                </h1>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
                    {billingView.paymentRequired
                        ? 'Your existing subscription is preserved while billing is resolved. Review plan features below.'
                        : 'Start free, upgrade when you need more. No hidden fees, cancel anytime.'}
                </p>

                {billingView.paymentRequired && (
                    <div role="alert" className="mx-auto mb-8 flex max-w-2xl items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-left text-amber-900 dark:text-amber-200">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                        <div className="space-y-1 text-sm">
                            <p className="font-semibold">Payment required for your {canonicalPlan === 'family' ? 'Family' : 'Pro'} plan</p>
                            <p>Your {canonicalPlan === 'family' ? 'Family' : 'Pro'} subscription requires payment. Paid features are paused until billing is resolved. Current billing status: {canonicalStatus.replaceAll('_', ' ')}.</p>
                            <Link href="/settings/billing" className="font-medium underline">Manage Billing in Stripe Portal</Link>
                        </div>
                    </div>
                )}

                {/* Billing Toggle */}
                <div className="flex items-center justify-center gap-4 mb-12">
                    <Label htmlFor="billing-toggle" className={!isYearly ? 'font-semibold' : 'text-muted-foreground'}>
                        Monthly
                    </Label>
                    <Switch
                        id="billing-toggle"
                        checked={isYearly}
                        onCheckedChange={setIsYearly}
                    />
                    <Label htmlFor="billing-toggle" className={isYearly ? 'font-semibold' : 'text-muted-foreground'}>
                        Yearly <Badge variant="secondary" className="ml-2">Save 17%</Badge>
                    </Label>
                </div>
            </div>

            {/* Pricing Cards */}
            <div className="container mx-auto px-4 pb-16">
                <div className="mx-auto max-w-5xl"><BillingActionFeedback refresh={refreshEntitlements} /></div>
                <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">

                    {/* Free Plan */}
                    <Card className="relative">
                        <CardHeader>
                            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                                <Users className="h-6 w-6" />
                            </div>
                            <CardTitle>Free</CardTitle>
                            <CardDescription>Perfect for getting started</CardDescription>
                            <div className="mt-4">
                                <span className="text-4xl font-bold">$0</span>
                                <span className="text-muted-foreground">/forever</span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-3">
                                {features.free.map((feature, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                        <span className="text-sm">{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                        <CardFooter className="flex-col gap-2">
                            {billingView.paymentRequired ? (
                                <Button variant="outline" className="w-full" disabled>
                                    Free access while billing is paused
                                </Button>
                            ) : billingView.isOrdinaryFree ? (
                                <Button variant="outline" className="w-full" disabled>
                                    Current Plan
                                </Button>
                            ) : user ? (
                                <Button variant="outline" className="w-full" asChild>
                                    <Link href="/dashboard">Go to Dashboard</Link>
                                </Button>
                            ) : (
                                <Button className="w-full" asChild>
                                    <Link href="/signup">Get Started Free</Link>
                                </Button>
                            )}
                        </CardFooter>
                    </Card>

                    {/* Pro Plan */}
                    <Card className="relative border-primary shadow-lg">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <Badge className="bg-primary">Most Popular</Badge>
                        </div>
                        <CardHeader>
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                <Sparkles className="h-6 w-6 text-primary" />
                            </div>
                            <CardTitle>Pro</CardTitle>
                            <CardDescription>For serious genealogists</CardDescription>
                            <div className="mt-4">
                                <span className="text-4xl font-bold">${getPrice('pro')}</span>
                                <span className="text-muted-foreground">{getBillingText()}</span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-3">
                                {features.pro.map((feature, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                        <span className="text-sm">{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                        <CardFooter className="flex-col gap-2">
                            {billingView.paymentRequired ? (
                                <Button variant="outline" className="w-full" disabled>
                                    {canonicalPlan === 'pro' ? 'Pro subscription requires payment' : 'Resolve billing before changing plans'}
                                </Button>
                            ) : currentPlan === 'pro' ? (
                                <Button variant="outline" className="w-full" disabled>
                                    Current Plan
                                </Button>
                            ) : currentPlan === 'family' ? (
                                canManageFamilyBilling ? <FamilyDowngradeControls
                                    scheduled={scheduledDowngrade} periodEnd={renewsAt} interval={billingInterval}
                                    hasAIPack={hasAIPack} refresh={refreshEntitlements}
                                    disabled={!billingView.canMutatePaidBilling || loadingPlan !== null || Boolean(billingProgress) || cancelAtPeriodEnd}
                                /> : <p className="text-sm">Only the Family billing owner can change this plan.</p>
                            ) : (
                                <Button
                                    className="w-full"
                                    onClick={() => handleSubscribe('pro')}
                                    disabled={!billingView.canStartProCheckout || loadingPlan !== null || Boolean(billingProgress)}
                                >
                                    {loadingPlan === 'pro' ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : null}
                                    Upgrade to Pro
                                </Button>
                            )}
                        </CardFooter>
                    </Card>

                    {/* Family Plan */}
                    <Card className="relative">
                        <CardHeader>
                            <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                                <Crown className="h-6 w-6 text-amber-500" />
                            </div>
                            <CardTitle>Family</CardTitle>
                            <CardDescription>Share with your whole family</CardDescription>
                            <div className="mt-4">
                                <span className="text-4xl font-bold">${getPrice('family')}</span>
                                <span className="text-muted-foreground">{getBillingText()}</span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-3">
                                {features.family.map((feature, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <Check className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                                        <span className="text-sm">{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                        <CardFooter>
                            {billingView.paymentRequired ? (
                                <Button variant="outline" className="w-full" disabled>
                                    {canonicalPlan === 'family' ? 'Family subscription requires payment' : 'Resolve billing before changing plans'}
                                </Button>
                            ) : currentPlan === 'family' ? (
                                <Button variant="outline" className="w-full" disabled>
                                    Current Plan
                                </Button>
                            ) : (
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => handleSubscribe('family')}
                                    disabled={(!billingView.canStartFamilyCheckout && !billingView.canUpgradeToFamily) || loadingPlan !== null || Boolean(billingProgress) || planChangeStatus === 'pending'}
                                >
                                    {loadingPlan === 'family' || planChangeStatus === 'pending' ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : null}
                                    {planChangeStatus === 'pending' ? 'Processing Family upgrade…' : 'Upgrade to Family'}
                                </Button>
                            )}
                            {!billingView.paymentRequired && familyUpgradeError && (
                                <div role="alert" className="text-sm text-destructive">
                                    <p>{familyUpgradeError}</p>
                                    {planChangeStatus === 'failed' && (
                                        <Link href="/settings/billing" className="underline">Open Billing Settings</Link>
                                    )}
                                </div>
                            )}
                        </CardFooter>
                    </Card>
                </div>

                {/* AI Pack Add-on */}
                <div className="max-w-2xl mx-auto mt-12">
                    <Card className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-violet-500/30">
                        <CardHeader className="flex-row items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-violet-500/20 flex items-center justify-center">
                                <Zap className="h-6 w-6 text-violet-500" />
                            </div>
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    AI Pack Add-on
                                    <Badge variant="secondary">${PRICING.aiPack.monthly}/mo</Badge>
                                </CardTitle>
                                <CardDescription>
                                    Need more AI power? Add 1,000 extra AI actions per month.
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ul className="flex flex-wrap gap-4 mb-4">
                                {features.aiPack.map((feature, i) => (
                                    <li key={i} className="flex items-center gap-2">
                                        <Check className="h-4 w-4 text-violet-500" />
                                        <span className="text-sm">{feature}</span>
                                    </li>
                                ))}
                            </ul>
                            {billingView.paymentRequired ? (
                                <Button variant="outline" disabled>Resolve billing before changing AI Pack</Button>
                            ) : (currentPlan === 'pro' || currentPlan === 'family') && (
                                <Button
                                    onClick={handleAddAIPack}
                                    disabled={Boolean(scheduledDowngrade) || !billingView.canMutateAddons || loadingPlan !== null || Boolean(billingProgress) || aiPackView.disabled}
                                    className="bg-violet-600 hover:bg-violet-700 text-white"
                                >
                                    {aiPackView.showSpinner && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {aiPackView.label}
                                </Button>
                            )}
                            {!billingView.paymentRequired && aiPackView.showDelayedMessage && (
                                <div className="mt-3 space-y-2 text-sm text-amber-700 dark:text-amber-300">
                                    <p>Payment is still processing. This page will update automatically when Stripe confirms the payment.</p>
                                    <Button type="button" variant="outline" size="sm" onClick={refreshEntitlements} disabled={entitlementLoading}>
                                        Refresh status
                                    </Button>
                                </div>
                            )}
                            {!billingView.paymentRequired && aiPackRenewalStopped && aiPackEndDateFormatted && (
                                <div className="mt-3 space-y-2 text-sm text-amber-700 dark:text-amber-300">
                                    <p>AI Pack Active. Ends {aiPackEndDateFormatted} unless renewal is resumed.</p>
                                    <Button type="button" variant="outline" size="sm" asChild>
                                        <Link href="/settings/billing">Resume renewal in Billing Settings</Link>
                                    </Button>
                                </div>
                            )}
                            {aiPackError && <p role="alert" className="mt-3 text-sm text-destructive">{aiPackError}</p>}
                        </CardContent>
                    </Card>
                </div>

                {/* Comparison Table */}
                <PricingComparison showCallToAction={!billingView.paymentRequired} />

                {/* FAQ Link */}
                <div className="text-center mt-12">
                    <p className="text-muted-foreground">
                        Questions? Check out our <Link href="/#faq" className="text-primary hover:underline">FAQ</Link> or{' '}
                        <Link href="/contact" className="text-primary hover:underline">contact us</Link>.
                    </p>
                </div>
            </div>
        </div>
    );
}
