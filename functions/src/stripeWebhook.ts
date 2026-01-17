/**
 * Stripe Webhook Handler for KonnectedRoots
 * 
 * Handles Stripe events and syncs subscription status to Firestore.
 * Based on Implementation_pack.md specification.
 */

import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
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

/**
 * Normalize Stripe subscription status to our billing status
 */
function normalizeStripeStatus(status: Stripe.Subscription.Status): string {
    switch (status) {
        case "active":
            return "active";
        case "trialing":
            return "trialing";
        case "past_due":
        case "unpaid":
            return "past_due";
        case "canceled":
        case "incomplete_expired":
            return "canceled";
        default:
            return "none";
    }
}

/**
 * Extract plan and addons from subscription items
 */
function mapSubscriptionToPlan(sub: Stripe.Subscription): {
    plan: "free" | "pro" | "family";
    interval: "month" | "year" | null;
    addons: { aiPack: boolean };
} {
    let plan: "free" | "pro" | "family" = "free";
    let interval: "month" | "year" | null = null;
    let aiPack = false;

    for (const item of sub.items.data) {
        const price = item.price;
        const md = (price.metadata || {}) as Record<string, string>;

        if (md.kr_plan === "pro") {
            plan = "pro";
            interval = (price.recurring?.interval as "month" | "year") || null;
        }
        if (md.kr_plan === "family") {
            plan = "family";
            interval = (price.recurring?.interval as "month" | "year") || null;
        }
        if (md.kr_addon === "ai_pack") {
            aiPack = true;
        }
    }

    return { plan, interval, addons: { aiPack } };
}

/**
 * Update user billing in Firestore
 */
async function upsertUserBilling(
    uid: string,
    billing: {
        plan: "free" | "pro" | "family";
        status: string;
        interval: "month" | "year" | null;
        addons: { aiPack: boolean };
        stripeCustomerId: string;
        stripeSubscriptionId: string;
        currentPeriodEnd: number;
        cancelAtPeriodEnd: boolean;
    }
) {
    const userRef = db.collection("users").doc(uid);
    await userRef.set(
        {
            billing: {
                plan: billing.plan,
                status: billing.status,
                stripeCustomerId: billing.stripeCustomerId,
                stripeSubscriptionId: billing.stripeSubscriptionId,
                currentPeriodEnd: billing.currentPeriodEnd,
                cancelAtPeriodEnd: billing.cancelAtPeriodEnd,
                interval: billing.interval,
                addons: billing.addons,
                updatedAt: Date.now(),
            },
        },
        { merge: true }
    );

    logger.info(`Updated billing for user ${uid}: plan=${billing.plan}, status=${billing.status}`);
}

/**
 * Update family billing in Firestore
 */
async function upsertFamilyBilling(
    familyId: string,
    billing: {
        status: string;
        addons: { aiPack: boolean };
        stripeCustomerId: string;
        stripeSubscriptionId: string;
        currentPeriodEnd: number;
        cancelAtPeriodEnd: boolean;
    }
) {
    const famRef = db.collection("families").doc(familyId);
    await famRef.set(
        {
            plan: {
                status: billing.status,
                stripeCustomerId: billing.stripeCustomerId,
                stripeSubscriptionId: billing.stripeSubscriptionId,
                currentPeriodEnd: billing.currentPeriodEnd,
                seatLimit: 6,
                addons: billing.addons,
                updatedAt: Date.now(),
            },
        },
        { merge: true }
    );

    logger.info(`Updated billing for family ${familyId}: status=${billing.status}`);
}

/**
 * Stripe Webhook Handler
 * 
 * Listens for Stripe events and syncs to Firestore.
 */
