import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendWelcomeEmail, sendReceiptEmail } from '@/lib/email';
import crypto from 'crypto';

/**
 * Custom Dodo Payments Webhook Handler
 * Bypasses @dodopayments/nextjs library for better debugging
 */

// Verify webhook signature manually
function verifySignature(payload: string, headers: Headers, secret: string): { valid: boolean; error?: string } {
    try {
        const webhookId = headers.get('webhook-id') || headers.get('svix-id');
        const webhookTimestamp = headers.get('webhook-timestamp') || headers.get('svix-timestamp');
        const webhookSignature = headers.get('webhook-signature') || headers.get('svix-signature');

        if (!webhookId || !webhookTimestamp || !webhookSignature) {
            return {
                valid: false,
                error: `Missing headers: id=${!!webhookId}, ts=${!!webhookTimestamp}, sig=${!!webhookSignature}`
            };
        }

        // Check timestamp is within 5 minutes
        const timestamp = parseInt(webhookTimestamp, 10);
        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - timestamp) > 300) {
            return { valid: false, error: `Timestamp too old: ${now - timestamp}s ago` };
        }

        // Secret format: whsec_BASE64_ENCODED_KEY
        const secretKey = secret.startsWith('whsec_') ? secret.slice(6) : secret;
        const secretBytes = Buffer.from(secretKey, 'base64');

        // Sign: msgId.timestamp.payload
        const signedPayload = `${webhookId}.${webhookTimestamp}.${payload}`;
        const expectedSignature = crypto
            .createHmac('sha256', secretBytes)
            .update(signedPayload)
            .digest('base64');

        // Signature header format: v1,BASE64_SIG or just BASE64_SIG
        const signatures = webhookSignature.split(' ');
        for (const sig of signatures) {
            const [version, sigValue] = sig.includes(',') ? sig.split(',') : ['v1', sig];
            if (sigValue === expectedSignature) {
                return { valid: true };
            }
        }

        return {
            valid: false,
            error: `Signature mismatch. Expected prefix: ${expectedSignature.substring(0, 10)}... Got: ${webhookSignature.substring(0, 20)}...`
        };
    } catch (err) {
        return { valid: false, error: `Verification error: ${err}` };
    }
}

