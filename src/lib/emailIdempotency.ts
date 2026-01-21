/**
 * Email Idempotency Utility
 * 
 * Prevents duplicate emails from being sent when webhooks are retried
 * or when users refresh the checkout success page.
 */

import { PrismaClient } from "@prisma/client";

// Use a direct Prisma instance for SentEmail (not affected by soft-delete middleware)
const prisma = new PrismaClient();

export type EmailType =
    | 'welcome'
    | 'receipt'
    | 'renewal'
    | 'cancellation'
    | 'payment_failed'
    | 'trial_ending'
    | 'reminder'
    | 'plan_change'
    | 'on_hold'
    | 'expired';

/**
 * Generates an idempotency key for an email.
 * Format: {emailType}:{subscriptionId or unique identifier}
 */
export function generateEmailIdempotencyKey(
    emailType: EmailType,
    uniqueId: string
): string {
    return `${emailType}:${uniqueId}`;
}

/**
 * Checks if an email has already been sent with this idempotency key.
 * If not, marks it as sent and returns true (proceed with sending).
 * If already sent, returns false (skip sending).
 * 
 * @param idempotencyKey Unique key for this email
 * @param emailType Type of email being sent
 * @param recipientEmail Recipient's email address
 * @returns true if email should be sent, false if already sent
 */
export async function checkAndMarkEmailSent(
    idempotencyKey: string,
    emailType: EmailType,
    recipientEmail: string
): Promise<boolean> {
    try {
        // Try to create the record - will fail if idempotencyKey already exists
        await prisma.sentEmail.create({
            data: {
                idempotencyKey,
                emailType,
                recipientEmail,
            }
        });
        return true; // Email not sent before, proceed
    } catch (error: any) {
        // If unique constraint violation, email was already sent
        if (error.code === 'P2002') {
            console.log(`📧 Skipping duplicate email: ${idempotencyKey}`);
            return false;
        }
        // For other errors, log but allow email to send (fail-open)
        console.error('Error checking email idempotency:', error);
        return true;
    }
}

/**
 * Wrapper function to send an email with idempotency check.
 * 
 * @param idempotencyKey Unique key for this email
 * @param emailType Type of email being sent
 * @param recipientEmail Recipient's email address
 * @param sendEmailFn The actual email sending function
 * @returns true if email was sent, false if skipped
 */
export async function sendEmailWithIdempotency(
    idempotencyKey: string,
    emailType: EmailType,
    recipientEmail: string,
    sendEmailFn: () => Promise<boolean>
): Promise<boolean> {
    const shouldSend = await checkAndMarkEmailSent(idempotencyKey, emailType, recipientEmail);

    if (!shouldSend) {
        return false;
    }

    return await sendEmailFn();
}
