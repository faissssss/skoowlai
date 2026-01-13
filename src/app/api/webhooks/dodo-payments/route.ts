import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { db } from '@/lib/db';
import { sendWelcomeEmail, sendReceiptEmail, sendCancellationEmail } from '@/lib/email';
import { logStateTransition } from '@/lib/subscriptionState';
import { SubscriptionStatus } from '@/lib/subscription';

/**
 * Dodo Payments Webhook Handler
 * Handles all subscription lifecycle events from Dodo Payments
 * Webhook URL: https://skoowlai.com/api/webhooks/dodo-payments
 */
export async function POST(req: Request) {
    try {
        // 1. Get webhook secret
        const webhookSecret = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
        if (!webhookSecret) {
            console.error('❌ DODO_PAYMENTS_WEBHOOK_KEY is not configured');
            return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
        }

        // 2. Get headers and body
        const headerPayload = await headers();
        const svixId = headerPayload.get('svix-id');
        const svixTimestamp = headerPayload.get('svix-timestamp');
        const svixSignature = headerPayload.get('svix-signature');

        if (!svixId || !svixTimestamp || !svixSignature) {
            console.error('❌ Missing Svix headers');
            return NextResponse.json({ error: 'Missing webhook headers' }, { status: 400 });
        }

        const payload = await req.text();

        // 3. Verify webhook signature
        const wh = new Webhook(webhookSecret);
        let event: any;

        try {
            event = wh.verify(payload, {
                'svix-id': svixId,
                'svix-timestamp': svixTimestamp,
                'svix-signature': svixSignature,
            });
        } catch (err) {
            console.error('❌ Webhook signature verification failed:', err);
            return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
        }

        // 4. Process event
        const eventType = event.type;
        const data = event.data;

        console.log(`📨 Dodo Payments Webhook: ${eventType}`);
        console.log('Data:', JSON.stringify(data, null, 2));

        // Handle different event types
        switch (eventType) {
            case 'subscription.created':
            case 'subscription.trial_started':
                await handleSubscriptionCreated(data);
                break;

            case 'subscription.activated':
            case 'payment.succeeded':
                await handlePaymentSucceeded(data);
                break;

            case 'subscription.cancelled':
                await handleSubscriptionCancelled(data);
                break;

            case 'subscription.trial_ended':
                await handleTrialEnded(data);
                break;

            case 'subscription.expired':
                await handleSubscriptionExpired(data);
                break;

            case 'subscription.updated':
                await handleSubscriptionUpdated(data);
                break;

            case 'payment.failed':
                await handlePaymentFailed(data);
                break;

            default:
                console.log(`⚠️ Unhandled event type: ${eventType}`);
        }

        return NextResponse.json({ received: true, eventType });

    } catch (error) {
        console.error('❌ Webhook processing error:', error);
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
}

/**
 * Handle subscription created / trial started
 */
async function handleSubscriptionCreated(data: any) {
    const customerEmail = data.customer?.email || data.customer_email;
    const subscriptionId = data.subscription?.id || data.id;
    const customerId = data.customer?.id || data.customer_id;

    if (!customerEmail) {
        console.error('❌ No customer email in subscription.created event');
        return;
    }

    // Find user by email
    const user = await db.user.findFirst({
        where: { email: customerEmail }
    });

    if (!user) {
        console.warn(`⚠️ User not found for email: ${customerEmail}`);
        return;
    }

    // Determine plan from subscription data
    const plan = data.subscription?.plan?.interval === 'year' ? 'yearly' : 'monthly';

    // Calculate trial end date (usually 7 days)
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7);

    // Log state transition
    await logStateTransition(
        user.id,
        user.subscriptionStatus as SubscriptionStatus,
        'trialing',
        subscriptionId,
        'dodo',
        { event: 'subscription.created', plan }
    );

    // Update user with trial status
    await db.user.update({
        where: { id: user.id },
        data: {
            subscriptionStatus: 'trialing',
            subscriptionPlan: plan,
            subscriptionId: subscriptionId,
            customerId: customerId,
            subscriptionEndsAt: trialEndDate,
        }
    });

    // Send welcome email
    await sendWelcomeEmail({
        email: customerEmail,
        name: undefined,
        plan: plan as 'monthly' | 'yearly',
        subscriptionId: subscriptionId
    });

    console.log(`✅ Trial started for user ${user.id}, ends at ${trialEndDate.toISOString()}`);
}

/**
 * Handle payment succeeded (first payment after trial or recurring)
 */
async function handlePaymentSucceeded(data: any) {
    const subscriptionId = data.subscription?.id || data.subscription_id;
    const customerEmail = data.customer?.email || data.customer_email;

    if (!subscriptionId && !customerEmail) {
        console.error('❌ No subscription ID or email in payment.succeeded event');
        return;
    }

    // Find user by subscription ID or email
    const user = await db.user.findFirst({
        where: subscriptionId 
            ? { subscriptionId: subscriptionId }
            : { email: customerEmail }
    });

    if (!user) {
        console.warn(`⚠️ User not found for subscription: ${subscriptionId || customerEmail}`);
        return;
    }

    // Prevent reactivation if user cancelled
    if (user.subscriptionStatus === 'cancelled') {
        console.log(`⚠️ Skipping payment activation for ${user.id} - user has cancelled`);
        await logStateTransition(
            user.id,
            'cancelled',
            'active',
            subscriptionId,
            'dodo',
            { event: 'payment.succeeded', blocked: true, reason: 'User already cancelled' }
        );
        return;
    }

    const plan = user.subscriptionPlan || 'monthly';

    // Calculate next billing date
    const nextBillingDate = new Date();
    if (plan === 'yearly') {
        nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    } else {
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    }

    // Log state transition
    await logStateTransition(
        user.id,
        user.subscriptionStatus as SubscriptionStatus,
        'active',
        subscriptionId,
        'dodo',
        { event: 'payment.succeeded', plan }
    );

    // Update user to active
    await db.user.update({
        where: { id: user.id },
        data: {
            subscriptionStatus: 'active',
            subscriptionEndsAt: nextBillingDate,
        }
    });

    // Send receipt email
    if (user.email) {
        await sendReceiptEmail({
            email: user.email,
            name: undefined,
            plan: plan as 'monthly' | 'yearly',
            subscriptionId: subscriptionId
        });
    }

    console.log(`✅ Payment succeeded for user ${user.id}, active until ${nextBillingDate.toISOString()}`);
}