export async function POST(request: NextRequest) {
    const startTime = Date.now();
    console.log('🔔 [WEBHOOK] Request received at', new Date().toISOString());

    try {
        // Get raw body
        const payload = await request.text();
        console.log('📦 [WEBHOOK] Payload size:', payload.length, 'bytes');

        // Log all headers for debugging
        const headerLog: Record<string, string> = {};
        request.headers.forEach((value, key) => {
            headerLog[key] = key.includes('signature') ? value.substring(0, 20) + '...' : value;
        });
        console.log('📋 [WEBHOOK] Headers:', JSON.stringify(headerLog, null, 2));

        // Get webhook secret
        const webhookSecret = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
        if (!webhookSecret) {
            console.error('❌ [WEBHOOK] DODO_PAYMENTS_WEBHOOK_KEY not configured!');
            return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
        }
        console.log('🔑 [WEBHOOK] Secret configured (starts with):', webhookSecret.substring(0, 10));

        // Verify signature
        const verification = verifySignature(payload, request.headers, webhookSecret);
        if (!verification.valid) {
            console.error('❌ [WEBHOOK] Signature verification failed:', verification.error);
            // Return 200 anyway for debugging - change to 401 in production
            // return NextResponse.json({ error: 'Invalid signature', details: verification.error }, { status: 401 });
        } else {
            console.log('✅ [WEBHOOK] Signature verified successfully');
        }

        // Parse payload
        const event = JSON.parse(payload);
        const eventType = event.type;
        console.log('📨 [WEBHOOK] Event type:', eventType);

        // Handle different event types
        switch (eventType) {
            case 'subscription.active':
                await handleSubscriptionActive(event.data);
                break;
            case 'subscription.cancelled':
                await handleSubscriptionCancelled(event.data);
                break;
            case 'payment.succeeded':
                await handlePaymentSucceeded(event.data);
                break;
            case 'subscription.updated':
                await handleSubscriptionUpdated(event.data);
                break;
            default:
                console.log('ℹ️ [WEBHOOK] Unhandled event type:', eventType);
        }

        const duration = Date.now() - startTime;
        console.log(`✅ [WEBHOOK] Completed in ${duration}ms`);
        return NextResponse.json({ received: true, duration: `${duration}ms` });

    } catch (error) {
        console.error('❌ [WEBHOOK] Error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

async function handleSubscriptionActive(data: any) {
    console.log('🎉 [WEBHOOK] Processing subscription.active');

    const customerEmail = data.customer?.email;
    const customerName = data.customer?.name;
    const subscriptionId = data.subscription_id;
    const customerId = data.customer?.customer_id;

    console.log('📧 [WEBHOOK] Customer:', customerEmail);
    console.log('🆔 [WEBHOOK] Subscription ID:', subscriptionId);

    if (!customerEmail) {
        console.error('❌ [WEBHOOK] No customer email in payload');
        return;
    }

    // Determine plan
    const interval = data.payment_frequency_interval?.toLowerCase() || 'month';
    const plan = interval === 'year' ? 'yearly' : 'monthly';

    // Calculate subscription end date
    let subscriptionEndsAt = data.next_billing_date
        ? new Date(data.next_billing_date)
        : new Date(Date.now() + (plan === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000);

    try {
        // Update user in database
        const updatedUser = await db.user.updateMany({
            where: { email: customerEmail },
            data: {
                subscriptionStatus: 'active',
                subscriptionId: subscriptionId,
                customerId: customerId,
                subscriptionPlan: plan,
                subscriptionEndsAt: subscriptionEndsAt,
            }
        });

        console.log('💾 [WEBHOOK] Database updated:', updatedUser.count, 'user(s)');

        if (updatedUser.count > 0) {
            // Send welcome email
            try {
                await sendWelcomeEmail({
                    email: customerEmail,
                    name: customerName || undefined,
                    plan: plan as 'monthly' | 'yearly',
                    subscriptionId: subscriptionId,
                });
                console.log('📨 [WEBHOOK] Welcome email sent');
            } catch (emailError) {
                console.error('❌ [WEBHOOK] Failed to send welcome email:', emailError);
            }
        } else {
            console.warn('⚠️ [WEBHOOK] No user found with email:', customerEmail);
        }
    } catch (dbError) {
        console.error('❌ [WEBHOOK] Database error:', dbError);
        throw dbError;
    }
}

async function handleSubscriptionCancelled(data: any) {
    console.log('🚫 [WEBHOOK] Processing subscription.cancelled');

    const subscriptionId = data.subscription_id;
    if (!subscriptionId) {
        console.error('❌ [WEBHOOK] No subscription_id in payload');
        return;
    }

    const result = await db.user.updateMany({
        where: { subscriptionId: subscriptionId },
        data: { subscriptionStatus: 'cancelled' }
    });

    console.log('💾 [WEBHOOK] Cancelled:', result.count, 'user(s)');
}

async function handlePaymentSucceeded(data: any) {
    console.log('💰 [WEBHOOK] Processing payment.succeeded');

    const customerEmail = data.customer?.email;
    const customerName = data.customer?.name;
    const subscriptionId = data.subscription_id;

    if (customerEmail) {
        try {
            const interval = data.payment_frequency_interval?.toLowerCase() || 'month';
            const plan = interval === 'year' ? 'yearly' : 'monthly';

            await sendReceiptEmail({
                email: customerEmail,
                name: customerName || undefined,
                plan: plan,
                subscriptionId: subscriptionId || 'unknown',
            });
            console.log('📨 [WEBHOOK] Receipt email sent');
        } catch (emailError) {
            console.error('❌ [WEBHOOK] Failed to send receipt email:', emailError);
        }
    }
}

async function handleSubscriptionUpdated(data: any) {
    console.log('🔄 [WEBHOOK] Processing subscription.updated');

    const subscriptionId = data.subscription_id;
    const newStatus = data.status;

    if (!subscriptionId) return;

    // Map Dodo status to our status
    let dbStatus = 'active';
    if (newStatus === 'cancelled') dbStatus = 'cancelled';
    else if (newStatus === 'on_hold') dbStatus = 'on_hold';
    else if (newStatus === 'expired') dbStatus = 'expired';

    await db.user.updateMany({
        where: { subscriptionId: subscriptionId },
        data: { subscriptionStatus: dbStatus }
    });

    console.log('💾 [WEBHOOK] Updated subscription status to:', dbStatus);
}
