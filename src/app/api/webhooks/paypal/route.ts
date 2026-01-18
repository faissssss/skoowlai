import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getPayPalAccessToken } from '@/lib/paypal';
import { logStateTransition } from '@/lib/subscriptionState';
import { SubscriptionStatus } from '@/lib/subscription';
import { sendWelcomeEmail, sendReceiptEmail, sendCancellationEmail } from '@/lib/email';

/**
 * Verify PayPal Webhook Signature
 */
async function verifyPayPalWebhookSignature(req: NextRequest, bodyText: string): Promise<boolean> {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;

    if (!webhookId) {
        console.error('CRITICAL: PAYPAL_WEBHOOK_ID is not set. Cannot verify webhook signature.');
        return false;
    }

    try {
        const accessToken = await getPayPalAccessToken();

        const verificationPayload = {
            auth_algo: req.headers.get('paypal-auth-algo'),
            cert_url: req.headers.get('paypal-cert-url'),
            transmission_id: req.headers.get('paypal-transmission-id'),
            transmission_sig: req.headers.get('paypal-transmission-sig'),
            transmission_time: req.headers.get('paypal-transmission-time'),
            webhook_id: webhookId,
            webhook_event: JSON.parse(bodyText)
        };

        const res = await fetch('https://api-m.paypal.com/v1/notifications/verify-webhook-signature', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(verificationPayload)
        });

        const data = await res.json();
        return data.verification_status === 'SUCCESS';
    } catch (error) {
        console.error('PayPal signature verification failed:', error);
        return false;
    }
}

