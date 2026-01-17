'use client';

import { useState } from 'react';
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
import { Check, Loader2, Sparkles, Users, Crown, Zap } from 'lucide-react';
import { PRICING } from '@/lib/billing/constants';
import Link from 'next/link';
import PricingComparison from '@/components/billing/PricingComparison';

const features = {
    free: [
        'Up to 3 family trees',
        'Up to 500 people per tree',
        '2 collaborators per tree (Viewer only)',
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
    const { plan: currentPlan, loading: entitlementLoading } = useEntitlements();
    const router = useRouter();
    const [isYearly, setIsYearly] = useState(false);
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

    const handleSubscribe = async (plan: 'pro' | 'family', withAIPack = false) => {
        if (!user) {
            router.push('/signup?redirect=/pricing');
            return;
        }

        setLoadingPlan(plan);

        try {
            const createCheckout = httpsCallable(functions, 'createCheckoutSession');
            const result = await createCheckout({
                plan,
                interval: isYearly ? 'year' : 'month',
                addons: withAIPack ? { aiPack: true } : undefined,
            }) as { data: { url: string } };

            if (result.data.url) {
                window.location.href = result.data.url;
            }
        } catch (error) {
            console.error('Checkout error:', error);
            // Could show toast here
        } finally {
            setLoadingPlan(null);
        }
    };

    const handleAddAIPack = async () => {
        if (!user) {
            router.push('/signup?redirect=/pricing');
            return;
        }

        setLoadingPlan('aipack');

        try {
            const addAIPack = httpsCallable(functions, 'addAIPack');
            const result = await addAIPack({}) as { data: { success?: boolean; error?: string } };

            if (result.data.success) {
                // Refresh the page to show updated subscription
                window.location.reload();
            } else if (result.data.error) {
                console.error('Add AI Pack error:', result.data.error);
                alert(result.data.error);
            }
        } catch (error) {
            console.error('Add AI Pack error:', error);
            alert('Failed to add AI Pack. Please try again.');
        } finally {
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
                    Start free, upgrade when you need more. No hidden fees, cancel anytime.
                </p>

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
                        <CardFooter>
                            {currentPlan === 'free' ? (
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
                            {currentPlan === 'pro' ? (
                                <Button variant="outline" className="w-full" disabled>
                                    Current Plan
                                </Button>
                            ) : (
                                <Button
                                    className="w-full"
                                    onClick={() => handleSubscribe('pro')}
                                    disabled={loadingPlan === 'pro'}
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
                            {currentPlan === 'family' ? (
                                <Button variant="outline" className="w-full" disabled>
                                    Current Plan
                                </Button>
                            ) : (
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => handleSubscribe('family')}
                                    disabled={loadingPlan === 'family'}
                                >
                                    {loadingPlan === 'family' ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : null}
                                    Upgrade to Family
                                </Button>
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
                            {(currentPlan === 'pro' || currentPlan === 'family') && (
                                <Button
                                    onClick={handleAddAIPack}
                                    disabled={loadingPlan === 'aipack'}
                                    className="bg-violet-600 hover:bg-violet-700 text-white"
                                >
                                    {loadingPlan === 'aipack' ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding...</>
                                    ) : (
                                        <>Add to Your Plan</>
                                    )}
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Comparison Table */}
                <PricingComparison />

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
