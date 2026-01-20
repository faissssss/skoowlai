/**
 * Email Template System for Skoowl AI
 * 
 * Professional, branded email templates with clean design.
 * All emails share a consistent header, footer, and styling.
 */

// Brand colors
const COLORS = {
    primary: '#7c3aed',      // Purple
    primaryDark: '#5b21b6',
    secondary: '#4f46e5',    // Indigo
    accent: '#c084fc',       // Light purple
    dark: '#0f172a',         // Slate 900
    text: '#1e293b',         // Slate 800
    textLight: '#64748b',    // Slate 500
    textMuted: '#94a3b8',    // Slate 400
    border: '#e2e8f0',       // Slate 200
    background: '#f8fafc',   // Slate 50
    white: '#ffffff',
    success: '#10b981',
    warning: '#f59e0b',
};

// Shared email header with banner image
function emailHeader() {
    return `
        <tr>
            <td style="padding: 0;">
                <img src="https://skoowlai.com/email-header.png" alt="Skoowl AI" width="600" style="display: block; width: 100%; max-width: 600px; height: auto; border-radius: 16px 16px 0 0;" />
            </td>
        </tr>
    `;
}

// Shared email footer
function emailFooter() {
    const year = new Date().getFullYear();
    return `
        <tr>
            <td style="padding: 32px 40px; background-color: ${COLORS.background}; border-radius: 0 0 16px 16px;">
                <p style="color: ${COLORS.textMuted}; font-size: 14px; margin: 0 0 12px; text-align: center; line-height: 1.5;">
                    Questions? Just reply to this email — we're here to help!
                </p>
                <p style="color: ${COLORS.textMuted}; font-size: 12px; margin: 0; text-align: center;">
                    © ${year} Skoowl AI · 
                    <a href="https://skoowlai.com" style="color: ${COLORS.primary}; text-decoration: none;">skoowlai.com</a> · 
                    <a href="https://skoowlai.com/dashboard" style="color: ${COLORS.primary}; text-decoration: none;">Dashboard</a>
                </p>
            </td>
        </tr>
    `;
}

// Primary CTA button
function ctaButton(text: string, href: string) {
    return `
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
                <td align="center" style="padding: 8px 0;">
                    <a href="${href}" style="display: inline-block; background: linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary}); color: ${COLORS.white}; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 600; font-size: 16px; text-align: center;">
                        ${text}
                    </a>
                </td>
            </tr>
        </table>
    `;
}

// Detail row for receipts
function detailRow(label: string, value: string, isLast: boolean = false) {
    return `
        <tr>
            <td style="padding: 14px 0; border-bottom: ${isLast ? 'none' : `1px solid ${COLORS.border}`};">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td width="40%" style="color: ${COLORS.textLight}; font-size: 14px; vertical-align: top;">
                            ${label}
                        </td>
                        <td width="60%" style="color: ${COLORS.text}; font-size: 14px; font-weight: 500; text-align: right; vertical-align: top;">
                            ${value}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    `;
}

