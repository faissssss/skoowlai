import { Resend } from 'resend';
import {
    welcomeEmailTemplate,
    receiptEmailTemplate,
    reminderEmailTemplate,
    cancellationEmailTemplate
} from './emailTemplates';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'Skoowl AI <noreply@skoowlai.com>';

interface SubscriptionEmailData {
    email: string;
    name?: string;
    plan: 'monthly' | 'yearly';
    subscriptionId: string;
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
                subscriptionId
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
 * Send subscription renewal reminder (7 days and 3 days before)
 */
export async function sendSubscriptionReminderEmail({
    email,
    name,
    plan,
    daysRemaining
}: SubscriptionEmailData & { daysRemaining: number }) {
    try {
        await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: `⏰ Your Skoowl AI subscription renews in ${daysRemaining} days`,
            html: reminderEmailTemplate({
                name: name || 'there',
                plan,
                daysRemaining
            }),
        });
        console.log(`✅ Reminder email sent to ${email}`);
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

