"use strict";
/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.onUserCreated = exports.sendInvitationEmail = exports.updateTreeMemberCount = exports.setTreeOwnerClaim = exports.acceptInvitation = exports.planExpirationReminder = exports.inactivityReminder = exports.weeklyActivityDigest = exports.addAIPack = exports.createPortalSession = exports.createCheckoutSession = exports.stripeWebhook = void 0;
const logger = __importStar(require("firebase-functions/logger"));
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const sendEmail_1 = require("./sendEmail");
const emailTemplates_1 = require("./emailTemplates");
// Initialize the Admin SDK
admin.initializeApp();
const db = admin.firestore();
// Export Stripe functions
var stripeWebhook_1 = require("./stripeWebhook");
Object.defineProperty(exports, "stripeWebhook", { enumerable: true, get: function () { return stripeWebhook_1.stripeWebhook; } });
var stripeBilling_1 = require("./stripeBilling");
Object.defineProperty(exports, "createCheckoutSession", { enumerable: true, get: function () { return stripeBilling_1.createCheckoutSession; } });
Object.defineProperty(exports, "createPortalSession", { enumerable: true, get: function () { return stripeBilling_1.createPortalSession; } });
Object.defineProperty(exports, "addAIPack", { enumerable: true, get: function () { return stripeBilling_1.addAIPack; } });
// Export scheduled tasks
var scheduledTasks_1 = require("./scheduledTasks");
Object.defineProperty(exports, "weeklyActivityDigest", { enumerable: true, get: function () { return scheduledTasks_1.weeklyActivityDigest; } });
Object.defineProperty(exports, "inactivityReminder", { enumerable: true, get: function () { return scheduledTasks_1.inactivityReminder; } });
Object.defineProperty(exports, "planExpirationReminder", { enumerable: true, get: function () { return scheduledTasks_1.planExpirationReminder; } });
// Function to handle invitation acceptance securely
exports.acceptInvitation = (0, https_1.onCall)(async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be logged in to accept an invitation.');
    }
    const { invitationId } = request.data;
    if (!invitationId) {
        throw new https_1.HttpsError('invalid-argument', 'Invitation ID is required.');
    }
    const user = request.auth;
    const invitationRef = db.collection('invitations').doc(invitationId);
    try {
        const invitationDoc = await invitationRef.get();
        if (!invitationDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Invitation not found.');
        }
        const invitation = invitationDoc.data();
        if (!invitation) {
            throw new https_1.HttpsError('not-found', 'Invitation data is empty.');
        }
        // Verify the accepting user matches the invitee email
        if (invitation.inviteeEmail.toLowerCase() !== ((_a = user.token.email) === null || _a === void 0 ? void 0 : _a.toLowerCase())) {
            throw new https_1.HttpsError('permission-denied', 'This invitation was sent to a different email address.');
        }
        if (invitation.status !== 'pending') {
            throw new https_1.HttpsError('failed-precondition', `Invitation is already ${invitation.status}.`);
        }
        const treeRef = db.collection('trees').doc(invitation.treeId);
        // Run as transaction or batched write
        await db.runTransaction(async (transaction) => {
            var _a;
            const treeDoc = await transaction.get(treeRef);
            if (!treeDoc.exists) {
                throw new https_1.HttpsError('not-found', 'Tree not found.');
            }
            const treeData = treeDoc.data();
            // VERIFY that the inviter is still owner or manager of the tree
            const isOwner = (treeData === null || treeData === void 0 ? void 0 : treeData.ownerId) === invitation.inviterUid;
            const isManager = ((_a = treeData === null || treeData === void 0 ? void 0 : treeData.collaborators) === null || _a === void 0 ? void 0 : _a[invitation.inviterUid]) === 'manager';
            if (!isOwner && !isManager) {
                throw new https_1.HttpsError('permission-denied', 'The inviter no longer has permission to invite users to this tree.');
            }
            const collaborators = (treeData === null || treeData === void 0 ? void 0 : treeData.collaborators) || {};
            // Update tree collaborators
            transaction.update(treeRef, {
                collaborators: Object.assign(Object.assign({}, collaborators), { [user.uid]: invitation.role })
            });
            // Update invitation status
            transaction.update(invitationRef, {
                status: 'accepted',
                inviteeUid: user.uid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            // Create notification for inviter
            const notificationRef = db.collection('notifications').doc();
            transaction.set(notificationRef, {
                userId: invitation.inviterUid,
                type: 'invite_accepted',
                title: 'Invitation Accepted',
                message: `${user.token.name || user.token.email} accepted your invitation to "${invitation.treeName}"`,
                data: { treeId: invitation.treeId },
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });
        // Send email notification to inviter (outside transaction)
        try {
            const inviterDoc = await db.collection('users').doc(invitation.inviterUid).get();
            const inviterData = inviterDoc.data();
            if (inviterData === null || inviterData === void 0 ? void 0 : inviterData.email) {
                // Check email preferences
                const prefs = inviterData.emailPreferences || {};
                if (prefs.treeActivity !== false) {
                    const email = (0, emailTemplates_1.invitationAcceptedEmail)(inviterData.displayName || inviterData.email, user.token.name || user.token.email || 'A user', invitation.treeName, invitation.treeId, invitation.role);
                    await (0, sendEmail_1.sendEmail)({
                        to: inviterData.email,
                        subject: email.subject,
                        html: email.html
                    });
                    logger.info(`Invitation accepted email sent to ${inviterData.email}`);
                }
            }
        }
        catch (emailError) {
            // Don't fail the whole operation if email fails
            logger.error("Error sending invitation accepted email:", emailError);
        }
        return { success: true };
    }
    catch (error) {
        logger.error("Error accepting invitation:", error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', 'Internal server error while accepting invitation.');
    }
});
// DEPRECATED: Previously set custom claims on user auth tokens on every tree write.
// Firebase Auth custom claims have a strict 1,000-byte limit and are not used in firestore.rules.
// Disabled to prevent token bloat from corrupting user authentication.
exports.setTreeOwnerClaim = (0, firestore_1.onDocumentWritten)("trees/{treeId}", async () => {
    return;
});
// This function triggers whenever a person is added, updated, or deleted in a tree.
// It recounts the total number of people in the tree and updates the 'memberCount' field.
exports.updateTreeMemberCount = (0, firestore_1.onDocumentWritten)("trees/{treeId}/people/{personId}", async (event) => {
    const treeId = event.params.treeId;
    const treeDocRef = db.collection('trees').doc(treeId);
    try {
        // Get the collection of people for the affected tree.
        const peopleColRef = treeDocRef.collection('people');
        // Use the efficient .count() aggregation to get the number of documents.
        const snapshot = await peopleColRef.count().get();
        const memberCount = snapshot.data().count;
        // Update the memberCount on the parent tree document.
        await treeDocRef.update({ memberCount: memberCount });
        logger.info(`Successfully updated memberCount for tree ${treeId} to ${memberCount}.`);
    }
    catch (error) {
        logger.error(`Failed to update memberCount for tree ${treeId}.`, error);
    }
});
exports.sendInvitationEmail = (0, firestore_1.onDocumentWritten)("invitations/{inviteId}", async (event) => {
    var _a, _b, _c;
    if (!event.data)
        return; // Document deleted
    // Check if document exists after change (it might be a delete operation)
    if (!event.data.after.exists)
        return;
    const afterData = event.data.after.data();
    const beforeData = event.data.before.data();
    if (!afterData)
        return;
    const { inviteeEmail, inviterUid, treeId, role } = afterData;
    if (!inviteeEmail)
        return;
    // Determine if we should send
    let shouldSend = false;
    // Case 1: New Invitation (ignoring if already marked sent during creation which is rare)
    if (!beforeData) {
        if (!afterData.emailSent)
            shouldSend = true;
    }
    // Case 2: Resend Triggered (check if resendTrigger timestamp changed)
    else {
        // Compare timestamps (using .isEqual for Firestore timestamps if available, or strict equality given serialized)
        // Check if field exists and changed
        if (afterData.resendTrigger && (!beforeData.resendTrigger || !afterData.resendTrigger.isEqual(beforeData.resendTrigger))) {
            shouldSend = true;
        }
    }
    if (!shouldSend)
        return;
    try {
        // Fetch Inviter Details
        const inviterDoc = await db.collection('users').doc(inviterUid).get();
        const inviterName = inviterDoc.exists ? (((_a = inviterDoc.data()) === null || _a === void 0 ? void 0 : _a.displayName) || ((_b = inviterDoc.data()) === null || _b === void 0 ? void 0 : _b.email)) : 'Someone';
        // Fetch Tree Details
        const treeDoc = await db.collection('trees').doc(treeId).get();
        const treeTitle = treeDoc.exists ? (_c = treeDoc.data()) === null || _c === void 0 ? void 0 : _c.title : 'a Family Tree';
        // Use production URL for email links
        const inviteUrl = `https://konnectedroots.app/invite/${event.params.inviteId}`;
        // Generate branded email using template
        const email = (0, emailTemplates_1.treeInviteEmail)(inviterName, inviteeEmail, treeTitle, role, inviteUrl);
        // Send email using centralized utility
        const result = await (0, sendEmail_1.sendEmail)({
            to: inviteeEmail,
            subject: email.subject,
            html: email.html
        });
        if (!result.success) {
            logger.error("Error sending invitation email:", result.error);
            // We don't throw here to avoid infinite retries if the error is permanent (like invalid email)
            return;
        }
        // Mark as sent
        // Update both emailSent and lastEmailSentAt
        await event.data.after.ref.update({
            emailSent: true,
            emailId: result.emailId,
            lastEmailSentAt: admin.firestore.FieldValue.serverTimestamp()
        });
        logger.info(`Invitation email sent to ${inviteeEmail}`);
    }
    catch (err) {
        logger.error("Error sending invitation email:", err);
    }
});
// Triggered when a new user document is created
// Handles: 1) Sending welcome email, 2) Linking pending invitations
exports.onUserCreated = (0, firestore_1.onDocumentCreated)("users/{userId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot)
        return;
    const userData = snapshot.data();
    const email = userData.email;
    if (!email)
        return;
    // 1. Send Welcome Email
    try {
        const emailContent = (0, emailTemplates_1.welcomeEmail)(userData.displayName || email);
        const result = await (0, sendEmail_1.sendEmail)({
            to: email,
            subject: emailContent.subject,
            html: emailContent.html
        });
        if (result.success) {
            logger.info(`Welcome email sent to ${email}`);
            // Mark welcome email as sent
            await snapshot.ref.update({
                welcomeEmailSent: true,
                welcomeEmailSentAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        else {
            logger.warn(`Failed to send welcome email to ${email}: ${result.error}`);
        }
    }
    catch (welcomeError) {
        logger.error("Error sending welcome email:", welcomeError);
    }
    // 2. Link Pending Invitations
    try {
        const invitationsRef = db.collection('invitations');
        const q = invitationsRef.where('inviteeEmail', '==', email.toLowerCase()).where('status', '==', 'pending');
        const querySnapshot = await q.get();
        if (querySnapshot.empty)
            return;
        const batch = db.batch();
        querySnapshot.forEach(doc => {
            batch.update(doc.ref, { inviteeUid: event.params.userId });
            // Also create a notification for the new user
            const notificationRef = db.collection('notifications').doc();
            batch.set(notificationRef, {
                userId: event.params.userId,
                type: 'tree_invite',
                title: 'Tree Invitation',
                message: `${doc.data().inviterName || 'Someone'} invited you to collaborate on "${doc.data().treeName}"`,
                data: { treeId: doc.data().treeId, invitationId: doc.id },
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });
        await batch.commit();
        logger.info(`Linked ${querySnapshot.size} pending invitations for user ${email}`);
    }
    catch (error) {
        logger.error("Error linking pending invitations:", error);
    }
});
//# sourceMappingURL=index.js.map