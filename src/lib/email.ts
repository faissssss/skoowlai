import { Resend } from 'resend';
import {
    welcomeEmailTemplate,
    receiptEmailTemplate,
    receiptEmailTemplateItemized,
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
import { dodoClient } from './dodo';

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

type ReceiptItem = {
    name: string;
    quantity: number;
    unit_amount: number; // minor units
    total_amount?: number; // minor units
    tax_amount?: number; // minor units
    discount_amount?: number; // minor units
    description?: string;
};

type ReceiptTotals = {
    subtotal?: number; // minor units
    discount?: number; // minor units
    tax?: number; // minor units
    total?: number; // minor units
};

type ReceiptEmailData = SubscriptionEmailData & {
    paymentId?: string;
    currency?: string;
    discountCodes?: string[];
    items?: ReceiptItem[];
    totals?: ReceiptTotals;
    invoiceId?: string;
    nextBillingDate?: Date;
};

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
 * Send receipt email.
 * - If paymentId or itemization is provided, send a fully itemized receipt with discounts/tax.
 * - Otherwise, fall back to legacy plan-based receipt.
 */
export async function sendReceiptEmail(params: ReceiptEmailData) {
    const { email } = params;
    try {
        // Itemized path when we have a payment to reference (preferred)
        if (params.paymentId || (params.items && params.items.length)) {
            let currency = params.currency;
            let items: ReceiptItem[] = Array.isArray(params.items) ? params.items : [];
            let totals: ReceiptTotals = params.totals || {};
            let invoiceId: string | undefined = params.invoiceId;

            // Enrich with Dodo Payments API when possible
            try {
                const paymentsApi: any = (dodoClient as any)?.payments;

                if (params.paymentId && paymentsApi?.retrieveLineItems) {
                    const res = await paymentsApi.retrieveLineItems(params.paymentId);
                    if (res?.items?.length && !items.length) {
                        items = res.items.map((it: any) => ({
                            name: it.name || it.product_name || 'Item',
                            quantity: Number(it.quantity ?? 1),
                            unit_amount: Number(it.unit_amount ?? it.price_amount ?? 0),
                            total_amount: typeof it.total_amount === 'number' ? it.total_amount : (typeof it.amount === 'number' ? it.amount : undefined),
                            tax_amount: typeof it.tax_amount === 'number' ? it.tax_amount : 0,
                            discount_amount: typeof it.discount_amount === 'number' ? it.discount_amount : 0,
                            description: it.description || undefined,
                        })) as ReceiptItem[];
                    }
                    currency = currency || res?.currency;
                }

                if (params.paymentId && paymentsApi?.retrieve) {
                    const pay = await paymentsApi.retrieve(params.paymentId);
                    invoiceId = invoiceId || pay?.invoice_id;
                    currency = currency || pay?.currency;

                    if (totals.total == null && typeof pay?.total_amount === 'number') totals.total = pay.total_amount;
                    if (totals.tax == null && typeof pay?.tax === 'number') totals.tax = pay.tax;
                    if (totals.discount == null && typeof pay?.discount_amount === 'number') totals.discount = pay.discount_amount;
                }
            } catch (e) {
                console.warn('[Email] Failed to enrich receipt with payment details:', e);
            }

            // Derive subtotal/discount/tax/total if missing
            const computedSubtotal = items.reduce((s, it) => s + Number(it.unit_amount || 0) * Number(it.quantity || 1), 0);
            const computedDiscount = items.reduce((s, it) => s + Number(it.discount_amount || 0), 0);
            const computedTax = items.reduce((s, it) => s + Number(it.tax_amount || 0), 0);

            const subtotal = totals.subtotal ?? computedSubtotal;
            const discount = totals.discount ?? computedDiscount;
            const tax = totals.tax ?? computedTax;
            const total = totals.total ?? Math.max(0, subtotal - discount + tax);

            const html = receiptEmailTemplateItemized({
                name: params.name || 'Valued Customer',
                email: params.email,
                currency: (currency || 'USD') as string,
                items,
                subtotal,
                discount,
                tax,
                total,
                discountCodes: params.discountCodes,
                subscriptionId: params.subscriptionId || 'N/A',
                paymentId: params.paymentId,
                invoiceId,
                nextBilling: params.nextBillingDate,
            });

            await resend.emails.send({
                from: FROM_EMAIL,
                to: email,
                subject: '🧾 Your Skoowl AI Receipt',
                html,
            });
            console.log(`✅ Itemized receipt email sent to ${email}`);
            return true;
        }

        // Fallback legacy (plan-based) receipt
        await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: '🧾 Your Skoowl AI Receipt',
            html: receiptEmailTemplate({
                name: params.name || 'Valued Customer',
                email,
                plan: params.plan,
                subscriptionId: params.subscriptionId || 'N/A'
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
    reason,
    gracePeriodEndsAt
}: {
    email: string;
    name?: string;
    plan: 'monthly' | 'yearly';
    reason?: string;
    gracePeriodEndsAt?: Date;
}) {
    try {
        await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: '⚠️ Action required: payment issue on your Skoowl AI subscription',
            html: onHoldEmailTemplate({
                name: name || 'there',
                plan,
                reason,
                gracePeriodEndsAt
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
