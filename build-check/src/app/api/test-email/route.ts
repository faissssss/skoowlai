import { NextRequest, NextResponse } from 'next/server';
import { sendSubscriptionEmails } from '@/lib/email';
import { auth } from '@clerk/nextjs/server';
import { checkCsrfOrigin } from '@/lib/csrf';

/**
 * Test endpoint to verify subscription emails work
 * Only works in development or for authenticated admins
 * 
 * Usage: POST /api/test-email with body { "email": "your@email.com" }
 */
export async function POST(req: NextRequest) {
    const csrfError = checkCsrfOrigin(req);
    if (csrfError) return csrfError;

    // Security: Only allow in development or for configured admins
    const isDev = process.env.NODE_ENV === 'development';
    const { userId } = await auth();

    // SECURITY: Use environment variable for admin IDs (not hardcoded placeholders)
    const adminIds = (process.env.ADMIN_USER_IDS || '')
        .split(',')
        .map(id => id.trim())
        .filter(Boolean);

    if (!isDev && (!userId || !adminIds.includes(userId))) {
        console.warn('[Security] Unauthorized test-email access attempt', {
            userId: userId || 'none',
            timestamp: new Date().toISOString(),
        });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const testEmail = body.email;

        if (!testEmail) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        console.log(`🧪 Testing subscription emails to: ${testEmail} (${body.plan || 'monthly'})`);

        // Send test emails
        const result = await sendSubscriptionEmails({
            email: testEmail,
            name: 'Test User',
            plan: body.plan || 'monthly',
            subscriptionId: 'test_sub_' + Date.now(),
        });

        if (result) {
            return NextResponse.json({
                success: true,
                message: `✅ Test emails sent to ${testEmail}! Check your inbox.`
            });
        } else {
            return NextResponse.json({
                success: false,
                message: '❌ Failed to send emails. Check server logs.'
            }, { status: 500 });
        }
    } catch (error: any) {
        console.error('Test email error:', error);
        const isProd = process.env.NODE_ENV === 'production';
        return NextResponse.json({
            error: isProd ? 'Failed to send test email' : (error.message || 'Unknown error')
        }, { status: 500 });
    }
}
