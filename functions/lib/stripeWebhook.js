"use strict";
/**
 * Stripe Webhook Handler for KonnectedRoots
 *
 * Handles Stripe events and syncs subscription status to Firestore.
 * Based on Implementation_pack.md specification.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhook = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const stripe_1 = __importDefault(require("stripe"));
const admin = __importStar(require("firebase-admin"));
// Ensure Firebase Admin is initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
// Initialize Stripe lazily (secrets not available at deploy time)
let _stripe = null;
function getStripe() {
    if (!_stripe) {
        _stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY);
    }
    return _stripe;
}
/**
 * Normalize Stripe subscription status to our billing status
 */
function normalizeStripeStatus(status) {
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
function mapSubscriptionToPlan(sub) {
    var _a, _b;
    let plan = "free";
    let interval = null;
    let aiPack = false;
    for (const item of sub.items.data) {
        const price = item.price;
        const md = (price.metadata || {});
        if (md.kr_plan === "pro") {
            plan = "pro";
            interval = ((_a = price.recurring) === null || _a === void 0 ? void 0 : _a.interval) || null;
        }
        if (md.kr_plan === "family") {
            plan = "family";
            interval = ((_b = price.recurring) === null || _b === void 0 ? void 0 : _b.interval) || null;
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
async function upsertUserBilling(uid, billing) {
    const userRef = db.collection("users").doc(uid);
    await userRef.set({
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
    }, { merge: true });
    logger.info(`Updated billing for user ${uid}: plan=${billing.plan}, status=${billing.status}`);
}
/**
 * Update family billing in Firestore
 */
async function upsertFamilyBilling(familyId, billing) {
    const famRef = db.collection("families").doc(familyId);
    await famRef.set({
        plan: {
            status: billing.status,
            stripeCustomerId: billing.stripeCustomerId,
            stripeSubscriptionId: billing.stripeSubscriptionId,
            currentPeriodEnd: billing.currentPeriodEnd,
            seatLimit: 6,
            addons: billing.addons,
            updatedAt: Date.now(),
        },
    }, { merge: true });
    logger.info(`Updated billing for family ${familyId}: status=${billing.status}`);
}
/**
 * Stripe Webhook Handler
 *
 * Listens for Stripe events and syncs to Firestore.
 */
exports.stripeWebhook = (0, https_1.onRequest)({
    region: "us-central1",
    secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
}, async (req, res) => {
    var _a, _b, _c, _d;
    // Only accept POST
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }
    let event;
    // 1) Verify signature (must use raw body)
    const sig = req.headers["stripe-signature"];
    try {
        event = getStripe().webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    }
    catch (err) {
        logger.error("Webhook signature verification failed:", err);
        res.status(400).send(`Webhook Error: ${err.message}`);
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
                const session = event.data.object;
                logger.info(`Checkout completed for session ${session.id}`);
                // Subscription events will handle the actual billing update
                break;
            }
            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
                const sub = event.data.object;
                // Fetch customer to get kr_uid / kr_family_id
                const customer = (await getStripe().customers.retrieve(sub.customer));
                const uid = (((_a = customer.metadata) === null || _a === void 0 ? void 0 : _a.kr_uid) || "").trim();
                const familyId = (((_b = customer.metadata) === null || _b === void 0 ? void 0 : _b.kr_family_id) || "").trim() || null;
                // Determine plan + addons from subscription items
                const { plan, interval, addons } = mapSubscriptionToPlan(sub);
                const status = normalizeStripeStatus(sub.status);
                // Cast to any to handle SDK type differences
                const subData = sub;
                const currentPeriodEnd = (subData.current_period_end || subData.currentPeriodEnd || 0) * 1000;
                const cancelAtPeriodEnd = (_d = (_c = subData.cancel_at_period_end) !== null && _c !== void 0 ? _c : subData.cancelAtPeriodEnd) !== null && _d !== void 0 ? _d : false;
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
                }
                else {
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
    }
    catch (err) {
        logger.error("Webhook handler error:", err);
        await eventRef.update({
            processed: false,
            error: String(err),
            processedAt: Date.now(),
        });
        res.status(500).send("Webhook handler error");
    }
});
//# sourceMappingURL=stripeWebhook.js.map