import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendWelcomeEmail } from '@/lib/email';

/**
 * Emergency subscription fix endpoint
 * This manually activates a subscription when webhooks fail
 * 
 * Usage: GET https://skoowlai.com/api/fix-subscription?secret=YOUR_SECRET
 */
export async function GET(request: Request) {
    try {
        // Simple secret check (you should use a proper secret)
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');

        // Temp secret for immediate fix
        if (secret !== 'fix-my-sub-now-123') {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const USER_EMAIL = 'faiswibowo14@gmail.com';
        const SUBSCRIPTION_ID = 'sub_0NWB7mbwknxctZunKQ2Ji';
        const CUSTOMER_ID = 'cus_0NWB7mblPbviqTETcSahi';
        const SUBSCRIPTION_PLAN = 'monthly';
        const NEXT_BILLING_DATE = new Date('2026-01-20T05:39:00Z');

        console.log('🔍 Looking for user:', USER_EMAIL);

        // Find the user
        const user = await db.user.findFirst({
            where: { email: USER_EMAIL }
        });

        if (!user) {
            return NextResponse.json(
                { error: 'User not found', email: USER_EMAIL },
                { status: 404 }
            );
        }

        console.log('✅ User found:', user.id);
        console.log('📊 Current subscription status:', {
            status: user.subscriptionStatus,
            plan: user.subscriptionPlan,
            subscriptionId: user.subscriptionId,
            endsAt: user.subscriptionEndsAt,
        });

        // Update subscription
        console.log('🔄 Updating subscription...');
        const updated = await db.user.update({
            where: { id: user.id },
            data: {
                subscriptionStatus: 'active',
                subscriptionPlan: SUBSCRIPTION_PLAN,
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                subscriptionEndsAt: NEXT_BILLING_DATE,
            }
        });

        console.log('✅ Subscription updated successfully!');

        // Send welcome email
        console.log('📧 Sending welcome email...');
        try {
            await sendWelcomeEmail({
                email: USER_EMAIL,
                plan: SUBSCRIPTION_PLAN as 'monthly' | 'yearly',
                subscriptionId: SUBSCRIPTION_ID,
            });
            console.log('✅ Welcome email sent!');
        } catch (emailError) {
            console.warn('⚠️ Failed to send welcome email:', emailError);
        }

        return NextResponse.json({
            success: true,
            message: 'Subscription activated successfully!',
            user: {
                email: updated.email,
                subscriptionStatus: updated.subscriptionStatus,
                subscriptionPlan: updated.subscriptionPlan,
                subscriptionId: updated.subscriptionId,
                subscriptionEndsAt: updated.subscriptionEndsAt,
            }
        });

    } catch (error) {
        console.error('❌ Error fixing subscription:', error);
        return NextResponse.json(
            { error: 'Failed to fix subscription', details: String(error) },
            { status: 500 }
        );
    }
}
