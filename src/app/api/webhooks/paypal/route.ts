import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getPayPalAccessToken } from '@/lib/paypal';

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
            // If we are in strictly local dev without ability to verify (e.g. tunneling issues), 
            // you might temporarily bypass this, but for production code we return 400.
            if (process.env.NODE_ENV === 'development') {
                console.warn('⚠️ Webhook signature verification failed, but allowing in Development mode.');
            } else {
                return NextResponse.json({ error: 'Invalid Signature' }, { status: 400 });
            }
        }

        const event = JSON.parse(bodyText);
        const eventType = event.event_type;
        const resource = event.resource;

        console.log(`Received PayPal Webhook: ${eventType}`);

        if (eventType === 'PAYMENT.SALE.COMPLETED') {
            // Handle successful payment (Renewal or Initial after trial)
            const subscriptionId = resource.billing_agreement_id;

            if (subscriptionId) {
                // Find user
                const user = await db.user.findFirst({
                    where: { subscriptionId: subscriptionId }
                });

                if (user) {
                    // Update subscription
                    // Determine duration based on plan
                    let newEndDate = new Date();
                    if (user.subscriptionPlan === 'yearly') {
                        newEndDate.setFullYear(newEndDate.getFullYear() + 1);
                    } else {
                        newEndDate.setMonth(newEndDate.getMonth() + 1);
                    }

                    await db.user.update({
                        where: { id: user.id },
                        data: {
                            subscriptionStatus: 'active', // Ensure it's active (removes 'trialing' or 'cancelled')
                            subscriptionEndsAt: newEndDate
                        }
                    });
                    console.log(`✅ Extended subscription for user ${user.id} until ${newEndDate.toISOString()}`);
                } else {
                    console.warn(`User not found for subscription ID: ${subscriptionId}`);
                }
            }
        }
        else if (eventType === 'BILLING.SUBSCRIPTION.CANCELLED') {
            const subscriptionId = resource.id;
            // Update status to confirmed cancelled
            await db.user.updateMany({
                where: { subscriptionId: subscriptionId },
                data: { subscriptionStatus: 'cancelled' }
            });
            console.log(`Cancelled subscription ${subscriptionId}`);
        }
        else if (eventType === 'BILLING.SUBSCRIPTION.SUSPENDED' || eventType === 'BILLING.SUBSCRIPTION.EXPIRED') {
            const subscriptionId = resource.id;
            // Update status
            await db.user.updateMany({
                where: { subscriptionId: subscriptionId },
                data: { subscriptionStatus: 'expired' } // or 'cancelled' if 'expired' not valid in your logic? 
                // User model is String, so 'expired' is fine, but check existing logic handling 'expired'.
                // 'isActive' usually checks 'active' | 'trialing'. So 'expired' = no access. Correct.
            });
            console.log(`Subscription ${eventType}: ${subscriptionId}`);
        }

        return NextResponse.json({ received: true });

    } catch (error: any) {
        console.error('Webhook processing error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * Handle GET requests for verification (e.g. PayPal checking if URL exists)
 */
export async function GET() {
    return NextResponse.json({ status: 'active', message: 'PayPal Webhook Listener is running' });
}
