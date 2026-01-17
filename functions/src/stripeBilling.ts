/**
 * Stripe Checkout & Portal Session Handlers for KonnectedRoots
 * 
 * Callable functions for creating Stripe Checkout and Customer Portal sessions.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as functions from "firebase-functions/v2";
import Stripe from "stripe";
import * as admin from "firebase-admin";

// Ensure Firebase Admin is initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// Initialize Stripe lazily (secrets not available at deploy time)
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
    if (!_stripe) {
        _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    }
    return _stripe;
}

// Stripe Price IDs (set via environment or secrets)
const STRIPE_PRICES = {
    pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || "",
    pro_yearly: process.env.STRIPE_PRICE_PRO_YEARLY || "",
    family_monthly: process.env.STRIPE_PRICE_FAMILY_MONTHLY || "",
    family_yearly: process.env.STRIPE_PRICE_FAMILY_YEARLY || "",
    ai_pack_monthly: process.env.STRIPE_PRICE_AI_PACK || "",
};

interface CreateCheckoutRequest {
    plan: "pro" | "family";
    interval: "month" | "year";
    familyId?: string;
    addons?: {
        aiPack?: boolean;
    };
    successUrl?: string;
    cancelUrl?: string;
}

/**
 * Create Stripe Checkout Session
 * 
 * Creates a checkout session for Pro or Family subscription.
 */
export const createCheckoutSession = onCall(
    {
        region: "us-central1",
        secrets: ["STRIPE_SECRET_KEY"],
    },
    async (request) => {
        // Must be authenticated
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "Must be logged in to subscribe");
        }

        const uid = request.auth.uid;
        const data = request.data as CreateCheckoutRequest;
        const { plan, interval, familyId, addons, successUrl, cancelUrl } = data;

        // Validate plan
        if (!["pro", "family"].includes(plan)) {
            throw new HttpsError("invalid-argument", "Invalid plan");
        }

        // Validate interval
        if (!["month", "year"].includes(interval)) {
            throw new HttpsError("invalid-argument", "Invalid interval");
        }

        // Get user data
        const userDoc = await db.collection("users").doc(uid).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        const userEmail = request.auth.token.email;

        // Check if user already has an active subscription
        if (userData?.billing?.status === "active") {
            throw new HttpsError(
                "already-exists",
                "You already have an active subscription. Use the billing portal to manage it."
            );
        }

        // Build line items
        const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

        // Main plan
        const priceKey = `${plan}_${interval === "month" ? "monthly" : "yearly"}` as keyof typeof STRIPE_PRICES;
        const priceId = STRIPE_PRICES[priceKey];

        if (!priceId) {
            throw new HttpsError("failed-precondition", `Price not configured: ${priceKey}`);
        }

        lineItems.push({
            price: priceId,
            quantity: 1,
        });

        // AI Pack add-on (only if purchasing Pro/Family)
        if (addons?.aiPack) {
            const aiPackPriceId = STRIPE_PRICES.ai_pack_monthly;
            if (!aiPackPriceId) {
                throw new HttpsError("failed-precondition", "AI Pack price not configured");
            }
            lineItems.push({
                price: aiPackPriceId,
                quantity: 1,
            });
        }

        // Get or create Stripe customer
        let customerId = userData?.billing?.stripeCustomerId;

        if (!customerId && userEmail) {
            // Check if customer exists by email
            const existingCustomers = await getStripe().customers.list({
                email: userEmail,
                limit: 1,
            });

            if (existingCustomers.data.length > 0) {
                customerId = existingCustomers.data[0].id;
                // Update with our metadata
                await getStripe().customers.update(customerId, {
                    metadata: {
                        kr_uid: uid,
                        ...(familyId ? { kr_family_id: familyId } : {}),
                    },
                });
            } else {
                // Create new customer
                const customer = await getStripe().customers.create({
                    email: userEmail,
                    metadata: {
                        kr_uid: uid,
                        ...(familyId ? { kr_family_id: familyId } : {}),
                    },
                });
                customerId = customer.id;
            }

            // Save customer ID to user doc
            await db.collection("users").doc(uid).set(
                {
                    billing: {
                        stripeCustomerId: customerId,
                    },
                },
                { merge: true }
            );
        }

        // For Family plan, create family doc if needed
        if (plan === "family" && !familyId) {
            // Auto-create family
            const familyRef = db.collection("families").doc();
            await familyRef.set({
                ownerUid: uid,
                createdAt: Date.now(),
                plan: {
                    status: "none",
                    seatLimit: 6,
                },
                usage: {
                    monthKey: "",
                    exportsUsed: 0,
                    aiActionsUsed: 0,
                    aiActionsAllowance: 600,
                    storageUsedBytes: 0,
                },
            });

            // Update customer metadata with family ID
            if (customerId) {
                await getStripe().customers.update(customerId, {
                    metadata: {
                        kr_uid: uid,
                        kr_family_id: familyRef.id,
                    },
                });
            }

            // Link user to family
            await db.collection("users").doc(uid).set(
                {
                    family: {
                        familyId: familyRef.id,
                        role: "owner",
                        joinedAt: Date.now(),
                    },
                },
                { merge: true }
            );
        }

        // Create checkout session
        const session = await getStripe().checkout.sessions.create({
            customer: customerId || undefined,
            customer_email: customerId ? undefined : userEmail,
            client_reference_id: uid,
            mode: "subscription",
            line_items: lineItems,
            success_url: successUrl || `${process.env.APP_URL || "https://konnectedroots.app"}/dashboard?checkout=success`,
            cancel_url: cancelUrl || `${process.env.APP_URL || "https://konnectedroots.app"}/pricing?checkout=canceled`,
            metadata: {
                kr_uid: uid,
                kr_plan: plan,
                ...(familyId ? { kr_family_id: familyId } : {}),
            },
            subscription_data: {
                metadata: {
                    kr_uid: uid,
                    kr_plan: plan,
                    ...(familyId ? { kr_family_id: familyId } : {}),
                },
            },
        });

        functions.logger.info(`Created checkout session ${session.id} for user ${uid}`);

        return {
            sessionId: session.id,
            url: session.url,
        };
    }
);

