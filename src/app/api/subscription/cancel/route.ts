import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { checkCsrfOrigin } from '@/lib/csrf';
import { cancelDodoSubscriptionViaSdk } from '@/lib/dodo';

/**
 * Cancel subscription API endpoint
 *
 * Behavior (Dodo-only):
 * - Attempts to cancel the user's subscription via Dodo Payments using the Node SDK.
 * - Marks the local subscription as cancelled; actual access end date is enforced via webhooks + subscriptionEndsAt.
 * - Cancellation emails are sent exclusively from the Dodo webhook handler to ensure idempotency.
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
        // - Immediate for trials (access ends now)
        // - Schedule at period end for paid
        const isTrial = user.subscriptionStatus === 'trialing';
        const cancelled = await cancelDodoSubscriptionViaSdk(subscriptionId, { immediate: isTrial });
        if (!cancelled) {
            return NextResponse.json(
                { error: 'Failed to cancel subscription. Please try again later.' },
                { status: 500 }
            );
        }

        // Update our DB immediately
        // - Trial: ends immediately (consistent with immediate cancel)
        // - Paid: keep access until end of current period
        const accessEndsAt = isTrial ? new Date() : (user.subscriptionEndsAt || new Date());

        await db.user.update({
            where: { id: user.id },
            data: {
                subscriptionStatus: 'cancelled',
                ...(isTrial ? { subscriptionEndsAt: accessEndsAt } : {}),
                paymentGracePeriodEndsAt: null,
            }
        });

        console.log(`✅ Subscription cancellation requested for user ${user.id}`);

        return NextResponse.json({
            success: true,
            message: 'Subscription cancelled successfully. A confirmation email will be sent shortly.',
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

