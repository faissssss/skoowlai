import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendWelcomeEmail } from '@/lib/email';
import { requireAdmin, requireDebugSecret } from '@/lib/admin';

/**
 * Emergency subscription fix endpoint
 * This manually activates a subscription when webhooks fail
 * 
 * Usage: POST /api/fix-subscription with JSON body
 * { email, subscriptionId, customerId, plan, endsAt }
 */
export async function GET() {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}

export async function POST(request: NextRequest) {
    try {
        const admin = await requireAdmin();
        if (!admin.ok) return admin.response;

        const secretError = requireDebugSecret(request, 'FIX_SUBSCRIPTION_SECRET');
        if (secretError) return secretError;

        const body = await request.json();
        const {
            email,
            subscriptionId,
            customerId,
            plan,
            endsAt,
        } = body || {};

        if (!email || !subscriptionId || !customerId || !plan || !endsAt) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const NEXT_BILLING_DATE = new Date(endsAt);
        if (Number.isNaN(NEXT_BILLING_DATE.getTime())) {
            return NextResponse.json({ error: 'Invalid endsAt date' }, { status: 400 });
        }

        console.log('🔍 Looking for user:', email);

        // Find the user
        const user = await db.user.findFirst({
            where: { email }
        });

        if (!user) {
            return NextResponse.json(
                { error: 'User not found', email },
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
                subscriptionPlan: plan,
                subscriptionId,
                customerId,
                subscriptionEndsAt: NEXT_BILLING_DATE,
            }
        });

        console.log('✅ Subscription updated successfully!');

        // Send welcome email
        console.log('📧 Sending welcome email...');
        try {
            await sendWelcomeEmail({
                email,
                plan: plan as 'monthly' | 'yearly',
                subscriptionId,
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
            { error: 'Failed to fix subscription' },
            { status: 500 }
        );
    }
}
