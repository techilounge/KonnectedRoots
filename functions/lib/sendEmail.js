"use strict";
/**
 * Centralized Email Sending Utility for KonnectedRoots
 *
 * Uses Resend for transactional email delivery.
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
exports.sendEmail = sendEmail;
exports.sendEmailWithRetry = sendEmailWithRetry;
const resend_1 = require("resend");
const logger = __importStar(require("firebase-functions/logger"));
// Lazy-initialize Resend client
let _resend = null;
function getResend() {
    if (!_resend) {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            logger.error("RESEND_API_KEY is not set");
            return null;
        }
        _resend = new resend_1.Resend(apiKey);
    }
    return _resend;
}
/**
 * Send an email using Resend
 *
 * @param options - Email options (to, subject, html, optional replyTo)
 * @returns Result object with success status and optional emailId or error
 */
async function sendEmail(options) {
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
        logger.info(`Email sent successfully to ${toAddresses.join(", ")}: ${data === null || data === void 0 ? void 0 : data.id}`);
        return {
            success: true,
            emailId: data === null || data === void 0 ? void 0 : data.id
        };
    }
    catch (err) {
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
async function sendEmailWithRetry(options, maxRetries = 2) {
    var _a, _b;
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const result = await sendEmail(options);
        if (result.success) {
            return result;
        }
        lastError = result.error;
        // Don't retry on permanent errors
        if (((_a = result.error) === null || _a === void 0 ? void 0 : _a.includes("invalid")) || ((_b = result.error) === null || _b === void 0 ? void 0 : _b.includes("not found"))) {
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
//# sourceMappingURL=sendEmail.js.map