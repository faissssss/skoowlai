import { Resend } from 'resend';

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
    const planName = plan === 'yearly' ? 'Yearly' : 'Monthly';
    const userName = name || 'there';

    try {
        await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: '🎉 Welcome to Skoowl AI Pro!',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 32px;">
            <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #7c3aed, #4f46e5); border-radius: 20px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                <span style="font-size: 40px;">🦉</span>
            </div>
            <h1 style="color: #1e293b; font-size: 28px; margin: 0;">Welcome to Skoowl AI!</h1>
        </div>

        <!-- Main Card -->
        <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Hey ${userName}! 👋
            </p>
            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Thank you for upgrading to <strong style="color: #7c3aed;">Pro (${planName})</strong>! 
                You now have access to all premium features.
            </p>

            <!-- Benefits Box -->
            <div style="background: linear-gradient(135deg, #f5f3ff, #eef2ff); border-radius: 12px; padding: 24px; margin: 24px 0;">
                <h3 style="color: #4f46e5; font-size: 16px; margin: 0 0 16px;">✨ Your Pro Benefits:</h3>
                <ul style="color: #475569; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                    <li><strong>Unlimited</strong> study deck creation</li>
                    <li><strong>Unlimited</strong> flashcard generation</li>
                    <li><strong>Unlimited</strong> quiz generation</li>
                    <li><strong>Unlimited</strong> mind map creation</li>
                    <li><strong>100</strong> AI chat messages per day</li>
                    <li><strong>Custom</strong> flashcard & quiz count (5-50)</li>
                </ul>
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 32px 0;">
                <a href="https://skoowlai.com/dashboard" 
                   style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #4f46e5); color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 16px;">
                    Start Learning Now →
                </a>
            </div>

            <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0;">
                If you have any questions, just reply to this email. We're here to help!
            </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 32px; color: #94a3b8; font-size: 12px;">
            <p style="margin: 0 0 8px;">© ${new Date().getFullYear()} Skoowl AI. All rights reserved.</p>
            <p style="margin: 0;">
                <a href="https://skoowlai.com" style="color: #7c3aed; text-decoration: none;">skoowlai.com</a>
            </p>
        </div>
    </div>
</body>
</html>
            `,
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
    const planName = plan === 'yearly' ? 'Pro (Yearly)' : 'Pro (Monthly)';
    const price = plan === 'yearly' ? '$39.99/year' : '$4.99/month';
    const savings = plan === 'yearly' ? '(Save $19.89 vs monthly!)' : '';
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

    try {
        await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: '🧾 Your Skoowl AI Receipt',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 32px;">
            <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #7c3aed, #4f46e5); border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
                <span style="font-size: 28px;">🦉</span>
            </div>
            <h1 style="color: #1e293b; font-size: 24px; margin: 0;">Payment Receipt</h1>
            <p style="color: #64748b; font-size: 14px; margin: 8px 0 0;">Thank you for your purchase!</p>
        </div>

        <!-- Receipt Card -->
        <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
            <!-- Customer Info -->
            <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px;">
                <p style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px;">Billed To</p>
                <p style="color: #1e293b; font-size: 16px; font-weight: 600; margin: 0;">${userName}</p>
                <p style="color: #475569; font-size: 14px; margin: 4px 0 0;">${email}</p>
            </div>

            <!-- Order Details -->
            <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: #64748b; font-size: 14px;">Plan</span>
                    <span style="color: #1e293b; font-size: 14px; font-weight: 600;">${planName}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: #64748b; font-size: 14px;">Date</span>
                    <span style="color: #1e293b; font-size: 14px;">${today}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: #64748b; font-size: 14px;">Next Billing</span>
                    <span style="color: #1e293b; font-size: 14px;">${nextBilling}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #64748b; font-size: 14px;">Subscription ID</span>
                    <span style="color: #64748b; font-size: 12px; font-family: monospace;">${subscriptionId.slice(0, 16)}...</span>
                </div>
            </div>

            <!-- Total -->
            <div style="background: #f8fafc; border-radius: 10px; padding: 16px; text-align: center;">
                <p style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px;">Total Charged</p>
                <p style="color: #1e293b; font-size: 28px; font-weight: 700; margin: 0;">${price}</p>
                ${savings ? `<p style="color: #10b981; font-size: 14px; margin: 4px 0 0;">${savings}</p>` : ''}
            </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 32px; color: #94a3b8; font-size: 12px;">
            <p style="margin: 0 0 8px;">Questions? Reply to this email or visit our help center.</p>
            <p style="margin: 0;">© ${new Date().getFullYear()} Skoowl AI</p>
        </div>
    </div>
</body>
</html>
            `,
        });
        console.log(`✅ Receipt email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to send receipt email:', error);
        return false;
    }
}

/**
 * Send subscription ending reminder
 */
export async function sendSubscriptionReminderEmail({
    email,
    name,
    plan,
    daysRemaining
}: SubscriptionEmailData & { daysRemaining: number }) {
    const planName = plan === 'yearly' ? 'Yearly' : 'Monthly';
    const userName = name || 'there';

    try {
        await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: `⏰ Your Skoowl AI subscription ends in ${daysRemaining} days`,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 32px;">
            <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 20px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                <span style="font-size: 40px;">⏰</span>
            </div>
            <h1 style="color: #1e293b; font-size: 24px; margin: 0;">Subscription Ending Soon</h1>
        </div>

        <!-- Main Card -->
        <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Hey ${userName}! 👋
            </p>
            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Just a friendly reminder that your <strong style="color: #7c3aed;">Pro (${planName})</strong> 
                will end in <strong style="color: #d97706;">${daysRemaining} days</strong>.
            </p>

            <!-- Warning Box -->
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 24px 0;">
                <p style="color: #92400e; font-size: 14px; margin: 0;">
                    ⚠️ After your subscription ends, you'll be moved to the Free plan with limited daily usage.
                </p>
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 32px 0;">
                <a href="https://skoowlai.com/dashboard/settings#billing" 
                   style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #4f46e5); color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 16px;">
                    Renew Subscription
                </a>
            </div>

            <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0; text-align: center;">
                Thank you for being a valued Skoowl AI student! 📚
            </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 32px; color: #94a3b8; font-size: 12px;">
            <p style="margin: 0;">© ${new Date().getFullYear()} Skoowl AI</p>
        </div>
    </div>
</body>
</html>
            `,
        });
        console.log(`✅ Reminder email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to send reminder email:', error);
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
