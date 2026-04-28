/**
 * Centralized Email Sending Utility for KonnectedRoots
 * 
 * Uses Resend for transactional email delivery.
 */

import { Resend } from "resend";
import * as logger from "firebase-functions/logger";

export interface SendEmailOptions {
    to: string | string[];
    subject: string;
    html: string;
    replyTo?: string;
}

export interface SendEmailResult {
    success: boolean;
    emailId?: string;
    error?: string;
}

// Lazy-initialize Resend client
let _resend: Resend | null = null;

function getResend(): Resend | null {
    if (!_resend) {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            logger.error("RESEND_API_KEY is not set");
            return null;
        }
        _resend = new Resend(apiKey);
    }
    return _resend;
}

/**
 * Send an email using Resend
 * 
 * @param options - Email options (to, subject, html, optional replyTo)
 * @returns Result object with success status and optional emailId or error
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const resend = getResend();

    if (!resend) {
        return {
            success: false,
            error: "Email service not configured (RESEND_API_KEY missing)"
        };
    }

    try {
        const toAddresses = Array.isArray(options.to) ? options.to : [options.to];

        const { data, error } = await resend.emails.send({
            from: "KonnectedRoots <noreply@updates.konnectedroots.app>",
            to: toAddresses,
            subject: options.subject,
            html: options.html,
            replyTo: options.replyTo
        });

        if (error) {
            logger.error("Resend API error:", error);
            return {
                success: false,
                error: error.message || "Unknown Resend error"
            };
        }

        logger.info(`Email sent successfully to ${toAddresses.join(", ")}: ${data?.id}`);

        return {
            success: true,
            emailId: data?.id
        };
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        logger.error("Error sending email:", err);

        return {
            success: false,
            error: errorMessage
        };
    }
}

/**
 * Send an email with retry logic for transient failures
 * 
 * @param options - Email options
 * @param maxRetries - Maximum number of retry attempts (default: 2)
 * @returns Result object
 */
export async function sendEmailWithRetry(
    options: SendEmailOptions,
    maxRetries: number = 2
): Promise<SendEmailResult> {
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const result = await sendEmail(options);

        if (result.success) {
            return result;
        }

        lastError = result.error;

        // Don't retry on permanent errors
        if (result.error?.includes("invalid") || result.error?.includes("not found")) {
            break;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }

    return {
        success: false,
        error: lastError || "Max retries exceeded"
    };
}
