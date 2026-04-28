"use strict";
/**
 * Email Templates for KonnectedRoots
 *
 * Branded, responsive email templates using inline CSS for maximum compatibility.
 * All emails use consistent header, footer, and styling.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.welcomeEmail = welcomeEmail;
exports.invitationAcceptedEmail = invitationAcceptedEmail;
exports.paymentSuccessEmail = paymentSuccessEmail;
exports.paymentFailedEmail = paymentFailedEmail;
exports.planExpiringEmail = planExpiringEmail;
exports.treeInviteEmail = treeInviteEmail;
exports.activityDigestEmail = activityDigestEmail;
exports.exportCompleteEmail = exportCompleteEmail;
exports.inactivityReminderEmail = inactivityReminderEmail;
exports.passwordResetEmail = passwordResetEmail;
// Brand colors
const LIGHT_GREEN = "#8CC63F";
const DARK_GREEN = "#1A643F";
const ACCENT_GREEN = "#2F855A";
// Base URL for links
const BASE_URL = "https://konnectedroots.app";
/**
 * Base template wrapper with branded header and footer
 */
function baseTemplate(content) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KonnectedRoots</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
        <tr>
            <td align="center" style="padding: 24px 16px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, ${DARK_GREEN} 0%, ${ACCENT_GREEN} 100%); padding: 32px 24px; text-align: center;">
                            <span style="color: ${LIGHT_GREEN}; font-size: 32px; font-weight: bold; font-family: Georgia, 'Times New Roman', serif;">K</span>
                            <span style="color: #ffffff; font-size: 32px; font-weight: bold; font-family: Georgia, 'Times New Roman', serif;">onnected</span>
                            <span style="color: ${LIGHT_GREEN}; font-size: 32px; font-weight: bold; font-family: Georgia, 'Times New Roman', serif;">R</span>
                            <span style="color: #ffffff; font-size: 32px; font-weight: bold; font-family: Georgia, 'Times New Roman', serif;">oots</span>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 32px;">
                            ${content}
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 24px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 14px;">
                                Discover your heritage and build your family story.
                            </p>
                            <p style="margin: 0 0 12px 0;">
                                <a href="${BASE_URL}/settings" style="color: ${ACCENT_GREEN}; text-decoration: none; font-size: 12px;">Manage email preferences</a>
                                <span style="color: #d1d5db; margin: 0 8px;">|</span>
                                <a href="${BASE_URL}/privacy" style="color: ${ACCENT_GREEN}; text-decoration: none; font-size: 12px;">Privacy Policy</a>
                                <span style="color: #d1d5db; margin: 0 8px;">|</span>
                                <a href="${BASE_URL}/contact" style="color: ${ACCENT_GREEN}; text-decoration: none; font-size: 12px;">Contact Support</a>
                            </p>
                            <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                                © ${new Date().getFullYear()} KonnectedRoots. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}
/**
 * Primary CTA button styling
 */
function ctaButton(text, url) {
    return `
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 32px 0;">
            <tr>
                <td style="background-color: ${ACCENT_GREEN}; border-radius: 8px;">
                    <a href="${url}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">
                        ${text}
                    </a>
                </td>
            </tr>
        </table>
    `;
}
/**
 * Secondary link styling
 */
function secondaryLink(text, url) {
    return `<a href="${url}" style="color: ${ACCENT_GREEN}; text-decoration: none;">${text}</a>`;
}
// ============================================================================
// EMAIL TEMPLATES
// ============================================================================
/**
 * 1. Welcome Email - Sent when a new user signs up
 */