export const stripeWebhook = onRequest(
    {
        region: "us-central1",
        secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    },
    async (req, res) => {
        // Only accept POST
        if (req.method !== "POST") {
            res.status(405).send("Method Not Allowed");
            return;
        }

        let event: Stripe.Event;

        // 1) Verify signature (must use raw body)
        const sig = req.headers["stripe-signature"] as string;
        try {
            event = getStripe().webhooks.constructEvent(
                (req as any).rawBody,
                sig,
                process.env.STRIPE_WEBHOOK_SECRET!
            );
        } catch (err) {
            logger.error("Webhook signature verification failed:", err);
            res.status(400).send(`Webhook Error: ${(err as Error).message}`);
            return;
        }

        // 2) Idempotency guard
        const eventRef = db.collection("billing_events").doc(event.id);
        const existing = await eventRef.get();
        if (existing.exists) {
            logger.info(`Event ${event.id} already processed`);
            res.status(200).send("Already processed");
            return;
        }

        // 3) Store event stub immediately
        await eventRef.set({
            eventId: event.id,
            type: event.type,
            receivedAt: Date.now(),
            processed: false,
        });

        try {
            // 4) Handle subscription events
            switch (event.type) {
                case "checkout.session.completed": {
                    const session = event.data.object as Stripe.Checkout.Session;
                    logger.info(`Checkout completed for session ${session.id}`);
                    // Subscription events will handle the actual billing update
                    break;
                }

                case "customer.subscription.created":
                case "customer.subscription.updated":
                case "customer.subscription.deleted": {
                    const sub = event.data.object as Stripe.Subscription;

                    // Fetch customer to get kr_uid / kr_family_id
                    const customer = (await getStripe().customers.retrieve(
                        sub.customer as string
                    )) as Stripe.Customer;

                    const uid = (customer.metadata?.kr_uid || "").trim();
                    const familyId = (customer.metadata?.kr_family_id || "").trim() || null;

                    // Determine plan + addons from subscription items
                    const { plan, interval, addons } = mapSubscriptionToPlan(sub);

                    const status = normalizeStripeStatus(sub.status);
                    // Cast to any to handle SDK type differences
                    const subData = sub as any;
                    const currentPeriodEnd = (subData.current_period_end || subData.currentPeriodEnd || 0) * 1000;
                    const cancelAtPeriodEnd = subData.cancel_at_period_end ?? subData.cancelAtPeriodEnd ?? false;

                    if (familyId) {
                        await upsertFamilyBilling(familyId, {
                            status,
                            addons,
                            stripeCustomerId: customer.id,
                            stripeSubscriptionId: sub.id,
                            currentPeriodEnd,
                            cancelAtPeriodEnd: cancelAtPeriodEnd,
                        });

                        // Also update owner's user billing to reflect family membership
                        if (uid) {
                            await upsertUserBilling(uid, {
                                plan: "family",
                                status,
                                interval,
                                addons,
                                stripeCustomerId: customer.id,
                                stripeSubscriptionId: sub.id,
                                currentPeriodEnd,
                                cancelAtPeriodEnd: cancelAtPeriodEnd,
                            });
                        }
                    } else {
                        if (!uid) {
                            throw new Error("Missing kr_uid for non-family subscription");
                        }
                        await upsertUserBilling(uid, {
                            plan,
                            status,
                            interval,
                            addons,
                            stripeCustomerId: customer.id,
                            stripeSubscriptionId: sub.id,
                            currentPeriodEnd,
                            cancelAtPeriodEnd: cancelAtPeriodEnd,
                        });
                    }

                    break;
                }

                case "invoice.payment_failed": {
                    logger.warn("Payment failed - subscription.updated will handle status");
                    break;
                }

                case "invoice.paid": {
                    logger.info("Invoice paid - subscription.updated will ensure active status");
                    break;
                }

                default:
                    logger.info(`Unhandled event type: ${event.type}`);
                    break;
            }

            await eventRef.update({ processed: true, processedAt: Date.now() });
            res.status(200).send("OK");
        } catch (err) {
            logger.error("Webhook handler error:", err);
            await eventRef.update({
                processed: false,
                error: String(err),
                processedAt: Date.now(),
            });
            res.status(500).send("Webhook handler error");
        }
    }
);
