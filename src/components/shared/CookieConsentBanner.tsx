"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { Cookie, X } from 'lucide-react';

const CONSENT_KEY = 'konnectedroots_cookie_consent';

type ConsentStatus = 'pending' | 'accepted' | 'rejected' | 'essential-only';

interface CookieConsentBannerProps {
    onConsentChange?: (status: ConsentStatus) => void;
}

export default function CookieConsentBanner({ onConsentChange }: CookieConsentBannerProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        // Check if consent has already been given
        const storedConsent = localStorage.getItem(CONSENT_KEY);
        if (!storedConsent) {
            setIsVisible(true);
        }
    }, []);

    const handleConsent = (status: ConsentStatus) => {
        localStorage.setItem(CONSENT_KEY, JSON.stringify({
            status,
            timestamp: new Date().toISOString(),
            version: '1.0',
        }));
        setIsVisible(false);
        onConsentChange?.(status);
    };

    if (!isVisible) return null;

    return (
        <div
            className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/80 backdrop-blur-sm border-t"
            role="dialog"
            aria-labelledby="cookie-consent-title"
            aria-describedby="cookie-consent-description"
        >
            <Card className="max-w-4xl mx-auto shadow-lg">
                <CardContent className="p-4 sm:p-6">
                    <div className="flex items-start gap-4">
                        <Cookie className="h-8 w-8 text-primary flex-shrink-0 mt-1" aria-hidden="true" />
                        <div className="flex-1">
                            <h2 id="cookie-consent-title" className="text-lg font-semibold mb-2">
                                We Value Your Privacy 🍪
                            </h2>
                            <p id="cookie-consent-description" className="text-sm text-muted-foreground mb-4">
                                We use cookies to enhance your experience. Essential cookies are required for the site to function.
                                Optional cookies help us understand how you use KonnectedRoots so we can improve it.
                                {' '}
                                <Link href="/privacy" className="text-primary hover:underline">
                                    Learn more in our Privacy Policy
                                </Link>.
                            </p>

                            {showDetails && (
                                <div className="mb-4 p-4 bg-muted rounded-lg text-sm space-y-3">
                                    <div>
                                        <strong>Essential Cookies</strong>
                                        <p className="text-muted-foreground">Required for login, security, and basic functionality. Cannot be disabled.</p>
                                    </div>
                                    <div>
                                        <strong>Preference Cookies</strong>
                                        <p className="text-muted-foreground">Remember your settings like sidebar state and theme preference.</p>
                                    </div>
                                    <div>
                                        <strong>Analytics Cookies</strong>
                                        <p className="text-muted-foreground">Help us understand how visitors interact with our site (e.g., page views, feature usage).</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-wrap gap-2">
                                <Button
                                    onClick={() => handleConsent('accepted')}
                                    className="bg-primary hover:bg-primary/90"
                                >
                                    Accept All
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => handleConsent('essential-only')}
                                >
                                    Essential Only
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => setShowDetails(!showDetails)}
                                >
                                    {showDetails ? 'Hide Details' : 'Cookie Details'}
                                </Button>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="flex-shrink-0"
                            onClick={() => handleConsent('rejected')}
                            aria-label="Dismiss cookie banner"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// Helper to check consent status
export function getCookieConsent(): ConsentStatus | null {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) return null;
    try {
        return JSON.parse(stored).status;
    } catch {
        return null;
    }
}

// Helper to check if analytics cookies are allowed
export function isAnalyticsAllowed(): boolean {
    const consent = getCookieConsent();
    return consent === 'accepted';
}

// Helper to check if preference cookies are allowed
export function isPreferenceCookiesAllowed(): boolean {
    const consent = getCookieConsent();
    return consent === 'accepted' || consent === 'essential-only';
}
