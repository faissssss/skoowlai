import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { sendCancellationEmail } from '@/lib/email';
import { checkCsrfOrigin } from '@/lib/csrf';
import { cancelDodoSubscriptionViaSdk } from '@/lib/dodo';

/**
 * Cancel subscription API endpoint
 *
 * Current behavior (Dodo-only):
 * - Attempts to cancel the user's subscription via Dodo Payments using the Node SDK.
 * - Updates our local DB, actual access end date is enforced via webhooks + subscriptionEndsAt.
 */
export async function POST(request: NextRequest) {
    // CSRF Protection: Check origin
    const csrfError = checkCsrfOrigin(request);
    if (csrfError) return csrfError;

    // Authenticate user
    const { user, errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    try {
        // Check if user has an active subscription (trialing or active)
        if (user.subscriptionStatus !== 'active' && user.subscriptionStatus !== 'trialing') {
            return NextResponse.json(
                { error: 'No active subscription to cancel' },
                { status: 400 }
            );
        }

        const subscriptionId = user.subscriptionId;
        if (!subscriptionId) {
            return NextResponse.json(
                { error: 'Subscription ID not found' },
                { status: 400 }
            );
        }

        // Attempt to cancel via Dodo Billing SDK
        const cancelled = await cancelDodoSubscriptionViaSdk(subscriptionId);
        if (!cancelled) {
            return NextResponse.json(
                { error: 'Failed to cancel subscription. Please try again or use the customer portal.' },
                { status: 500 }
            );
        }

        // Local status will be updated by the webhook, but we can optimistically mark as cancelled
        const accessEndsAt = user.subscriptionEndsAt || new Date();
        await db.user.update({
            where: { id: user.id },
            data: {
                subscriptionStatus: 'cancelled',
            }
        });

        // Send cancellation email
        if (user.email && user.subscriptionPlan) {
            await sendCancellationEmail({
                email: user.email,
                name: undefined,
                plan: (user.subscriptionPlan as 'monthly' | 'yearly') || 'monthly',
                accessEndsAt,
            });
        }

        console.log(`✅ Subscription cancellation requested for user ${user.id}`);

        return NextResponse.json({
            success: true,
            message: 'Subscription cancelled successfully',
            accessEndsAt,
        });
    } catch (error) {
        console.error('Error cancelling subscription via Dodo SDK:', error);
        return NextResponse.json(
            { error: 'Failed to cancel subscription' },
            { status: 500 }
        );
    }
}