function welcomeEmail(name) {
    const firstName = name.split(' ')[0] || 'there';
    const content = `
        <h1 style="margin: 0 0 16px 0; color: ${DARK_GREEN}; font-size: 28px; font-weight: 600;">
            Welcome to KonnectedRoots! 🌳
        </h1>
        <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            Hi ${firstName},
        </p>
        <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            We're thrilled to have you join our community of family history enthusiasts! KonnectedRoots makes it easy to build, visualize, and share your family tree with loved ones.
        </p>
        <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            Here's how to get started:
        </p>
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
            <tr>
                <td style="padding: 8px 0; color: #374151; font-size: 16px;">
                    <strong style="color: ${ACCENT_GREEN};">1.</strong> Create your first family tree
                </td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #374151; font-size: 16px;">
                    <strong style="color: ${ACCENT_GREEN};">2.</strong> Add yourself and start connecting relatives
                </td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #374151; font-size: 16px;">
                    <strong style="color: ${ACCENT_GREEN};">3.</strong> Invite family members to collaborate
                </td>
            </tr>
        </table>
        ${ctaButton("Create Your First Tree", `${BASE_URL}/dashboard`)}
        <p style="margin: 0; color: #6b7280; font-size: 14px;">
            Need help? Check out our ${secondaryLink("Getting Started Guide", `${BASE_URL}/guide`)} or ${secondaryLink("contact our support team", `${BASE_URL}/contact`)}.
        </p>
    `;
    return {
        subject: `Welcome to KonnectedRoots, ${firstName}! 🌳`,
        html: baseTemplate(content)
    };
}
/**
 * 2. Invitation Accepted - Sent to tree owner when someone accepts their invitation
 */
function invitationAcceptedEmail(ownerName, collaboratorName, treeName, treeId, role) {
    const firstName = ownerName.split(' ')[0] || 'there';
    const content = `
        <h1 style="margin: 0 0 16px 0; color: ${DARK_GREEN}; font-size: 28px; font-weight: 600;">
            Great news! 🎉
        </h1>
        <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            Hi ${firstName},
        </p>
        <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            <strong>${collaboratorName}</strong> has accepted your invitation to collaborate on <strong>"${treeName}"</strong> as a <strong>${role}</strong>.
        </p>
        <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            They can now access your family tree and help you build your shared family history together.
        </p>
        ${ctaButton("View Your Tree", `${BASE_URL}/tree/${treeId}`)}
        <p style="margin: 0; color: #6b7280; font-size: 14px;">
            You can manage collaborator permissions anytime from the Share menu in your tree.
        </p>
    `;
    return {
        subject: `${collaboratorName} joined your family tree!`,
        html: baseTemplate(content)
    };
}
/**
 * 3. Payment Successful - Sent when a payment is processed
 */
function paymentSuccessEmail(name, planName, amount, nextBillingDate, invoiceUrl) {
    const firstName = name.split(' ')[0] || 'there';
    const content = `
        <h1 style="margin: 0 0 16px 0; color: ${DARK_GREEN}; font-size: 28px; font-weight: 600;">
            Payment Received ✓
        </h1>
        <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            Hi ${firstName},
        </p>
        <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            Thank you for your payment! Here's your receipt:
        </p>
        
        <table role="presentation" cellspacing="0" cellpadding="0" style="width: 100%; background-color: #f9fafb; border-radius: 8px; margin-bottom: 24px;">
            <tr>
                <td style="padding: 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" style="width: 100%;">
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Plan</td>
                            <td style="padding: 8px 0; color: #374151; font-size: 14px; text-align: right; font-weight: 600;">${planName}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Amount</td>
                            <td style="padding: 8px 0; color: #374151; font-size: 14px; text-align: right; font-weight: 600;">${amount}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Next billing date</td>
                            <td style="padding: 8px 0; color: #374151; font-size: 14px; text-align: right; font-weight: 600;">${nextBillingDate}</td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
        
        ${invoiceUrl ? ctaButton("View Invoice", invoiceUrl) : ''}
        
        <p style="margin: 0; color: #6b7280; font-size: 14px;">
            You can manage your subscription anytime from ${secondaryLink("Account Settings", `${BASE_URL}/settings`)}.
        </p>
    `;
    return {
        subject: `Payment received - KonnectedRoots ${planName}`,
        html: baseTemplate(content)
    };
}
/**
 * 4. Payment Failed - Sent when a payment fails
 */
