import { functionsEnv } from './config';
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
import { sendEmail } from "./sendEmail";
import {
  welcomeEmail,
  invitationAcceptedEmail,
  treeInviteEmail
} from "./emailTemplates";
import { validateCollaboratorAdd, type CollaboratorRole } from './collaborationPolicy';

// Initialize the Admin SDK
admin.initializeApp();
const db = admin.firestore();

// Export Stripe functions
export { stripeWebhook } from "./stripeWebhook";
export { createCheckoutSession, createPortalSession, addAIPack } from "./stripeBilling";

// Export scheduled tasks
export { weeklyActivityDigest, inactivityReminder, planExpirationReminder } from "./scheduledTasks";

// Create invitations through a trusted server transaction. Firestore rules do
// not permit clients to create invitation documents or mutate collaborator
// membership directly.
export const createInvitation = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'User must be logged in to invite collaborators.');

  const treeId = typeof request.data?.treeId === 'string' ? request.data.treeId.trim() : '';
  const inviteeEmail = typeof request.data?.inviteeEmail === 'string' ? request.data.inviteeEmail.trim().toLowerCase() : '';
  const role = request.data?.role as CollaboratorRole;
  if (!treeId || !inviteeEmail || !['viewer', 'editor', 'manager'].includes(role)) {
    throw new HttpsError('invalid-argument', 'Tree, invitee email, and a valid role are required.');
  }

  const treeRef = db.collection('trees').doc(treeId);
  const inviteeSnapshot = await db.collection('users').where('email', '==', inviteeEmail).limit(1).get();
  const inviteeUid = inviteeSnapshot.empty ? null : inviteeSnapshot.docs[0].id;
  const invitationRef = db.collection('invitations').doc();

  try {
    await db.runTransaction(async (transaction) => {
      const treeDoc = await transaction.get(treeRef);
      if (!treeDoc.exists) throw new HttpsError('not-found', 'Tree not found.');
      const treeData = treeDoc.data() || {};
      const inviterIsOwner = treeData.ownerId === request.auth!.uid;
      const inviterIsManager = treeData.collaborators?.[request.auth!.uid] === 'manager';
      if (!inviterIsOwner && !inviterIsManager) {
        throw new HttpsError('permission-denied', 'Only the tree owner or a manager can invite collaborators.');
      }

      const ownerRef = db.collection('users').doc(treeData.ownerId);
      const ownerDoc = await transaction.get(ownerRef);
      const pendingSnapshot = await transaction.get(
        db.collection('invitations')
          .where('treeId', '==', treeId)
          .where('status', '==', 'pending'),
      );
      const pendingInvitations = pendingSnapshot.docs.map(doc => doc.data());
      if (pendingInvitations.some(invitation => invitation.inviteeEmail === inviteeEmail)) {
        throw new HttpsError('already-exists', 'This email already has a pending invitation.');
      }
      const reservedCollaborators = { ...(treeData.collaborators || {}) };
      pendingInvitations.forEach((invitation, index) => {
        reservedCollaborators[`pending:${index}`] = invitation.role;
      });
      const validation = validateCollaboratorAdd(
        { ...treeData, collaborators: reservedCollaborators },
        role,
        ownerDoc.exists ? ownerDoc.data() : {},
        inviteeUid || undefined,
      );
      if (!validation.allowed) throw new HttpsError('failed-precondition', validation.reason);

      const inviterDoc = request.auth!.uid === treeData.ownerId
        ? ownerDoc
        : await transaction.get(db.collection('users').doc(request.auth!.uid));
      const inviterData = inviterDoc.exists ? inviterDoc.data() || {} : {};
      const invitation = {
        treeId,
        treeName: treeData.title || 'Family Tree',
        inviterUid: request.auth!.uid,
        inviterName: inviterData.displayName || inviterData.email || 'Someone',
        inviteeEmail,
        inviteeUid,
        role,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      transaction.create(invitationRef, invitation);

      if (inviteeUid) {
        const notificationRef = db.collection('notifications').doc();
        transaction.create(notificationRef, {
          userId: inviteeUid,
          type: 'tree_invite',
          title: 'Tree Invitation',
          message: `${inviterData.displayName || inviterData.email || 'Someone'} invited you to collaborate on "${invitation.treeName}" as ${role}`,
          data: { treeId, invitationId: invitationRef.id },
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    });
    return { success: true, invitationId: invitationRef.id };
  } catch (error) {
    logger.error('Error creating invitation:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Internal server error while creating invitation.');
  }
});

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

      const treeData = treeDoc.data();
      const ownerRef = db.collection('users').doc(treeData?.ownerId);
      const ownerDoc = await transaction.get(ownerRef);
      // VERIFY that the inviter is still owner or manager of the tree
      const isOwner = treeData?.ownerId === invitation.inviterUid;
      const isManager = treeData?.collaborators?.[invitation.inviterUid] === 'manager';
      if (!isOwner && !isManager) {
        throw new HttpsError('permission-denied', 'The inviter no longer has permission to invite users to this tree.');
      }

      const collaborators = treeData?.collaborators || {};
      const validation = validateCollaboratorAdd(
        treeData,
        invitation.role as CollaboratorRole,
        ownerDoc.exists ? ownerDoc.data() : {},
        user.uid,
      );
      if (!validation.allowed) {
        throw new HttpsError('failed-precondition', validation.reason);
      }

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

    // Send email notification to inviter (outside transaction)
    try {
      const inviterDoc = await db.collection('users').doc(invitation.inviterUid).get();
      const inviterData = inviterDoc.data();

      if (inviterData?.email) {
        // Check email preferences
        const prefs = inviterData.emailPreferences || {};
        if (prefs.treeActivity !== false) {
          const email = invitationAcceptedEmail(
            inviterData.displayName || inviterData.email,
            user.token.name || user.token.email || 'A user',
            invitation.treeName,
            invitation.treeId,
            invitation.role
          );

          await sendEmail({
            to: inviterData.email,
            subject: email.subject,
            html: email.html
          });

          logger.info(`Invitation accepted email sent to ${inviterData.email}`);
        }
      }
    } catch (emailError) {
      // Don't fail the whole operation if email fails
      logger.error("Error sending invitation accepted email:", emailError);
    }

    return { success: true };

  } catch (error) {
    logger.error("Error accepting invitation:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', 'Internal server error while accepting invitation.');
  }
});

