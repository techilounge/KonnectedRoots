/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import * as logger from "firebase-functions/logger";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

// Initialize the Admin SDK
admin.initializeApp();
const auth = admin.auth();
const db = admin.firestore();

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
export const updateTreeMemberCount = onDocumentWritten("trees/{treeId}", async (event) => {
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
