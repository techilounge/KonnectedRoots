import { functionsEnv } from './config';
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
    retryable?: boolean;
}

// Lazy-initialize Resend client
let _resend: Resend | null = null;

function getResend(): Resend | null {
    if (!_resend) {
        const apiKey = functionsEnv.resendApiKey;
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
            logger.error("Resend delivery failed", { operation: 'send_email', code: 'provider_rejected' });
            return {
                success: false,
                error: "Email delivery failed.",
                retryable: !(error.message?.includes('invalid') || error.message?.includes('not found'))
            };
        }

        logger.info("Email sent successfully", { emailId: data?.id, recipientCount: toAddresses.length });

        return {
            success: true,
            emailId: data?.id
        };
    } catch (err) {
        logger.error("Email delivery failed", { operation: 'send_email', code: 'transport_failure' });

        return {
            success: false,
            error: "Email delivery failed.",
            retryable: !(err instanceof Error && (err.message.includes('invalid') || err.message.includes('not found')))
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
        if (result.retryable === false) {
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