function paymentFailedEmail(name, amount, retryDate, updatePaymentUrl) {
    const firstName = name.split(' ')[0] || 'there';
    const content = `
        <h1 style="margin: 0 0 16px 0; color: #DC2626; font-size: 28px; font-weight: 600;">
            ⚠️ Payment Failed
        </h1>
        <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            Hi ${firstName},
        </p>
        <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            We were unable to process your payment of <strong>${amount}</strong> for your KonnectedRoots subscription.
        </p>
        <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            Please update your payment method to avoid any interruption to your service. We'll automatically retry on <strong>${retryDate}</strong>.
        </p>
        
        <table role="presentation" cellspacing="0" cellpadding="0" style="width: 100%; background-color: #FEF2F2; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #DC2626;">
            <tr>
                <td style="padding: 16px 20px;">
                    <p style="margin: 0; color: #991B1B; font-size: 14px;">
                        <strong>What happens if payment fails?</strong><br>
                        Your subscription will be paused and you'll lose access to premium features until payment is resolved.
                    </p>
                </td>
            </tr>
        </table>
        
        ${ctaButton("Update Payment Method", updatePaymentUrl)}
        
        <p style="margin: 0; color: #6b7280; font-size: 14px;">
            If you're having trouble, please ${secondaryLink("contact our support team", `${BASE_URL}/contact`)} for assistance.
        </p>
    `;
    return {
        subject: `⚠️ Action required: Payment failed`,
        html: baseTemplate(content)
    };
}
/**
 * 5. Plan Expiring Soon - Sent 7 days before subscription ends
 */
function planExpiringEmail(name, planName, expirationDate, daysRemaining) {
    const firstName = name.split(' ')[0] || 'there';
    const content = `
        <h1 style="margin: 0 0 16px 0; color: ${DARK_GREEN}; font-size: 28px; font-weight: 600;">
            Your plan expires soon
        </h1>
        <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            Hi ${firstName},
        </p>
        <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            Your <strong>${planName}</strong> subscription will expire on <strong>${expirationDate}</strong> (in ${daysRemaining} days).
        </p>
        <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            After expiration, you'll lose access to:
        </p>
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
            <tr>
                <td style="padding: 6px 0; color: #374151; font-size: 16px;">• Unlimited family trees</td>
            </tr>
            <tr>
                <td style="padding: 6px 0; color: #374151; font-size: 16px;">• PDF and PNG exports</td>
            </tr>
            <tr>
                <td style="padding: 6px 0; color: #374151; font-size: 16px;">• AI-powered features</td>
            </tr>
            <tr>
                <td style="padding: 6px 0; color: #374151; font-size: 16px;">• Priority support</td>
            </tr>
        </table>
        ${ctaButton("Renew Your Plan", `${BASE_URL}/pricing`)}
        <p style="margin: 0; color: #6b7280; font-size: 14px;">
            Your data will remain safe. You can reactivate anytime to regain access.
        </p>
    `;
    return {
        subject: `Your KonnectedRoots ${planName} plan expires in ${daysRemaining} days`,
        html: baseTemplate(content)
    };
}
/**
 * 6. Tree Invitation - Sent when someone is invited to collaborate
 */
function treeInviteEmail(inviterName, inviteeEmail, treeName, role, inviteUrl) {
    const content = `
        <h1 style="margin: 0 0 16px 0; color: ${DARK_GREEN}; font-size: 28px; font-weight: 600;">
            You've been invited! 🌳
        </h1>
        <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            Hi there,
        </p>
        <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            <strong>${inviterName}</strong> has invited you to collaborate on their family tree <strong>"${treeName}"</strong> as a <strong>${role}</strong>.
        </p>
        <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            Join them in building and preserving your shared family history!
        </p>
        
        <table role="presentation" cellspacing="0" cellpadding="0" style="width: 100%; background-color: #f0fdf4; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid ${ACCENT_GREEN};">
            <tr>
                <td style="padding: 16px 20px;">
                    <p style="margin: 0; color: ${DARK_GREEN}; font-size: 14px;">
                        <strong>What can a ${role} do?</strong><br>
                        ${role === 'viewer' ? 'View the family tree and all its members.' :
        role === 'editor' ? 'View and edit the family tree, add new members.' :
            'Full access including managing collaborators and tree settings.'}
                    </p>
                </td>
            </tr>
        </table>
        
        ${ctaButton("Accept Invitation", inviteUrl)}
        
        <p style="margin: 16px 0 0 0; color: #6b7280; font-size: 14px;">
            Or copy this link: <a href="${inviteUrl}" style="color: ${ACCENT_GREEN}; word-break: break-all;">${inviteUrl}</a>
        </p>
        <p style="margin: 16px 0 0 0; color: #6b7280; font-size: 14px;">
            Don't know ${inviterName}? You can safely ignore this email.
        </p>
    `;
    return {
        subject: `${inviterName} invited you to collaborate on ${treeName}`,
        html: baseTemplate(content)
    };
}
/**
 * 7. Weekly Activity Digest - Sent every Monday
 */