/**
 * Handle subscription cancelled
 */
async function handleSubscriptionCancelled(data: any) {
    const subscriptionId = data.subscription?.id || data.id;

    if (!subscriptionId) {
        console.error('❌ No subscription ID in cancelled event');
        return;
    }

    const user = await db.user.findFirst({
        where: { subscriptionId: subscriptionId }
    });

    if (!user) {
        console.warn(`⚠️ User not found for subscription: ${subscriptionId}`);
        return;
    }

    // Log state transition
    await logStateTransition(
        user.id,
        user.subscriptionStatus as SubscriptionStatus,
        'cancelled',
        subscriptionId,
        'dodo',
        { event: 'subscription.cancelled' }
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
}

/**
 * Handle trial ended without payment
 */
async function handleTrialEnded(data: any) {
    const subscriptionId = data.subscription?.id || data.id;

    if (!subscriptionId) {
        console.error('❌ No subscription ID in trial_ended event');
        return;
    }

    const user = await db.user.findFirst({
        where: { subscriptionId: subscriptionId }
    });

    if (!user) {
        console.warn(`⚠️ User not found for subscription: ${subscriptionId}`);
        return;
    }

    // Log state transition
    await logStateTransition(
        user.id,
        user.subscriptionStatus as SubscriptionStatus,
        'expired',
        subscriptionId,
        'dodo',
        { event: 'subscription.trial_ended' }
    );

    // Set to expired
    await db.user.update({
        where: { id: user.id },
        data: {
            subscriptionStatus: 'expired',
            subscriptionEndsAt: new Date(),
        }
    });

    console.log(`✅ Trial ended for user ${user.id}, no payment received`);
}

/**
 * Handle subscription expired
 */
async function handleSubscriptionExpired(data: any) {
    const subscriptionId = data.subscription?.id || data.id;

    if (!subscriptionId) {
        console.error('❌ No subscription ID in expired event');
        return;
    }

    const user = await db.user.findFirst({
        where: { subscriptionId: subscriptionId }
    });

    if (!user) {
        console.warn(`⚠️ User not found for subscription: ${subscriptionId}`);
        return;
    }

    // Log state transition
    await logStateTransition(
        user.id,
        user.subscriptionStatus as SubscriptionStatus,
        'expired',
        subscriptionId,
        'dodo',
        { event: 'subscription.expired' }
    );

    // Set to expired
    await db.user.update({
        where: { id: user.id },
        data: {
            subscriptionStatus: 'expired',
            subscriptionEndsAt: new Date(),
        }
    });

    console.log(`✅ Subscription expired for user ${user.id}`);
}

/**
 * Handle subscription updated (plan change, etc)
 */
async function handleSubscriptionUpdated(data: any) {
    const subscriptionId = data.subscription?.id || data.id;

    if (!subscriptionId) {
        console.error('❌ No subscription ID in updated event');
        return;
    }

    const user = await db.user.findFirst({
        where: { subscriptionId: subscriptionId }
    });

    if (!user) {
        console.warn(`⚠️ User not found for subscription: ${subscriptionId}`);
        return;
    }

    const newPlan = data.subscription?.plan?.interval === 'year' ? 'yearly' : 'monthly';

    // Log state transition
    await logStateTransition(
        user.id,
        user.subscriptionStatus as SubscriptionStatus,
        user.subscriptionStatus as SubscriptionStatus,
        subscriptionId,
        'dodo',
        { event: 'subscription.updated', newPlan }
    );

    // Update plan if changed
    if (newPlan !== user.subscriptionPlan) {
        await db.user.update({
            where: { id: user.id },
            data: {
                subscriptionPlan: newPlan,
            }
        });
        console.log(`✅ Updated plan for user ${user.id} to ${newPlan}`);
    }
}

/**
 * Handle payment failed
 */
async function handlePaymentFailed(data: any) {
    const subscriptionId = data.subscription?.id || data.subscription_id;

    if (!subscriptionId) {
        console.error('❌ No subscription ID in payment.failed event');
        return;
    }

    const user = await db.user.findFirst({
        where: { subscriptionId: subscriptionId }
    });

    if (!user) {
        console.warn(`⚠️ User not found for subscription: ${subscriptionId}`);
        return;
    }

    // Log the failed payment
    await logStateTransition(
        user.id,
        user.subscriptionStatus as SubscriptionStatus,
        user.subscriptionStatus as SubscriptionStatus,
        subscriptionId,
        'dodo',
        { event: 'payment.failed', reason: data.reason }
    );

    console.log(`⚠️ Payment failed for user ${user.id}`);
    // Note: Dodo Payments will retry automatically
}

/**
 * Handle GET requests for health check
 */
export async function GET() {
    return NextResponse.json({ 
        status: 'active', 
        message: 'Dodo Payments Webhook Listener is running',
        webhook_url: 'https://skoowlai.com/api/webhooks/dodo-payments'
    });
}