// DEPRECATED: Previously set custom claims on user auth tokens on every tree write.
// Firebase Auth custom claims have a strict 1,000-byte limit and are not used in firestore.rules.
// Disabled to prevent token bloat from corrupting user authentication.
export const setTreeOwnerClaim = onDocumentWritten("trees/{treeId}", async () => {
  return;
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


export const sendInvitationEmail = onDocumentWritten(
  "invitations/{inviteId}",
  async (event) => {
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

    // Use production URL for email links
    const inviteUrl = `${functionsEnv.appUrl}/invite/${event.params.inviteId}`;

    // Generate branded email using template
    const email = treeInviteEmail(
      inviterName,
      inviteeEmail,
      treeTitle,
      role,
      inviteUrl
    );

    // Send email using centralized utility
    const result = await sendEmail({
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

  } catch (err) {
    logger.error("Error sending invitation email:", err);
  }
});

// Triggered when a new user document is created
// Handles: 1) Sending welcome email, 2) Linking pending invitations
export const onUserCreated = onDocumentCreated(
  "users/{userId}",
  async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const userData = snapshot.data();
  const email = userData.email;
  if (!email) return;

  // 1. Send Welcome Email
  try {
    const emailContent = welcomeEmail(userData.displayName || email);

    const result = await sendEmail({
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
    } else {
      logger.warn(`Failed to send welcome email to ${email}: ${result.error}`);
    }
  } catch (welcomeError) {
    logger.error("Error sending welcome email:", welcomeError);
  }

  // 2. Link Pending Invitations
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