export async function POST(req: NextRequest) {
    try {
        // 1. Get Raw Body (needed for verification)
        const bodyText = await req.text();

        // 2. Verify Signature
        // Skip verification in development if needed, but risky.
        // We will enforce it, but if ENV is missing it returns 400.
        const isValid = await verifyPayPalWebhookSignature(req, bodyText);

        if (!isValid) {
            // SECURITY: Only bypass if BOTH conditions are true:
            // 1. Explicit opt-in via SKIP_WEBHOOK_VERIFICATION=true
            // 2. Must be in development mode
            if (process.env.SKIP_WEBHOOK_VERIFICATION === 'true' && process.env.NODE_ENV === 'development') {
                console.warn('⚠️ Webhook signature verification failed, bypassing in DEV mode (SKIP_WEBHOOK_VERIFICATION=true)');
            } else {
                console.error('PayPal webhook signature verification failed');
                return NextResponse.json({ error: 'Invalid Signature' }, { status: 400 });
            }
        }

        const event = JSON.parse(bodyText);
        const eventType = event.event_type;
        const resource = event.resource;

        console.log(`Received PayPal Webhook: ${eventType}`);

        if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED') {
            // Handle subscription activation (trial started or immediate payment)
            const subscriptionId = resource.id;

            if (subscriptionId) {
                const user = await db.user.findFirst({
                    where: { subscriptionId: subscriptionId }
                });

                if (user) {
                    // Send welcome email
                    if (user.email && user.subscriptionPlan) {
                        await sendWelcomeEmail({
                            email: user.email,
                            name: undefined,
                            plan: user.subscriptionPlan as 'monthly' | 'yearly',
                            subscriptionId: subscriptionId
                        });
                    }

                    // Log state transition
                    await logStateTransition(
                        user.id,
                        user.subscriptionStatus as SubscriptionStatus,
                        'active',
                        subscriptionId,
                        'paypal',
                        { event: 'BILLING.SUBSCRIPTION.ACTIVATED' }
                    );

                    console.log(`✅ Sent welcome email for PayPal subscription ${subscriptionId}`);
                }
            }
        }
        else if (eventType === 'PAYMENT.SALE.COMPLETED') {
            // Handle successful payment (Renewal, Initial after trial, or Resubscription)
            const subscriptionId = resource.billing_agreement_id;
            const payerEmail = resource.payer?.payer_info?.email;

            if (subscriptionId) {
                // Use transaction to prevent race conditions
                await db.$transaction(async (tx) => {
                    // Find user by subscription ID first
                    let user = await tx.user.findFirst({
                        where: { subscriptionId: subscriptionId }
                    });

                    // If not found, try by payer email (resubscription case with new subscription ID)
                    if (!user && payerEmail) {
                        user = await tx.user.findFirst({
                            where: { email: payerEmail }
                        });
                    }

                    if (!user) {
                        console.warn(`User not found for subscription ID: ${subscriptionId}`);
                        return;
                    }

                    // Determine if this is a resubscription or renewal
                    const isNewSubscription = user.subscriptionId !== subscriptionId;
                    const isResubscription = isNewSubscription && (user.subscriptionStatus === 'cancelled' || user.subscriptionStatus === 'expired' || user.subscriptionStatus === 'free');
                    const wasActive = user.subscriptionStatus === 'active';

                    // Log state transition
                    await logStateTransition(
                        user.id,
                        user.subscriptionStatus as SubscriptionStatus,
                        'active',
                        subscriptionId,
                        'paypal',
                        { event: 'PAYMENT.SALE.COMPLETED', plan: user.subscriptionPlan, isResubscription, isNewSubscription }
                    );

                    // Determine duration based on plan
                    let newEndDate = new Date();
                    if (user.subscriptionPlan === 'yearly') {
                        newEndDate.setFullYear(newEndDate.getFullYear() + 1);
                    } else {
                        newEndDate.setMonth(newEndDate.getMonth() + 1);
                    }

                    await tx.user.update({
                        where: { id: user.id },
                        data: {
                            subscriptionStatus: 'active',
                            subscriptionEndsAt: newEndDate,
                            subscriptionId: subscriptionId, // Update to new subscription ID
                        }
                    });

                    // Send emails
                    if (user.email && user.subscriptionPlan) {
                        // Send welcome email for new subscriptions and resubscriptions
                        if (isNewSubscription || isResubscription) {
                            await sendWelcomeEmail({
                                email: user.email,
                                name: undefined,
                                plan: user.subscriptionPlan as 'monthly' | 'yearly',
                                subscriptionId: subscriptionId
                            });
                        }

                        // Always send receipt email
                        await sendReceiptEmail({
                            email: user.email,
                            name: undefined,
                            plan: user.subscriptionPlan as 'monthly' | 'yearly',
                            subscriptionId: subscriptionId
                        });
                    }

                    console.log(`✅ ${isResubscription ? 'Resubscription' : wasActive ? 'Renewal' : 'New subscription'} for user ${user.id} until ${newEndDate.toISOString()}`);
                });
            }
        }
        else if (eventType === 'BILLING.SUBSCRIPTION.CANCELLED') {
            const subscriptionId = resource.id;

            // Get full user data for email
            const user = await db.user.findFirst({
                where: { subscriptionId: subscriptionId }
            });

            if (user) {
                // Log state transition
                await logStateTransition(
                    user.id,
                    user.subscriptionStatus as SubscriptionStatus,
                    'cancelled',
                    subscriptionId,
                    'paypal',
                    { event: 'BILLING.SUBSCRIPTION.CANCELLED' }
                );

                // If in trial, revoke access immediately
                if (user.subscriptionStatus === 'trialing') {
                    await db.user.update({
                        where: { id: user.id },
                        data: {
                            subscriptionStatus: 'cancelled',
                            subscriptionEndsAt: new Date(), // Immediate
                        }
                    });
                    console.log(`✅ Trial cancelled immediately for user ${user.id}`);
                } else {
                    // If paid, keep access until end of billing period
                    await db.user.update({
                        where: { id: user.id },
                        data: {
                            subscriptionStatus: 'cancelled',
                            // Keep existing subscriptionEndsAt
                        }
                    });
                    console.log(`✅ Subscription cancelled for user ${user.id}, access until ${user.subscriptionEndsAt?.toISOString()}`);
                }

                // Send cancellation email
                if (user.email && user.subscriptionPlan && user.subscriptionEndsAt) {
                    await sendCancellationEmail({
                        email: user.email,
                        name: undefined,
                        plan: user.subscriptionPlan as 'monthly' | 'yearly',
                        accessEndsAt: user.subscriptionEndsAt
                    });
                }
            } else {
                // Fallback for user not found
                await db.user.updateMany({
                    where: { subscriptionId: subscriptionId },
                    data: { subscriptionStatus: 'cancelled' }
                });
                console.log(`Cancelled subscription ${subscriptionId}`);
            }
        }
        else if (eventType === 'BILLING.SUBSCRIPTION.SUSPENDED' || eventType === 'BILLING.SUBSCRIPTION.EXPIRED') {
            const subscriptionId = resource.id;

            // Log state transition
            const user = await db.user.findFirst({
                where: { subscriptionId: subscriptionId },
                select: { id: true, subscriptionStatus: true }
            });

            if (user) {
                await logStateTransition(
                    user.id,
                    user.subscriptionStatus as SubscriptionStatus,
                    'expired',
                    subscriptionId,
                    'paypal',
                    { event: eventType }
                );
            }

            // Update status
            await db.user.updateMany({
                where: { subscriptionId: subscriptionId },
                data: { subscriptionStatus: 'expired' }
            });
            console.log(`Subscription ${eventType}: ${subscriptionId}`);
        }

        return NextResponse.json({ received: true });

    } catch (error: any) {
        // Log full error server-side for debugging
        console.error('Webhook processing error:', error);
        // Return generic message to client (error masking)
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
}

/**
 * Handle GET requests for verification (e.g. PayPal checking if URL exists)
 */
export async function GET() {
    return NextResponse.json({ status: 'active', message: 'PayPal Webhook Listener is running' });
}