function activityDigestEmail(name, stats) {
    const firstName = name.split(' ')[0] || 'there';
    const hasActivity = stats.treesModified > 0 || stats.membersAdded > 0 || stats.collaboratorsJoined > 0;
    const content = `
        <h1 style="margin: 0 0 16px 0; color: ${DARK_GREEN}; font-size: 28px; font-weight: 600;">
            Your Weekly Update 📊
        </h1>
        <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            Hi ${firstName}, here's what happened on KonnectedRoots this week:
        </p>
        
        ${hasActivity ? `
        <table role="presentation" cellspacing="0" cellpadding="0" style="width: 100%; margin-bottom: 24px;">
            <tr>
                <td style="padding: 16px; background-color: #f0fdf4; border-radius: 8px; text-align: center; width: 33%;">
                    <p style="margin: 0; font-size: 32px; font-weight: bold; color: ${ACCENT_GREEN};">${stats.treesModified}</p>
                    <p style="margin: 4px 0 0 0; font-size: 14px; color: #6b7280;">Trees updated</p>
                </td>
                <td style="width: 8px;"></td>
                <td style="padding: 16px; background-color: #f0fdf4; border-radius: 8px; text-align: center; width: 33%;">
                    <p style="margin: 0; font-size: 32px; font-weight: bold; color: ${ACCENT_GREEN};">${stats.membersAdded}</p>
                    <p style="margin: 4px 0 0 0; font-size: 14px; color: #6b7280;">Members added</p>
                </td>
                <td style="width: 8px;"></td>
                <td style="padding: 16px; background-color: #f0fdf4; border-radius: 8px; text-align: center; width: 33%;">
                    <p style="margin: 0; font-size: 32px; font-weight: bold; color: ${ACCENT_GREEN};">${stats.collaboratorsJoined}</p>
                    <p style="margin: 4px 0 0 0; font-size: 14px; color: #6b7280;">New collaborators</p>
                </td>
            </tr>
        </table>
        ${stats.topTreeName ? `<p style="margin: 0 0 24px 0; color: #374151; font-size: 16px;">Most active tree: <strong>${stats.topTreeName}</strong></p>` : ''}
        ` : `
        <table role="presentation" cellspacing="0" cellpadding="0" style="width: 100%; background-color: #f9fafb; border-radius: 8px; margin-bottom: 24px;">
            <tr>
                <td style="padding: 24px; text-align: center;">
                    <p style="margin: 0; color: #6b7280; font-size: 16px;">
                        No activity this week. Ready to add to your family tree?
                    </p>
                </td>
            </tr>
        </table>
        `}
        
        ${ctaButton("View Dashboard", `${BASE_URL}/dashboard`)}
        
        <p style="margin: 0; color: #6b7280; font-size: 14px;">
            ${secondaryLink("Unsubscribe from weekly digest", `${BASE_URL}/settings`)}
        </p>
    `;
    return {
        subject: `Your weekly KonnectedRoots update`,
        html: baseTemplate(content)
    };
}
/**
 * 8. Export Complete - Sent when a large export is ready
 */