// Base email wrapper
function emailWrapper(content: string) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Skoowl AI</title>
    <style type="text/css">
        /* Reset styles */
        body, table, td, p, a, li { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
        body { margin: 0; padding: 0; width: 100% !important; }
        
        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
            .email-bg { background-color: #1e293b !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${COLORS.background}; -webkit-font-smoothing: antialiased;">
    <table class="email-bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${COLORS.background};">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: ${COLORS.white}; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
                    ${content}
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
}

// ==================== EMAIL TEMPLATES ====================

/**
 * Welcome email after subscription
 */
export function welcomeEmailTemplate({ name, plan }: { name: string; plan: 'monthly' | 'yearly' }) {
    const planName = plan === 'yearly' ? 'Yearly' : 'Monthly';
    const userName = name || 'there';

    const content = `
        ${emailHeader()}
        
        <tr>
            <td style="padding: 40px;">
                <!-- Greeting -->
                <h1 style="color: ${COLORS.text}; font-size: 26px; font-weight: 700; margin: 0 0 8px; text-align: center; line-height: 1.3;">
                    Welcome to Skoowl AI Pro! 🎉
                </h1>
                <p style="color: ${COLORS.textLight}; font-size: 16px; margin: 0 0 32px; text-align: center; line-height: 1.5;">
                    You now have access to all premium features.
                </p>

                <p style="color: ${COLORS.text}; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                    Hey ${userName}! 👋
                </p>
                <p style="color: ${COLORS.text}; font-size: 16px; line-height: 1.6; margin: 0 0 28px;">
                    Thank you for upgrading to <strong style="color: ${COLORS.primary};">Pro (${planName})</strong>! 
                    We're excited to help you study smarter.
                </p>

                <!-- Benefits Box -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #f5f3ff, #eef2ff); border-radius: 12px; margin-bottom: 32px;">
                    <tr>
                        <td style="padding: 24px 28px;">
                            <p style="color: ${COLORS.secondary}; font-size: 15px; font-weight: 600; margin: 0 0 16px;">
                                ✨ Your Pro Benefits
                            </p>
                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr><td style="color: ${COLORS.text}; font-size: 14px; padding: 6px 0;">• <strong>Unlimited</strong> study deck creation</td></tr>
                                <tr><td style="color: ${COLORS.text}; font-size: 14px; padding: 6px 0;">• <strong>Unlimited</strong> flashcard generation</td></tr>
                                <tr><td style="color: ${COLORS.text}; font-size: 14px; padding: 6px 0;">• <strong>Unlimited</strong> quiz generation</td></tr>
                                <tr><td style="color: ${COLORS.text}; font-size: 14px; padding: 6px 0;">• <strong>Unlimited</strong> mind map creation</td></tr>
                                <tr><td style="color: ${COLORS.text}; font-size: 14px; padding: 6px 0;">• <strong>100</strong> AI chat messages per day</td></tr>
                                <tr><td style="color: ${COLORS.text}; font-size: 14px; padding: 6px 0;">• <strong>Custom</strong> flashcard & quiz count (5-50)</td></tr>
                            </table>
                        </td>
                    </tr>
                </table>

                ${ctaButton('Start Learning Now →', 'https://skoowlai.com/dashboard')}

                <p style="color: ${COLORS.textMuted}; font-size: 14px; line-height: 1.6; margin: 24px 0 0; text-align: center;">
                    Happy studying! 📚
                </p>
            </td>
        </tr>

        ${emailFooter()}
    `;

    return emailWrapper(content);
}

/**
 * Receipt email after payment
 */
export function receiptEmailTemplate({
    name,
    email,
    plan,
    subscriptionId
}: {
    name: string;
    email: string;
    plan: 'monthly' | 'yearly';
    subscriptionId: string;
}) {
    const planName = plan === 'yearly' ? 'Pro (Yearly)' : 'Pro (Monthly)';
    const price = plan === 'yearly' ? '$39.99' : '$4.99';
    const interval = plan === 'yearly' ? '/year' : '/month';
    const savings = plan === 'yearly' ? 'You saved $19.89 vs monthly!' : '';
    const userName = name || 'Valued Customer';

    const today = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const nextBillingDate = new Date();
    if (plan === 'yearly') {
        nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    } else {
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    }
    const nextBilling = nextBillingDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const content = `
        ${emailHeader()}
        
        <tr>
            <td style="padding: 40px;">
                <!-- Header -->
                <h1 style="color: ${COLORS.text}; font-size: 26px; font-weight: 700; margin: 0 0 8px; text-align: center; line-height: 1.3;">
                    Payment Receipt
                </h1>
                <p style="color: ${COLORS.textLight}; font-size: 16px; margin: 0 0 36px; text-align: center; line-height: 1.5;">
                    Thank you for your purchase!
                </p>

                <!-- Receipt Card -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid ${COLORS.border}; border-radius: 12px; overflow: hidden; margin-bottom: 32px;">
                    <!-- Customer Info -->
                    <tr>
                        <td style="padding: 20px 24px; background-color: ${COLORS.background};">
                            <p style="color: ${COLORS.textLight}; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px; font-weight: 500;">Billed To</p>
                            <p style="color: ${COLORS.text}; font-size: 16px; font-weight: 600; margin: 0;">${userName}</p>
                            <p style="color: ${COLORS.textLight}; font-size: 14px; margin: 4px 0 0;">${email}</p>
                        </td>
                    </tr>
                    
                    <!-- Order Details -->
                    <tr>
                        <td style="padding: 20px 24px;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                ${detailRow('Plan', `<strong>${planName}</strong>`)}
                                ${detailRow('Date', today)}
                                ${detailRow('Next Billing', nextBilling)}
                                ${detailRow('Subscription ID', `<span style="font-family: monospace; font-size: 12px; color: ${COLORS.textMuted};">${subscriptionId.slice(0, 16)}...</span>`, true)}
                            </table>
                        </td>
                    </tr>

                    <!-- Total -->
                    <tr>
                        <td style="padding: 28px 24px; background: linear-gradient(135deg, #f5f3ff, #eef2ff); text-align: center;">
                            <p style="color: ${COLORS.textLight}; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px; font-weight: 500;">Total Charged</p>
                            <p style="color: ${COLORS.text}; font-size: 36px; font-weight: 700; margin: 0; line-height: 1;">
                                ${price}<span style="font-size: 16px; font-weight: 400; color: ${COLORS.textLight};">${interval}</span>
                            </p>
                            ${savings ? `<p style="color: ${COLORS.success}; font-size: 14px; font-weight: 500; margin: 12px 0 0;">🎉 ${savings}</p>` : ''}
                        </td>
                    </tr>
                </table>

                ${ctaButton('Go to Dashboard →', 'https://skoowlai.com/dashboard')}
            </td>
        </tr>

        ${emailFooter()}
    `;

    return emailWrapper(content);
}

/**
 * Subscription ending reminder email
 */
export function reminderEmailTemplate({
    name,
    plan,
    daysRemaining
}: {
    name: string;
    plan: 'monthly' | 'yearly';
    daysRemaining: number;
}) {
    const planName = plan === 'yearly' ? 'Yearly' : 'Monthly';
    const userName = name || 'there';

    const content = `
        ${emailHeader()}
        
        <tr>
            <td style="padding: 40px;">
                <!-- Header -->
                <h1 style="color: ${COLORS.text}; font-size: 26px; font-weight: 700; margin: 0 0 8px; text-align: center; line-height: 1.3;">
                    Subscription Ending Soon ⏰
                </h1>
                <p style="color: ${COLORS.textLight}; font-size: 16px; margin: 0 0 32px; text-align: center; line-height: 1.5;">
                    Your Pro plan expires in <strong style="color: ${COLORS.warning};">${daysRemaining} days</strong>
                </p>

                <p style="color: ${COLORS.text}; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                    Hey ${userName}! 👋
                </p>
                <p style="color: ${COLORS.text}; font-size: 16px; line-height: 1.6; margin: 0 0 28px;">
                    Just a friendly reminder that your <strong style="color: ${COLORS.primary};">Pro (${planName})</strong> 
                    subscription will renew automatically in ${daysRemaining} days.
                </p>

                <!-- Auto-renewal Notice -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #f5f3ff, #eef2ff); border-radius: 12px; margin-bottom: 24px;">
                    <tr>
                        <td style="padding: 20px 24px;">
                            <p style="color: ${COLORS.text}; font-size: 14px; margin: 0 0 8px; line-height: 1.5;">
                                💳 <strong>Auto-renewal:</strong> Your payment method will be charged automatically on the renewal date.
                            </p>
                            <p style="color: ${COLORS.textLight}; font-size: 14px; margin: 0; line-height: 1.5;">
                                If you wish to cancel, you can do so from your Settings page before the renewal date.
                            </p>
                        </td>
                    </tr>
                </table>

                <!-- Warning Box -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #fef3c7; border-left: 4px solid ${COLORS.warning}; border-radius: 8px; margin-bottom: 32px;">
                    <tr>
                        <td style="padding: 18px 20px;">
                            <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.5;">
                                ⚠️ If you cancel, you'll be moved to the Free plan with limited daily usage after your current period ends.
                            </p>
                        </td>
                    </tr>
                </table>

                ${ctaButton('Manage Subscription →', 'https://skoowlai.com/dashboard/settings')}

                <p style="color: ${COLORS.textMuted}; font-size: 14px; line-height: 1.6; margin: 24px 0 0; text-align: center;">
                    Thank you for being a valued Skoowl AI student! 📚
                </p>
            </td>
        </tr>

        ${emailFooter()}
    `;

    return emailWrapper(content);
}

/**
 * Subscription cancellation confirmation email
 */
export function cancellationEmailTemplate({
    name,
    plan,
    accessEndsAt
}: {
    name: string;
    plan: 'monthly' | 'yearly';
    accessEndsAt: Date;
}) {
    const planName = plan === 'yearly' ? 'Yearly' : 'Monthly';
    const userName = name || 'there';
    const endDateFormatted = accessEndsAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const content = `
        ${emailHeader()}
        
        <tr>
            <td style="padding: 40px;">
                <!-- Header -->
                <h1 style="color: ${COLORS.text}; font-size: 26px; font-weight: 700; margin: 0 0 8px; text-align: center; line-height: 1.3;">
                    Subscription Cancelled
                </h1>
                <p style="color: ${COLORS.textLight}; font-size: 16px; margin: 0 0 32px; text-align: center; line-height: 1.5;">
                    We're sorry to see you go 😢
                </p>

                <p style="color: ${COLORS.text}; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                    Hey ${userName}! 👋
                </p>
                <p style="color: ${COLORS.text}; font-size: 16px; line-height: 1.6; margin: 0 0 28px;">
                    Your <strong style="color: ${COLORS.primary};">Pro (${planName})</strong> subscription has been cancelled.
                </p>

                <!-- Access Notice -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #f5f3ff, #eef2ff); border-radius: 12px; margin-bottom: 24px;">
                    <tr>
                        <td style="padding: 20px 24px;">
                            <p style="color: ${COLORS.text}; font-size: 14px; margin: 0 0 8px; line-height: 1.5;">
                                ✨ <strong>Good news:</strong> You still have Pro access until:
                            </p>
                            <p style="color: ${COLORS.primary}; font-size: 20px; font-weight: 600; margin: 0;">
                                ${endDateFormatted}
                            </p>
                        </td>
                    </tr>
                </table>

                <!-- Info Box -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: ${COLORS.background}; border-radius: 8px; margin-bottom: 32px;">
                    <tr>
                        <td style="padding: 18px 20px;">
                            <p style="color: ${COLORS.textLight}; font-size: 14px; margin: 0; line-height: 1.5;">
                                After this date, you'll be moved to the Free plan. You can resubscribe anytime to regain Pro access.
                            </p>
                        </td>
                    </tr>
                </table>

                ${ctaButton('Resubscribe →', 'https://skoowlai.com/dashboard/settings')}

                <p style="color: ${COLORS.textMuted}; font-size: 14px; line-height: 1.6; margin: 24px 0 0; text-align: center;">
                    Thank you for being part of Skoowl AI! 📚
                </p>
            </td>
        </tr>

        ${emailFooter()}
    `;

    return emailWrapper(content);
}

/**
 * Subscription renewal confirmation email
 */
export function renewalEmailTemplate({
    name,
    plan,
    nextRenewalDate
}: {
    name: string;
    plan: 'monthly' | 'yearly';
    nextRenewalDate: Date;
}) {
    const planName = plan === 'yearly' ? 'Yearly' : 'Monthly';
    const userName = name || 'there';
    const price = plan === 'yearly' ? '$39.99' : '$4.99';
    const nextDateFormatted = nextRenewalDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const content = `
        ${emailHeader()}
        
        <tr>
            <td style="padding: 40px;">
                <!-- Header -->
                <h1 style="color: ${COLORS.text}; font-size: 26px; font-weight: 700; margin: 0 0 8px; text-align: center; line-height: 1.3;">
                    Subscription Renewed! 🎉
                </h1>
                <p style="color: ${COLORS.textLight}; font-size: 16px; margin: 0 0 32px; text-align: center; line-height: 1.5;">
                    Thanks for staying with Skoowl AI
                </p>

                <p style="color: ${COLORS.text}; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                    Hey ${userName}! 👋
                </p>
                <p style="color: ${COLORS.text}; font-size: 16px; line-height: 1.6; margin: 0 0 28px;">
                    Your <strong style="color: ${COLORS.primary};">Pro (${planName})</strong> subscription has been renewed successfully!
                </p>

                <!-- Payment Details -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #f5f3ff, #eef2ff); border-radius: 12px; margin-bottom: 24px;">
                    <tr>
                        <td style="padding: 20px 24px;">
                            ${detailRow('Amount charged', `<strong>${price}</strong>`)}
                            ${detailRow('Next renewal', `<strong>${nextDateFormatted}</strong>`)}
                        </td>
                    </tr>
                </table>

                <!-- Thank You Box -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #ecfdf5; border-left: 4px solid ${COLORS.success}; border-radius: 8px; margin-bottom: 32px;">
                    <tr>
                        <td style="padding: 18px 20px;">
                            <p style="color: #065f46; font-size: 14px; margin: 0; line-height: 1.5;">
                                ✅ Your Pro access continues uninterrupted. Keep crushing your studies!
                            </p>
                        </td>
                    </tr>
                </table>

                ${ctaButton('Go to Dashboard →', 'https://skoowlai.com/dashboard')}

                <p style="color: ${COLORS.textMuted}; font-size: 14px; line-height: 1.6; margin: 24px 0 0; text-align: center;">
                    Thank you for being a valued Skoowl AI student! 📚
                </p>
            </td>
        </tr>

        ${emailFooter()}
    `;

    return emailWrapper(content);
}

/**
 * Payment failed email
 */
export function paymentFailedEmailTemplate({
    name,
    plan,
    reason
}: {
    name: string;
    plan: 'monthly' | 'yearly';
    reason?: string;
}) {
    const planName = plan === 'yearly' ? 'Yearly' : 'Monthly';
    const userName = name || 'there';
    const failureReason = reason || 'Your payment method was declined';

    const content = `
        ${emailHeader()}
        
        <tr>
            <td style="padding: 40px;">
                <!-- Header -->
                <h1 style="color: ${COLORS.text}; font-size: 26px; font-weight: 700; margin: 0 0 8px; text-align: center; line-height: 1.3;">
                    Payment Failed ⚠️
                </h1>
                <p style="color: ${COLORS.textLight}; font-size: 16px; margin: 0 0 32px; text-align: center; line-height: 1.5;">
                    We couldn't process your subscription renewal
                </p>

                <p style="color: ${COLORS.text}; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                    Hey ${userName}! 👋
                </p>
                <p style="color: ${COLORS.text}; font-size: 16px; line-height: 1.6; margin: 0 0 28px;">
                    We tried to renew your <strong style="color: ${COLORS.primary};">Pro (${planName})</strong> subscription, but the payment didn't go through.
                </p>

                <!-- Error Box -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px; margin-bottom: 24px;">
                    <tr>
                        <td style="padding: 18px 20px;">
                            <p style="color: #991b1b; font-size: 14px; margin: 0 0 8px; line-height: 1.5; font-weight: 600;">
                                ❌ ${failureReason}
                            </p>
                            <p style="color: #b91c1c; font-size: 14px; margin: 0; line-height: 1.5;">
                                Common causes: insufficient funds, expired card, or bank restrictions.
                            </p>
                        </td>
                    </tr>
                </table>

                <!-- What happens next -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: ${COLORS.background}; border-radius: 8px; margin-bottom: 32px;">
                    <tr>
                        <td style="padding: 18px 20px;">
                            <p style="color: ${COLORS.text}; font-size: 14px; margin: 0 0 8px; line-height: 1.5; font-weight: 600;">
                                What happens next?
                            </p>
                            <p style="color: ${COLORS.textLight}; font-size: 14px; margin: 0; line-height: 1.5;">
                                We'll retry the payment in a few days. To avoid losing Pro access, please update your payment method or ensure sufficient funds.
                            </p>
                        </td>
                    </tr>
                </table>

                ${ctaButton('Update Payment Method →', 'https://skoowlai.com/dashboard/settings')}

                <p style="color: ${COLORS.textMuted}; font-size: 14px; line-height: 1.6; margin: 24px 0 0; text-align: center;">
                    Need help? Reply to this email and we'll assist you.
                </p>
            </td>
        </tr>

        ${emailFooter()}
    `;

    return emailWrapper(content);
}

/**
 * Trial ending reminder email
 */
export function trialEndingEmailTemplate({
    name,
    daysRemaining
}: {
    name: string;
    daysRemaining: number;
}) {
    const userName = name || 'there';

    const content = `
        ${emailHeader()}
        
        <tr>
            <td style="padding: 40px;">
                <!-- Header -->
                <h1 style="color: ${COLORS.text}; font-size: 26px; font-weight: 700; margin: 0 0 8px; text-align: center; line-height: 1.3;">
                    Your Free Trial is Ending Soon ⏳
                </h1>
                <p style="color: ${COLORS.textLight}; font-size: 16px; margin: 0 0 32px; text-align: center; line-height: 1.5;">
                    Just ${daysRemaining} days left in your trial
                </p>

                <p style="color: ${COLORS.text}; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                    Hey ${userName}! 👋
                </p>
                <p style="color: ${COLORS.text}; font-size: 16px; line-height: 1.6; margin: 0 0 28px;">
                    We hope you've been enjoying the Pro features! Your free trial will end in <strong>${daysRemaining} days</strong>.
                </p>

                <!-- Info Box -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #f5f3ff, #eef2ff); border-radius: 12px; margin-bottom: 24px;">
                    <tr>
                        <td style="padding: 20px 24px;">
                            <p style="color: ${COLORS.text}; font-size: 14px; margin: 0 0 8px; line-height: 1.5;">
                                💳 <strong>What happens next?</strong>
                            </p>
                            <p style="color: ${COLORS.textLight}; font-size: 14px; margin: 0; line-height: 1.5;">
                                If you love Skoowl AI Pro, do nothing! You'll be automatically upgraded to the paid plan so you don't lose access.
                            </p>
                        </td>
                    </tr>
                </table>

                <!-- Cancel Option -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: ${COLORS.background}; border-radius: 8px; margin-bottom: 32px;">
                    <tr>
                        <td style="padding: 18px 20px;">
                            <p style="color: ${COLORS.textLight}; font-size: 14px; margin: 0; line-height: 1.5;">
                                Not for you? You can cancel anytime before the trial ends to avoid being charged.
                            </p>
                        </td>
                    </tr>
                </table>

                ${ctaButton('Manage Subscription →', 'https://skoowlai.com/dashboard/settings')}

                <p style="color: ${COLORS.textMuted}; font-size: 14px; line-height: 1.6; margin: 24px 0 0; text-align: center;">
                    Thank you for trying Skoowl AI! 📚
                </p>
            </td>
        </tr>

        ${emailFooter()}
    `;

    return emailWrapper(content);
}
export const planChangeEmailTemplate = ({
    name,
    newPlan,
    nextBillingDate,
}: {
    name: string;
    newPlan: string;
    nextBillingDate: string;
}) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Your plan has been updated</title>
</head>
<body style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #6d28d9; margin-bottom: 10px;">Plan Updated Successfully!</h1>
        <p style="font-size: 16px; color: #666;">Your subscription preference has been saved.</p>
    </div>

    <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 20px; border: 1px solid #e5e7eb;">
        <p style="margin: 0 0 10px;">Hi ${name},</p>
        <p style="margin: 0 0 20px;">You have successfully switched to the <strong>${newPlan}</strong> plan.</p>
        
        <div style="background-color: white; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb;">
            <p style="margin: 5px 0; font-size: 14px; color: #666;">New Plan:</p>
            <p style="margin: 0 0 15px; font-weight: bold; font-size: 18px; color: #111827;">${newPlan}</p>
            
            <p style="margin: 5px 0; font-size: 14px; color: #666;">Next Billing Date:</p>
            <p style="margin: 0; font-weight: bold; font-size: 18px; color: #111827;">${nextBillingDate}</p>
        </div>
    </div>

    <p style="text-align: center; font-size: 14px; color: #666; margin-top: 30px;">
        Need help? Reply to this email or contact support.
    </p>
</body>
</html>
`;

export const trialWelcomeEmailTemplate = ({
    name,
    trialDays = 7,
    trialEndsAt
}: {
    name: string;
    trialDays?: number;
    trialEndsAt?: string;
}) => {
    return emailWrapper(`
        ${emailHeader()}
        <tr>
            <td style="padding: 40px 40px 32px; background-color: ${COLORS.white};">
                <h1 style="color: ${COLORS.text}; font-size: 24px; font-weight: 700; margin: 0 0 16px; text-align: center;">
                    Welcome to your free trial! 🚀
                </h1>
                <p style="color: ${COLORS.textLight}; font-size: 16px; line-height: 1.6; margin: 0 0 24px; text-align: center;">
                    Hi ${name},
                </p>
                <p style="color: ${COLORS.textLight}; font-size: 16px; line-height: 1.6; margin: 0 0 24px; text-align: center;">
                    Thanks for starting your <strong>${trialDays}-day free trial</strong> of Skoowl AI Pro. You now have full access to all features!
                </p>
                
                <div style="background-color: ${COLORS.background}; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                    <p style="color: ${COLORS.text}; font-weight: 600; font-size: 16px; margin: 0 0 12px; text-align: center;">
                        Your trial details:
                    </p>
                    <p style="font-size: 14px; color: ${COLORS.textLight}; margin: 0; text-align: center;">
                        <strong>Status:</strong> Active Trial<br>
                        <strong>Duration:</strong> ${trialDays} Days<br>
                        ${trialEndsAt ? `<strong>Ends on:</strong> ${trialEndsAt}` : ''}
                    </p>
                </div>

                <p style="color: ${COLORS.textLight}; font-size: 14px; line-height: 1.6; margin: 0 0 24px; text-align: center;">
                    Enjoy unlimited study decks, flashcards, quizzes, and more. We won't charge you until your trial ends.
                </p>

                ${ctaButton('Go to Dashboard', 'https://skoowlai.com/dashboard')}
            </td>
        </tr>
        ${emailFooter()}
    `);
};
