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
                    subscription will end soon.
                </p>

                <!-- Warning Box -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #fef3c7; border-left: 4px solid ${COLORS.warning}; border-radius: 8px; margin-bottom: 32px;">
                    <tr>
                        <td style="padding: 18px 20px;">
                            <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.5;">
                                ⚠️ After your subscription ends, you'll be moved to the Free plan with limited daily usage.
                            </p>
                        </td>
                    </tr>
                </table>

                ${ctaButton('Renew Subscription →', 'https://skoowlai.com/dashboard/settings#billing')}

                <p style="color: ${COLORS.textMuted}; font-size: 14px; line-height: 1.6; margin: 24px 0 0; text-align: center;">
                    Thank you for being a valued Skoowl AI student! 📚
                </p>
            </td>
        </tr>

        ${emailFooter()}
    `;

    return emailWrapper(content);
}