function exportCompleteEmail(name, treeName, format, downloadUrl, expiresIn) {
    const firstName = name.split(' ')[0] || 'there';
    const content = `
        <h1 style="margin: 0 0 16px 0; color: ${DARK_GREEN}; font-size: 28px; font-weight: 600;">
            Your export is ready! 📦
        </h1>
        <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            Hi ${firstName},
        </p>
        <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            Your <strong>${format.toUpperCase()}</strong> export of <strong>"${treeName}"</strong> is ready for download.
        </p>
        
        ${ctaButton("Download Export", downloadUrl)}
        
        <table role="presentation" cellspacing="0" cellpadding="0" style="width: 100%; background-color: #FEF3C7; border-radius: 8px; margin: 24px 0; border-left: 4px solid #F59E0B;">
            <tr>
                <td style="padding: 16px 20px;">
                    <p style="margin: 0; color: #92400E; font-size: 14px;">
                        <strong>Note:</strong> This download link expires in ${expiresIn}. Make sure to download your file before then.
                    </p>
                </td>
            </tr>
        </table>
        
        <p style="margin: 0; color: #6b7280; font-size: 14px;">
            You can always generate a new export from your ${secondaryLink("tree settings", `${BASE_URL}/dashboard`)}.
        </p>
    `;
    return {
        subject: `Your ${format.toUpperCase()} export is ready!`,
        html: baseTemplate(content)
    };
}
/**
 * 9. Inactivity Reminder - Sent after 30+ days of inactivity
 */
function inactivityReminderEmail(name, lastActiveDate, treeCount) {
    const firstName = name.split(' ')[0] || 'there';
    const content = `
        <h1 style="margin: 0 0 16px 0; color: ${DARK_GREEN}; font-size: 28px; font-weight: 600;">
            We miss you! 🌳
        </h1>
        <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            Hi ${firstName},
        </p>
        <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            It's been a while since you visited KonnectedRoots. Your ${treeCount === 1 ? 'family tree is' : `${treeCount} family trees are`} waiting for you!
        </p>
        <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            Family history is best preserved when it's documented. Even adding just one new family member or memory can make a difference.
        </p>
        
        <table role="presentation" cellspacing="0" cellpadding="0" style="width: 100%; background-color: #f0fdf4; border-radius: 8px; margin-bottom: 24px;">
            <tr>
                <td style="padding: 20px;">
                    <p style="margin: 0 0 8px 0; font-weight: 600; color: ${DARK_GREEN};">Quick ideas to get started:</p>
                    <p style="margin: 4px 0; color: #374151; font-size: 14px;">• Add birthdates you've recently learned</p>
                    <p style="margin: 4px 0; color: #374151; font-size: 14px;">• Upload new family photos</p>
                    <p style="margin: 4px 0; color: #374151; font-size: 14px;">• Invite a relative to collaborate</p>
                </td>
            </tr>
        </table>
        
        ${ctaButton("Continue Building", `${BASE_URL}/dashboard`)}
        
        <p style="margin: 0; color: #6b7280; font-size: 14px;">
            Don't want these reminders? ${secondaryLink("Update your preferences", `${BASE_URL}/settings`)}
        </p>
    `;
    return {
        subject: `We miss you at KonnectedRoots! 🌳`,
        html: baseTemplate(content)
    };
}
/**
 * 10. Password Reset - Custom branded password reset email
 */
function passwordResetEmail(email, resetUrl) {
    const content = `
        <h1 style="margin: 0 0 16px 0; color: ${DARK_GREEN}; font-size: 28px; font-weight: 600;">
            Reset Your Password
        </h1>
        <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            Hi there,
        </p>
        <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            We received a request to reset the password for the KonnectedRoots account associated with <strong>${email}</strong>.
        </p>
        <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
            Click the button below to choose a new password:
        </p>
        
        ${ctaButton("Reset Password", resetUrl)}
        
        <table role="presentation" cellspacing="0" cellpadding="0" style="width: 100%; background-color: #FEF3C7; border-radius: 8px; margin: 24px 0; border-left: 4px solid #F59E0B;">
            <tr>
                <td style="padding: 16px 20px;">
                    <p style="margin: 0; color: #92400E; font-size: 14px;">
                        <strong>Security note:</strong> This link expires in 1 hour. If you didn't request this reset, you can safely ignore this email.
                    </p>
                </td>
            </tr>
        </table>
        
        <p style="margin: 0; color: #6b7280; font-size: 14px;">
            If you're having trouble clicking the button, copy and paste this URL into your browser:<br>
            <a href="${resetUrl}" style="color: ${ACCENT_GREEN}; word-break: break-all; font-size: 12px;">${resetUrl}</a>
        </p>
    `;
    return {
        subject: `Reset your KonnectedRoots password`,
        html: baseTemplate(content)
    };
}
//# sourceMappingURL=emailTemplates.js.map