/**
 * Create Stripe Customer Portal Session
 * 
 * Allows users to manage their subscription.
 */
export const createPortalSession = onCall(
    {
        region: "us-central1",
        secrets: ["STRIPE_SECRET_KEY"],
    },
    async (request) => {
        // Must be authenticated
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "Must be logged in");
        }

        const uid = request.auth.uid;

        // Get user data
        const userDoc = await db.collection("users").doc(uid).get();
        if (!userDoc.exists) {
            throw new HttpsError("not-found", "User not found");
        }

        const userData = userDoc.data();
        const customerId = userData?.billing?.stripeCustomerId;

        if (!customerId) {
            throw new HttpsError("failed-precondition", "No billing account found");
        }

        // Create portal session
        const session = await getStripe().billingPortal.sessions.create({
            customer: customerId,
            return_url: `${process.env.APP_URL || "https://konnectedroots.app"}/settings/billing`,
        });

        functions.logger.info(`Created portal session for user ${uid}`);

        return {
            url: session.url,
        };
    }
);

/**
 * Add AI Pack to existing subscription
 */
export const addAIPack = onCall(
    {
        region: "us-central1",
        secrets: ["STRIPE_SECRET_KEY"],
    },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "Must be logged in");
        }

        const uid = request.auth.uid;

        // Get user data
        const userDoc = await db.collection("users").doc(uid).get();
        if (!userDoc.exists) {
            throw new HttpsError("not-found", "User not found");
        }

        const userData = userDoc.data();
        const billing = userData?.billing;

        // Must have Pro or Family subscription
        if (!billing?.stripeSubscriptionId || !["pro", "family"].includes(billing.plan)) {
            throw new HttpsError(
                "failed-precondition",
                "AI Pack requires Pro or Family subscription"
            );
        }

        // Already has AI Pack?
        if (billing.addons?.aiPack) {
            throw new HttpsError("already-exists", "You already have AI Pack");
        }

        const aiPackPriceId = STRIPE_PRICES.ai_pack_monthly;
        if (!aiPackPriceId) {
            throw new HttpsError("failed-precondition", "AI Pack price not configured");
        }

        // Add AI Pack to subscription
        await getStripe().subscriptionItems.create({
            subscription: billing.stripeSubscriptionId,
            price: aiPackPriceId,
        });

        functions.logger.info(`Added AI Pack to subscription for user ${uid}`);

        return { success: true };
    }
);
