/**
 * Scheduled Tasks for KonnectedRoots
 * 
 * Cloud Functions that run on a schedule to handle:
 * - Weekly activity digest emails
 * - Inactivity reminder emails
 * - Plan expiration reminder emails
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { sendEmail } from "./sendEmail";
import {
    activityDigestEmail,
    inactivityReminderEmail,
    planExpiringEmail
} from "./emailTemplates";

// Lazy-initialize Firestore (Firebase Admin is initialized in index.ts)
function getDb() {
    return admin.firestore();
}

/**
 * Weekly Activity Digest
 * 
 * Runs every Monday at 9:00 AM UTC
 * Sends a summary of the past week's activity to each user
 */
export const weeklyActivityDigest = onSchedule(
    {
        schedule: "0 9 * * 1", // Every Monday at 9 AM UTC
        timeZone: "UTC",
        retryCount: 3,
    },
    async () => {
        logger.info("Starting weekly activity digest job");

        const db = getDb();
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        try {
            // Get all users who have opted in to digest emails
            const usersSnapshot = await db.collection("users")
                .where("emailPreferences.marketing", "!=", false)
                .get();

            let emailsSent = 0;
            let errors = 0;

            for (const userDoc of usersSnapshot.docs) {
                const userData = userDoc.data();
                const userId = userDoc.id;

                // Skip if no email
                if (!userData.email) continue;

                // Check email preferences (default to true if not set)
                const prefs = userData.emailPreferences || {};
                if (prefs.marketing === false) continue;

                try {
                    // Get user's trees
                    const treesSnapshot = await db.collection("trees")
                        .where("ownerId", "==", userId)
                        .get();

                    const treeIds = treesSnapshot.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => doc.id);

                    // Also get trees where user is a collaborator
                    const collabTreesSnapshot = await db.collection("trees")
                        .where(`collaborators.${userId}`, "in", ["viewer", "editor", "manager"])
                        .get();

                    collabTreesSnapshot.docs.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
                        if (!treeIds.includes(doc.id)) {
                            treeIds.push(doc.id);
                        }
                    });

                    // Calculate activity stats
                    let treesModified = 0;
                    let membersAdded = 0;
                    let topTreeName = "";
                    let maxActivity = 0;

                    for (const treeId of treeIds) {
                        const treeDoc = await db.collection("trees").doc(treeId).get();
                        const treeData = treeDoc.data();

                        if (!treeData) continue;

                        // Check if tree was modified this week
                        const lastUpdated = treeData.lastUpdated?.toDate?.() || new Date(0);
                        if (lastUpdated >= oneWeekAgo) {
                            treesModified++;

                            // Count new members added this week
                            const peopleSnapshot = await db.collection(`trees/${treeId}/people`)
                                .where("createdAt", ">=", oneWeekAgo)
                                .get();

                            const treeNewMembers = peopleSnapshot.size;
                            membersAdded += treeNewMembers;

                            // Track most active tree
                            if (treeNewMembers > maxActivity) {
                                maxActivity = treeNewMembers;
                                topTreeName = treeData.title || "Unnamed Tree";
                            }
                        }
                    }

                    // Count new collaborators this week
                    const invitationsSnapshot = await db.collection("invitations")
                        .where("inviterUid", "==", userId)
                        .where("status", "==", "accepted")
                        .where("updatedAt", ">=", oneWeekAgo)
                        .get();

                    const collaboratorsJoined = invitationsSnapshot.size;

                    // Generate and send email
                    const email = activityDigestEmail(
                        userData.displayName || userData.email,
                        {
                            treesModified,
                            membersAdded,
                            collaboratorsJoined,
                            topTreeName: topTreeName || undefined
                        }
                    );

                    const result = await sendEmail({
                        to: userData.email,
                        subject: email.subject,
                        html: email.html
                    });

                    if (result.success) {
                        emailsSent++;
                    } else {
                        errors++;
                        logger.warn(`Failed to send digest to ${userData.email}: ${result.error}`);
                    }

                } catch (userError) {
                    errors++;
                    logger.error(`Error processing digest for user ${userId}:`, userError);
                }
            }

            logger.info(`Weekly digest complete: ${emailsSent} sent, ${errors} errors`);

        } catch (error) {
            logger.error("Error running weekly activity digest:", error);
            throw error;
        }
    }
);

/**
 * Inactivity Reminder
 * 
 * Runs daily at 10:00 AM UTC
 * Sends reminder emails to users who haven't been active in 30+ days
 */
