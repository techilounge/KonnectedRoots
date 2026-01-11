/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import * as logger from "firebase-functions/logger";
import { onDocumentWritten, onDocumentCreated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { Resend } from "resend";

// Initialize the Admin SDK
admin.initializeApp();
const auth = admin.auth();
const db = admin.firestore();

// Function to handle invitation acceptance securely
export const acceptInvitation = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be logged in to accept an invitation.');
  }

  const { invitationId } = request.data;
  if (!invitationId) {
    throw new HttpsError('invalid-argument', 'Invitation ID is required.');
  }

  const user = request.auth;
  const invitationRef = db.collection('invitations').doc(invitationId);

  try {
    const invitationDoc = await invitationRef.get();
    if (!invitationDoc.exists) {
      throw new HttpsError('not-found', 'Invitation not found.');
    }

    const invitation = invitationDoc.data();
    if (!invitation) {
      throw new HttpsError('not-found', 'Invitation data is empty.');
    }

    // Verify the accepting user matches the invitee email
    if (invitation.inviteeEmail.toLowerCase() !== user.token.email?.toLowerCase()) {
      throw new HttpsError('permission-denied', 'This invitation was sent to a different email address.');
    }

    if (invitation.status !== 'pending') {
      throw new HttpsError('failed-precondition', `Invitation is already ${invitation.status}.`);
    }

    const treeRef = db.collection('trees').doc(invitation.treeId);

    // Run as transaction or batched write
    await db.runTransaction(async (transaction) => {
      const treeDoc = await transaction.get(treeRef);
      if (!treeDoc.exists) {
        throw new HttpsError('not-found', 'Tree not found.');
      }

      const collaborators = treeDoc.data()?.collaborators || {};

      // Update tree collaborators
      transaction.update(treeRef, {
        collaborators: {
          ...collaborators,
          [user.uid]: invitation.role
        }
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

    return { success: true };

  } catch (error) {
    logger.error("Error accepting invitation:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', 'Internal server error while accepting invitation.');
  }
});

// This function triggers whenever a document in the 'trees' collection is written (created or updated).
// It sets a custom claim on the owner's user account, enabling security rules to quickly verify ownership.
export const setTreeOwnerClaim = onDocumentWritten("trees/{treeId}", async (event) => {
  if (!event.data) {
    logger.info("No data associated with the event, skipping.");
    return;
  }

  // Get the owner's UID from the tree document.
  // Using after.data() means we get the most recent state of the document.
  const ownerId = event.data.after.data()?.ownerId;

  if (!ownerId) {
    logger.warn(`Tree document ${event.params.treeId} is missing ownerId.`);
    return;
  }

  // The custom claim key is prefixed to avoid collisions and clearly identify its purpose.
  const customClaimKey = `isOwnerOfTree_${event.params.treeId}`;

  try {
    // Retrieve the user's current custom claims.
    const user = await auth.getUser(ownerId);
    const existingClaims = user.customClaims || {};

    // If the claim is not already set to true, set it.
    if (existingClaims[customClaimKey] !== true) {
      const newClaims = {
        ...existingClaims,
        [customClaimKey]: true,
      };

      await auth.setCustomUserClaims(ownerId, newClaims);
      logger.info(`Successfully set custom claim '${customClaimKey}' for user ${ownerId}.`);
    } else {
      logger.info(`Claim '${customClaimKey}' already exists for user ${ownerId}. No update needed.`);
    }

  } catch (error) {
    logger.error(`Failed to set custom claim for user ${ownerId} on tree ${event.params.treeId}`, error);
  }
});


// This function triggers whenever a person is added, updated, or deleted in a tree.
// It recounts the total number of people in the tree and updates the 'memberCount' field.
export const updateTreeMemberCount = onDocumentWritten("trees/{treeId}/people/{personId}", async (event) => {
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
  } catch (error) {
    logger.error(`Failed to update memberCount for tree ${treeId}.`, error);
  }
});


export const sendInvitationEmail = onDocumentWritten("invitations/{inviteId}", async (event) => {
  if (!event.data) return; // Document deleted

  // Check if document exists after change (it might be a delete operation)
  if (!event.data.after.exists) return;

  const afterData = event.data.after.data();
  const beforeData = event.data.before.data();

  if (!afterData) return;

  const { inviteeEmail, inviterUid, treeId, role } = afterData;
  if (!inviteeEmail) return;

  // Determine if we should send
  let shouldSend = false;

  // Case 1: New Invitation (ignoring if already marked sent during creation which is rare)
  if (!beforeData) {
    if (!afterData.emailSent) shouldSend = true;
  }
  // Case 2: Resend Triggered (check if resendTrigger timestamp changed)
  else {
    // Compare timestamps (using .isEqual for Firestore timestamps if available, or strict equality given serialized)
    // Check if field exists and changed
    if (afterData.resendTrigger && (!beforeData.resendTrigger || !afterData.resendTrigger.isEqual(beforeData.resendTrigger))) {
      shouldSend = true;
    }
  }

  if (!shouldSend) return;

  try {
    // Fetch Inviter Details
    const inviterDoc = await db.collection('users').doc(inviterUid).get();
    const inviterName = inviterDoc.exists ? (inviterDoc.data()?.displayName || inviterDoc.data()?.email) : 'Someone';

    // Fetch Tree Details
    const treeDoc = await db.collection('trees').doc(treeId).get();
    const treeTitle = treeDoc.exists ? treeDoc.data()?.title : 'a Family Tree';

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      logger.error("RESEND_API_KEY is not set.");
      return;
    }

    const resend = new Resend(apiKey);

    // Use production URL for email links
    const inviteUrl = `https://${process.env.GCLOUD_PROJECT || 'konnectedroots-u5xtb'}.web.app/invite/${event.params.inviteId}`;

    const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>You've been invited via KonnectedRoots!</h2>
                <p><strong>${inviterName}</strong> invited you to collaborate on <strong>"${treeTitle}"</strong> as a <strong>${role}</strong>.</p>
                <p>Click the button below to accept the invitation and start exploring your shared ancestry:</p>
                <div style="margin: 24px 0;">
                    <a href="${inviteUrl}" style="background-color: #2F855A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Accept Invitation</a>
                </div>
                <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:<br> <a href="${inviteUrl}">${inviteUrl}</a></p>
                <hr style="margin-top: 40px; border: none; border-top: 1px solid #eee;">
                <p style="color: #999; font-size: 12px;">KonnectedRoots - Collaborative Family Trees</p>
            </div>
        `;

    const { data, error } = await resend.emails.send({
      from: 'KonnectedRoots <noreply@updates.konnectedroots.app>',
      to: [inviteeEmail],
      subject: `${inviterName} invited you to collaborate on ${treeTitle}`,
      html: html,
    });

    if (error) {
      logger.error("Resend error:", error);
      // We don't throw here to avoid infinite retries if the error is permanent (like invalid email)
      return;
    }

    // Mark as sent
    // Update both emailSent and lastEmailSentAt
    await event.data.after.ref.update({
      emailSent: true,
      emailId: data?.id,
      lastEmailSentAt: admin.firestore.FieldValue.serverTimestamp()
    });
    logger.info(`Invitation email sent to ${inviteeEmail}`);

  } catch (err) {
    logger.error("Error sending invitation email:", err);
  }
});


export const checkPendingInvitations = onDocumentCreated("users/{userId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const userData = snapshot.data();
  const email = userData.email;
  if (!email) return;

  try {
    const invitationsRef = db.collection('invitations');
    const q = invitationsRef.where('inviteeEmail', '==', email.toLowerCase()).where('status', '==', 'pending');

    const querySnapshot = await q.get();

    if (querySnapshot.empty) return;

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
  } catch (error) {
    logger.error("Error linking pending invitations:", error);
  }
});
