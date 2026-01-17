"use strict";
/**
 * Stripe Checkout & Portal Session Handlers for KonnectedRoots
 *
 * Callable functions for creating Stripe Checkout and Customer Portal sessions.
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
exports.addAIPack = exports.createPortalSession = exports.createCheckoutSession = void 0;
const https_1 = require("firebase-functions/v2/https");
const functions = __importStar(require("firebase-functions/v2"));
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
// Stripe Price IDs (set via environment or secrets)
const STRIPE_PRICES = {
    pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || "",
    pro_yearly: process.env.STRIPE_PRICE_PRO_YEARLY || "",
    family_monthly: process.env.STRIPE_PRICE_FAMILY_MONTHLY || "",
    family_yearly: process.env.STRIPE_PRICE_FAMILY_YEARLY || "",
    ai_pack_monthly: process.env.STRIPE_PRICE_AI_PACK || "",
};
/**
 * Create Stripe Checkout Session
 *
 * Creates a checkout session for Pro or Family subscription.
 */
exports.createCheckoutSession = (0, https_1.onCall)({
    region: "us-central1",
    secrets: ["STRIPE_SECRET_KEY"],
}, async (request) => {
    var _a, _b;
    // Must be authenticated
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Must be logged in to subscribe");
    }
    const uid = request.auth.uid;
    const data = request.data;
    const { plan, interval, familyId, addons, successUrl, cancelUrl } = data;
    // Validate plan
    if (!["pro", "family"].includes(plan)) {
        throw new https_1.HttpsError("invalid-argument", "Invalid plan");
    }
    // Validate interval
    if (!["month", "year"].includes(interval)) {
        throw new https_1.HttpsError("invalid-argument", "Invalid interval");
    }
    // Get user data
    const userDoc = await db.collection("users").doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    const userEmail = request.auth.token.email;
    // Check if user already has an active subscription
    if (((_a = userData === null || userData === void 0 ? void 0 : userData.billing) === null || _a === void 0 ? void 0 : _a.status) === "active") {
        throw new https_1.HttpsError("already-exists", "You already have an active subscription. Use the billing portal to manage it.");
    }
    // Build line items
    const lineItems = [];
    // Main plan
    const priceKey = `${plan}_${interval === "month" ? "monthly" : "yearly"}`;
    const priceId = STRIPE_PRICES[priceKey];
    if (!priceId) {
        throw new https_1.HttpsError("failed-precondition", `Price not configured: ${priceKey}`);
    }
    lineItems.push({
        price: priceId,
        quantity: 1,
    });
    // AI Pack add-on (only if purchasing Pro/Family)
    if (addons === null || addons === void 0 ? void 0 : addons.aiPack) {
        const aiPackPriceId = STRIPE_PRICES.ai_pack_monthly;
        if (!aiPackPriceId) {
            throw new https_1.HttpsError("failed-precondition", "AI Pack price not configured");
        }
        lineItems.push({
            price: aiPackPriceId,
            quantity: 1,
        });
    }
    // Get or create Stripe customer
    let customerId = (_b = userData === null || userData === void 0 ? void 0 : userData.billing) === null || _b === void 0 ? void 0 : _b.stripeCustomerId;
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
                metadata: Object.assign({ kr_uid: uid }, (familyId ? { kr_family_id: familyId } : {})),
            });
        }
        else {
            // Create new customer
            const customer = await getStripe().customers.create({
                email: userEmail,
                metadata: Object.assign({ kr_uid: uid }, (familyId ? { kr_family_id: familyId } : {})),
            });
            customerId = customer.id;
        }
        // Save customer ID to user doc
        await db.collection("users").doc(uid).set({
            billing: {
                stripeCustomerId: customerId,
            },
        }, { merge: true });
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
        await db.collection("users").doc(uid).set({
            family: {
                familyId: familyRef.id,
                role: "owner",
                joinedAt: Date.now(),
            },
        }, { merge: true });
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
        metadata: Object.assign({ kr_uid: uid, kr_plan: plan }, (familyId ? { kr_family_id: familyId } : {})),
        subscription_data: {
            metadata: Object.assign({ kr_uid: uid, kr_plan: plan }, (familyId ? { kr_family_id: familyId } : {})),
        },
    });
    functions.logger.info(`Created checkout session ${session.id} for user ${uid}`);
    return {
        sessionId: session.id,
        url: session.url,
    };
});
/**
 * Create Stripe Customer Portal Session
 *
 * Allows users to manage their subscription.
 */
exports.createPortalSession = (0, https_1.onCall)({
    region: "us-central1",
    secrets: ["STRIPE_SECRET_KEY"],
}, async (request) => {
    var _a;
    // Must be authenticated
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Must be logged in");
    }
    const uid = request.auth.uid;
    // Get user data
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
        throw new https_1.HttpsError("not-found", "User not found");
    }
    const userData = userDoc.data();
    const customerId = (_a = userData === null || userData === void 0 ? void 0 : userData.billing) === null || _a === void 0 ? void 0 : _a.stripeCustomerId;
    if (!customerId) {
        throw new https_1.HttpsError("failed-precondition", "No billing account found");
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
});
/**
 * Add AI Pack to existing subscription
 */
exports.addAIPack = (0, https_1.onCall)({
    region: "us-central1",
    secrets: ["STRIPE_SECRET_KEY"],
}, async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Must be logged in");
    }
    const uid = request.auth.uid;
    // Get user data
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
        throw new https_1.HttpsError("not-found", "User not found");
    }
    const userData = userDoc.data();
    const billing = userData === null || userData === void 0 ? void 0 : userData.billing;
    // Must have Pro or Family subscription
    if (!(billing === null || billing === void 0 ? void 0 : billing.stripeSubscriptionId) || !["pro", "family"].includes(billing.plan)) {
        throw new https_1.HttpsError("failed-precondition", "AI Pack requires Pro or Family subscription");
    }
    // Already has AI Pack?
    if ((_a = billing.addons) === null || _a === void 0 ? void 0 : _a.aiPack) {
        throw new https_1.HttpsError("already-exists", "You already have AI Pack");
    }
    const aiPackPriceId = STRIPE_PRICES.ai_pack_monthly;
    if (!aiPackPriceId) {
        throw new https_1.HttpsError("failed-precondition", "AI Pack price not configured");
    }
    // Add AI Pack to subscription
    await getStripe().subscriptionItems.create({
        subscription: billing.stripeSubscriptionId,
        price: aiPackPriceId,
    });
    functions.logger.info(`Added AI Pack to subscription for user ${uid}`);
    return { success: true };
});
//# sourceMappingURL=stripeBilling.js.map