export const inactivityReminder = onSchedule(
    {
        schedule: "0 10 * * *", // Daily at 10 AM UTC
        timeZone: "UTC",
        retryCount: 3,
    },
    async () => {
        logger.info("Starting inactivity reminder job");

        const db = getDb();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        try {
            // Get users who haven't been active in 30-60 days
            // (We don't want to spam users who've been inactive longer)
            const usersSnapshot = await db.collection("users")
                .where("lastActivityAt", "<=", thirtyDaysAgo)
                .where("lastActivityAt", ">=", sixtyDaysAgo)
                .get();

            let emailsSent = 0;
            let errors = 0;

            for (const userDoc of usersSnapshot.docs) {
                const userData = userDoc.data();
                const userId = userDoc.id;

                // Skip if no email
                if (!userData.email) continue;

                // Check email preferences
                const prefs = userData.emailPreferences || {};
                if (prefs.reminders === false) continue;

                // Check if we already sent a reminder recently
                const lastReminder = userData.lastInactivityReminderSent?.toDate?.() || new Date(0);
                const thirtyDaysAgoFromNow = new Date();
                thirtyDaysAgoFromNow.setDate(thirtyDaysAgoFromNow.getDate() - 30);

                if (lastReminder > thirtyDaysAgoFromNow) {
                    // Already sent a reminder in the last 30 days
                    continue;
                }

                try {
                    // Count user's trees
                    const treesSnapshot = await db.collection("trees")
                        .where("ownerId", "==", userId)
                        .get();

                    const treeCount = treesSnapshot.size;

                    if (treeCount === 0) {
                        // Don't send reminder to users with no trees
                        continue;
                    }

                    const lastActiveDate = userData.lastActivityAt?.toDate?.() || new Date();
                    const formattedDate = lastActiveDate.toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric"
                    });

                    // Generate and send email
                    const email = inactivityReminderEmail(
                        userData.displayName || userData.email,
                        formattedDate,
                        treeCount
                    );

                    const result = await sendEmail({
                        to: userData.email,
                        subject: email.subject,
                        html: email.html
                    });

                    if (result.success) {
                        emailsSent++;

                        // Mark that we sent a reminder
                        await userDoc.ref.update({
                            lastInactivityReminderSent: admin.firestore.FieldValue.serverTimestamp()
                        });
                    } else {
                        errors++;
                        logger.warn(`Failed to send inactivity reminder to ${userData.email}: ${result.error}`);
                    }

                } catch (userError) {
                    errors++;
                    logger.error(`Error processing inactivity reminder for user ${userId}:`, userError);
                }
            }

            logger.info(`Inactivity reminder complete: ${emailsSent} sent, ${errors} errors`);

        } catch (error) {
            logger.error("Error running inactivity reminder:", error);
            throw error;
        }
    }
);

/**
 * Plan Expiration Reminder
 * 
 * Runs daily at 11:00 AM UTC
 * Sends reminder emails to users whose plans expire in 7 days
 */
export const planExpirationReminder = onSchedule(
    {
        schedule: "0 11 * * *", // Daily at 11 AM UTC
        timeZone: "UTC",
        retryCount: 3,
    },
    async () => {
        logger.info("Starting plan expiration reminder job");

        const db = getDb();
        const now = Date.now();
        const sevenDaysFromNow = now + (7 * 24 * 60 * 60 * 1000);
        const sixDaysFromNow = now + (6 * 24 * 60 * 60 * 1000);

        try {
            // Get users with billing.currentPeriodEnd between 6-7 days from now
            // This ensures we only send the reminder once (on day 7)
            const usersSnapshot = await db.collection("users")
                .where("billing.currentPeriodEnd", ">=", sixDaysFromNow)
                .where("billing.currentPeriodEnd", "<=", sevenDaysFromNow)
                .where("billing.cancelAtPeriodEnd", "==", true)
                .get();

            let emailsSent = 0;
            let errors = 0;

            for (const userDoc of usersSnapshot.docs) {
                const userData = userDoc.data();

                // Skip if no email
                if (!userData.email) continue;

                // Check email preferences
                const prefs = userData.emailPreferences || {};
                if (prefs.reminders === false) continue;

                try {
                    const billing = userData.billing || {};
                    const expirationDate = new Date(billing.currentPeriodEnd);
                    const formattedDate = expirationDate.toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric"
                    });

                    const daysRemaining = Math.ceil((billing.currentPeriodEnd - now) / (24 * 60 * 60 * 1000));

                    // Determine plan name
                    let planName = "Pro";
                    if (billing.plan === "family") {
                        planName = "Family";
                    }

                    // Generate and send email
                    const email = planExpiringEmail(
                        userData.displayName || userData.email,
                        planName,
                        formattedDate,
                        daysRemaining
                    );

                    const result = await sendEmail({
                        to: userData.email,
                        subject: email.subject,
                        html: email.html
                    });

                    if (result.success) {
                        emailsSent++;
                    } else {
                        errors++;
                        logger.warn(`Failed to send expiration reminder to ${userData.email}: ${result.error}`);
                    }

                } catch (userError) {
                    errors++;
                    logger.error(`Error processing expiration reminder for user ${userDoc.id}:`, userError);
                }
            }

            logger.info(`Plan expiration reminder complete: ${emailsSent} sent, ${errors} errors`);

        } catch (error) {
            logger.error("Error running plan expiration reminder:", error);
            throw error;
        }
    }
);
