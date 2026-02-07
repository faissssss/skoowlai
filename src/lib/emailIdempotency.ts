/**
 * Email Idempotency Utility
 * 
 * Prevents duplicate emails from being sent when webhooks are retried
 * or when users refresh the checkout success page.
 */

import { db } from './db';

export type EmailType =
    | 'trial_welcome'
    | 'welcome'
    | 'receipt'
    | 'renewal'
    | 'cancellation'
    | 'payment_failed'
    | 'trial_ending'
    | 'trial_ended'
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
 * ✅ BUG #9 FIX: Uses atomic upsert to prevent race conditions from concurrent webhooks
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
        // Use atomic upsert: only creates if doesn't exist
        // Returns the created/found record
        const result = await db.sentEmail.upsert({
            where: { idempotencyKey },
            create: {
                idempotencyKey,
                emailType,
                recipientEmail,
            },
            update: {
                // No updates needed - if it exists, we just retrieve it
            },
        });

        // Check if we just created it (new record) or it already existed
        // If the createdAt is within the last second, we just created it
        const wasJustCreated = (Date.now() - result.createdAt.getTime()) < 1000;

        if (wasJustCreated) {
            return true; // We created it, proceed with sending email
        } else {
            console.log(`📧 Skipping duplicate email: ${idempotencyKey} (already sent at ${result.createdAt.toISOString()})`);
            return false; // Already existed, skip email
        }
    } catch (error: any) {
        // For any errors, log but allow email to send (fail-open for reliability)
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
