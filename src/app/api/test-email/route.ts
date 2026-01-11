import { NextRequest, NextResponse } from 'next/server';
import { sendSubscriptionEmails } from '@/lib/email';
import { auth } from '@clerk/nextjs/server';

/**
 * Test endpoint to verify subscription emails work
 * Only works in development or for authenticated admins
 * 
 * Usage: POST /api/test-email with body { "email": "your@email.com" }
 */
export async function POST(req: NextRequest) {
    // Security: Only allow in development or for specific admin
    const isDev = process.env.NODE_ENV === 'development';
    const { userId } = await auth();

    // Add your admin clerk ID here for production testing
    const ADMIN_CLERK_IDS = ['user_2abc123']; // Replace with your actual Clerk user ID

    if (!isDev && (!userId || !ADMIN_CLERK_IDS.includes(userId))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const testEmail = body.email;

        if (!testEmail) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        console.log(`🧪 Testing subscription emails to: ${testEmail}`);

        // Send test emails
        const result = await sendSubscriptionEmails({
            email: testEmail,
            name: 'Test User',
            plan: 'monthly',
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
        return NextResponse.json({
            error: error.message || 'Unknown error'
        }, { status: 500 });
    }
}
