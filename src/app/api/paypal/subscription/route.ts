import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendSubscriptionEmails } from '@/lib/email';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
    // 1. Authenticate user first (CRITICAL SECURITY FIX)
    const { user, errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    try {
        const { subscriptionId, plan, name } = await request.json();

        if (!subscriptionId) {
            return NextResponse.json(
                { error: 'Missing subscription ID' },
                { status: 400 }
            );
        }

        // Calculate subscription end date based on plan
        const subscriptionEndsAt = new Date();
        const planType = plan || 'monthly';
        if (planType === 'yearly') {
            subscriptionEndsAt.setFullYear(subscriptionEndsAt.getFullYear() + 1);
        } else {
            subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + 1);
        }

        // Update authenticated user's subscription
        await db.user.update({
            where: { id: user.id },
            data: {
                subscriptionStatus: 'active',
                subscriptionId: subscriptionId,
                subscriptionPlan: planType,
                subscriptionEndsAt: subscriptionEndsAt,
                // PayPal doesn't give us a customer ID in the same way, use subscription ID as fallback
                customerId: user.customerId || `paypal_${subscriptionId}`,
            }
        });

        console.log(`PayPal subscription activated for user ${user.id} (${user.email}): ${subscriptionId}`);

        // Send welcome and receipt emails
        if (user.email) {
            await sendSubscriptionEmails({
                email: user.email,
                name: name || undefined,
                plan: plan || 'monthly',
                subscriptionId,
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving PayPal subscription:', error);
        return NextResponse.json(
            { error: 'Failed to save subscription' },
            { status: 500 }
        );
    }
}
