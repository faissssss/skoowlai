import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendSubscriptionEmails, sendWelcomeEmail, sendReceiptEmail } from '@/lib/email';
import { requireAuth } from '@/lib/auth';

/**
 * Verify PayPal subscription status with PayPal API
 * This ensures users can't fake a subscription ID to get premium access
 */
async function verifyPayPalSubscription(subscriptionId: string): Promise<{
    isValid: boolean;
    status?: string;
    planId?: string;
    isTrial?: boolean;
    nextBillingDate?: Date;
    error?: string;
}> {
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    const clientSecret = process.env.NEXT_PAYPAL_SECRET;

    // If no secret configured, log warning but allow (for dev/testing)
    // In production, you MUST set PAYPAL_SECRET
    if (!clientSecret) {
        console.warn('⚠️ NEXT_PAYPAL_SECRET not configured. Skipping subscription verification. THIS IS A SECURITY RISK IN PRODUCTION!');
        return { isValid: true, status: 'unverified' };
    }

    try {
        // Get OAuth token from PayPal
        const authResponse = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Accept-Language': 'en_US',
                'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'grant_type=client_credentials',
        });

        if (!authResponse.ok) {
            console.error('PayPal auth failed:', await authResponse.text());
            return { isValid: false, error: 'PayPal authentication failed' };
        }

        const authData = await authResponse.json();
        const accessToken = authData.access_token;

        // Get subscription details from PayPal
        const subResponse = await fetch(`https://api-m.paypal.com/v1/billing/subscriptions/${subscriptionId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!subResponse.ok) {
            console.error('PayPal subscription fetch failed:', await subResponse.text());
            return { isValid: false, error: 'Invalid subscription ID' };
        }

        const subData = await subResponse.json();

        // Check if subscription is active
        const validStatuses = ['ACTIVE', 'APPROVED']; // APPROVED = just created, ACTIVE = recurring
        const isValid = validStatuses.includes(subData.status);

        // Detect Trial
        // Heuristic: If next_billing_time is significantly closer than the plan interval
        // E.g. 7 days vs 1 month
        let isTrial = false;
        let nextBillingDate: Date | undefined;

        if (subData.billing_info?.next_billing_time && subData.start_time) {
            const startTime = new Date(subData.start_time);
            nextBillingDate = new Date(subData.billing_info.next_billing_time);

            const diffTime = Math.abs(nextBillingDate.getTime() - startTime.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // If duration is le 14 days, assume it's a trial (since monthly is ~30)
            if (diffDays <= 15) {
                isTrial = true;
            }
        }

        return {
            isValid,
            status: subData.status,
            planId: subData.plan_id,
            isTrial,
            nextBillingDate,
            error: isValid ? undefined : `Subscription status is ${subData.status}, not ACTIVE`,
        };
    } catch (error) {
        console.error('Error verifying PayPal subscription:', error);
        return { isValid: false, error: 'Failed to verify subscription' };
    }
}

export async function POST(request: NextRequest) {
    // 1. Authenticate user first (CRITICAL SECURITY)
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

        // 2. CRITICAL: Verify subscription with PayPal API
        const verification = await verifyPayPalSubscription(subscriptionId);

        if (!verification.isValid) {
            console.warn(`⚠️ Invalid PayPal subscription attempt by user ${user.id}: ${verification.error}`);
            return NextResponse.json(
                { error: verification.error || 'Subscription verification failed' },
                { status: 403 }
            );
        }

        console.log(`✅ PayPal subscription verified: ${subscriptionId} (status: ${verification.status}, trial: ${verification.isTrial})`);

        // 3. Calculate subscription end date based on plan
        // Use nextBillingDate from PayPal if available, otherwise calculate
        let subscriptionEndsAt = verification.nextBillingDate;

        const planType = plan || 'monthly';
        if (!subscriptionEndsAt) {
            subscriptionEndsAt = new Date();
            if (verification.isTrial) {
                subscriptionEndsAt.setDate(subscriptionEndsAt.getDate() + 7); // Default fallback
            } else if (planType === 'yearly') {
                subscriptionEndsAt.setFullYear(subscriptionEndsAt.getFullYear() + 1);
            } else {
                subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + 1);
            }
        }

        // 4. Update authenticated user's subscription
        await db.user.update({
            where: { id: user.id },
            data: {
                subscriptionStatus: verification.isTrial ? 'trialing' : 'active',
                subscriptionId: subscriptionId,
                subscriptionPlan: planType,
                subscriptionEndsAt: subscriptionEndsAt,
                customerId: user.customerId || `paypal_${subscriptionId}`,
            }
        });

        console.log(`PayPal subscription activated for user ${user.id} (${user.email}): ${subscriptionId}`);

        // 5. Send welcome and receipt emails
        if (user.email) {
            if (verification.isTrial) {
                // For trials, only send welcome email (no receipt for $0)
                await sendWelcomeEmail({
                    email: user.email,
                    name: name || undefined,
                    plan: planType,
                    subscriptionId,
                });
            } else {
                // For paid, send both
                await sendSubscriptionEmails({
                    email: user.email,
                    name: name || undefined,
                    plan: planType,
                    subscriptionId,
                });
            }
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
