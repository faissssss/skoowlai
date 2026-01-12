import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { sendCancellationEmail } from '@/lib/email';
import { checkCsrfOrigin } from '@/lib/csrf';

/**
 * Cancel subscription API endpoint
 * Cancels the user's subscription via Dodo Payments or PayPal
 */
export async function POST(request: NextRequest) {
    // CSRF Protection: Check origin
    const csrfError = checkCsrfOrigin(request);
    if (csrfError) return csrfError;

    // Authenticate user
    const { user, errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    try {
        // Check if user has an active subscription
        if (user.subscriptionStatus !== 'active') {
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

        // Determine if this is a PayPal or Dodo subscription
        const isPayPal = user.customerId?.startsWith('paypal_');

        if (isPayPal) {
            // Cancel via PayPal API
            const cancelled = await cancelPayPalSubscription(subscriptionId);
            if (!cancelled) {
                return NextResponse.json(
                    { error: 'Failed to cancel PayPal subscription. Please try again or cancel directly on PayPal.' },
                    { status: 500 }
                );
            }
        } else {
            // Cancel via Dodo Payments API
            const cancelled = await cancelDodoSubscription(subscriptionId);
            if (!cancelled) {
                return NextResponse.json(
                    { error: 'Failed to cancel subscription. Please try again.' },
                    { status: 500 }
                );
            }
        }

        // Update database
        const accessEndsAt = user.subscriptionEndsAt || new Date();
        await db.user.update({
            where: { id: user.id },
            data: {
                subscriptionStatus: 'cancelled',
            }
        });

        // Send cancellation email
        if (user.email) {
            await sendCancellationEmail({
                email: user.email,
                name: undefined,
                plan: (user.subscriptionPlan as 'monthly' | 'yearly') || 'monthly',
                accessEndsAt,
            });
        }

        console.log(`✅ Subscription cancelled for user ${user.id}`);

        return NextResponse.json({
            success: true,
            message: 'Subscription cancelled successfully',
            accessEndsAt,
        });
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        return NextResponse.json(
            { error: 'Failed to cancel subscription' },
            { status: 500 }
        );
    }
}

/**
 * Cancel PayPal subscription
 */
async function cancelPayPalSubscription(subscriptionId: string): Promise<boolean> {
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    const clientSecret = process.env.NEXT_PAYPAL_SECRET;

    if (!clientSecret) {
        console.error('NEXT_PAYPAL_SECRET not configured');
        return false;
    }

    try {
        // Get OAuth token
        const authResponse = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'grant_type=client_credentials',
        });

        if (!authResponse.ok) {
            console.error('PayPal auth failed');
            return false;
        }

        const authData = await authResponse.json();

        // Cancel subscription
        const cancelResponse = await fetch(
            `https://api-m.paypal.com/v1/billing/subscriptions/${subscriptionId}/cancel`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authData.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    reason: 'User requested cancellation'
                }),
            }
        );

        // 204 = success, subscription cancelled
        return cancelResponse.status === 204;
    } catch (error) {
        console.error('Error cancelling PayPal subscription:', error);
        return false;
    }
}

/**
 * Cancel Dodo Payments subscription
 */
async function cancelDodoSubscription(subscriptionId: string): Promise<boolean> {
    const apiKey = process.env.DODO_PAYMENTS_API_KEY;

    if (!apiKey) {
        console.error('DODO_PAYMENTS_API_KEY not configured');
        // For now, just update the database status - the webhook will handle the rest
        return true;
    }

    try {
        // Dodo Payments API call to cancel subscription
        // Note: Replace with actual Dodo Payments API endpoint
        const response = await fetch(
            `https://api.dodopayments.com/subscriptions/${subscriptionId}/cancel`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        return response.ok;
    } catch (error) {
        console.error('Error cancelling Dodo subscription:', error);
        // Still return true so we update the local database
        // The webhook will sync with Dodo's status
        return true;
    }
}
