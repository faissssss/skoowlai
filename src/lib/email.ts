import { Resend } from 'resend';
import {
    welcomeEmailTemplate,
    receiptEmailTemplate,
    reminderEmailTemplate,
    cancellationEmailTemplate,
    renewalEmailTemplate,
    paymentFailedEmailTemplate,
    trialEndingEmailTemplate,
    planChangeEmailTemplate,
    trialWelcomeEmailTemplate,
    onHoldEmailTemplate,
    expirationEmailTemplate
} from './emailTemplates';

// ... (existing code)

/**
 * Send plan change confirmation email
 */
export async function sendPlanChangeEmail({
    email,
    name,
    newPlan,
    nextBillingDate
}: {
    email: string;
    name?: string;
    newPlan: string;
    nextBillingDate: Date;
}) {
    try {
        const formattedDate = nextBillingDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: '🔄 Your subscription plan has been updated',
            html: planChangeEmailTemplate({
                name: name || 'there',
                newPlan,
                nextBillingDate: formattedDate
            }),
        });
        console.log(`✅ Plan change email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to send plan change email:', error);
        return false;
    }
}

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'Skoowl AI <noreply@skoowlai.com>';

interface SubscriptionEmailData {
    email: string;
    name?: string;
    plan: 'monthly' | 'yearly';
    subscriptionId?: string;
}

/**
 * Send welcome email after successful subscription
 */
export async function sendWelcomeEmail({ email, name, plan }: SubscriptionEmailData) {
    try {
        await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: '🎉 Welcome to Skoowl AI Pro!',
            html: welcomeEmailTemplate({ name: name || 'there', plan }),
        });
        console.log(`✅ Welcome email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to send welcome email:', error);
        return false;
    }
}

/**
 * Send receipt email with plan details
 */
export async function sendReceiptEmail({ email, name, plan, subscriptionId }: SubscriptionEmailData) {
    try {
        await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: '🧾 Your Skoowl AI Receipt',
            html: receiptEmailTemplate({
                name: name || 'Valued Customer',
                email,
                plan,
                subscriptionId: subscriptionId || 'N/A'
            }),
        });
        console.log(`✅ Receipt email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to send receipt email:', error);
        return false;
    }
}

/**
 * Send subscription reminder (renewal or trial ending)
 */
export async function sendSubscriptionReminderEmail({
    email,
    name,
    plan,
    daysRemaining,
    isTrial = false
}: SubscriptionEmailData & { daysRemaining: number; isTrial?: boolean }) {
    try {
        const subject = isTrial
            ? `Your Skoowl AI Free Trial ends in ${daysRemaining} days ⏳`
            : `⏰ Your Skoowl AI subscription renews in ${daysRemaining} days`;

        const html = isTrial
            ? trialEndingEmailTemplate({ name: name || 'there', daysRemaining })
            : reminderEmailTemplate({ name: name || 'there', plan, daysRemaining });

        await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: subject,
            html: html,
        });
        console.log(`✅ ${isTrial ? 'Trial ending' : 'Renewal'} reminder email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to send reminder email:', error);
        return false;
    }
}

/**
 * Send cancellation confirmation email
 */
export async function sendCancellationEmail({
    email,
    name,
    plan,
    accessEndsAt
}: {
    email: string;
    name?: string;
    plan: 'monthly' | 'yearly';
    accessEndsAt: Date;
}) {
    try {
        await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: '😢 Your Skoowl AI subscription has been cancelled',
            html: cancellationEmailTemplate({
                name: name || 'there',
                plan,
                accessEndsAt
            }),
        });
        console.log(`✅ Cancellation email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to send cancellation email:', error);
        return false;
    }
}

/**
 * Send both welcome and receipt emails after subscription
 */
export async function sendSubscriptionEmails(data: SubscriptionEmailData) {
    const welcomeResult = await sendWelcomeEmail(data);
    const receiptResult = await sendReceiptEmail(data);
    return welcomeResult && receiptResult;
}

/**
 * Send renewal confirmation email when subscription auto-renews
 */
export async function sendRenewalEmail({
    email,
    name,
    plan,
    nextRenewalDate
}: {
    email: string;
    name?: string;
    plan: 'monthly' | 'yearly';
    nextRenewalDate: Date;
}) {
    try {
        await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: '🎉 Your Skoowl AI subscription has been renewed!',
            html: renewalEmailTemplate({
                name: name || 'there',
                plan,
                nextRenewalDate
            }),
        });
        console.log(`✅ Renewal email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to send renewal email:', error);
        return false;
    }
}

/**
 * Send payment failed email when renewal payment fails
 */
export async function sendPaymentFailedEmail({
    email,
    name,
    plan,
    reason
}: {
    email: string;
    name?: string;
    plan: 'monthly' | 'yearly';
    reason?: string;
}) {
    try {
        await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: '⚠️ Payment failed for your Skoowl AI subscription',
            html: paymentFailedEmailTemplate({
                name: name || 'there',
                plan,
                reason
            }),
        });
        console.log(`✅ Payment failed email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to send payment failed email:', error);
        return false;
    }
}


/**
 * Send trial welcome email
 */
export async function sendTrialWelcomeEmail({
    email,
    name,
    trialDays,
    trialEndsAt
}: {
    email: string;
    name?: string;
    trialDays?: number;
    trialEndsAt?: string;
}) {
    try {
        await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: '🚀 Welcome to your free trial! (Skoowl AI Pro)',
            html: trialWelcomeEmailTemplate({
                name: name || 'there',
                trialDays,
                trialEndsAt
            }),
        });
        console.log(`✅ Trial welcome email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to send trial welcome email:', error);
        return false;
    }
}

/**
 * Send on-hold (payment issue) email
 */
export async function sendOnHoldEmail({
    email,
    name,
    plan,
    reason
}: {
    email: string;
    name?: string;
    plan: 'monthly' | 'yearly';
    reason?: string;
}) {
    try {
        await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: '⚠️ Action required: payment issue on your Skoowl AI subscription',
            html: onHoldEmailTemplate({
                name: name || 'there',
                plan,
                reason
            }),
        });
        console.log(`✅ On-hold email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to send on-hold email:', error);
        return false;
    }
}

/**
 * Send expiration email when subscription ends
 */
export async function sendExpirationEmail({
    email,
    name,
    endedAt
}: {
    email: string;
    name?: string;
    endedAt: Date;
}) {
    try {
        await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: 'Your Skoowl AI subscription has expired',
            html: expirationEmailTemplate({
                name: name || 'there',
                endedAt
            }),
        });
        console.log(`✅ Expiration email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to send expiration email:', error);
        return false;
    }
}
