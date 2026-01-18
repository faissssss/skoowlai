import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { db } from '@/lib/db';
import { sendWelcomeEmail, sendReceiptEmail, sendCancellationEmail } from '@/lib/email';
import { logStateTransition } from '@/lib/subscriptionState';
import { SubscriptionStatus } from '@/lib/subscription';
import { DISABLE_PAYMENTS } from '@/lib/config';

/**
 * Dodo Payments Webhook Handler
 * Handles all subscription lifecycle events from Dodo Payments
 * Webhook URL: https://skoowlai.com/api/webhooks/dodo-payments
 * 
 * NOTE: Currently disabled while migrating to Clerk Billing
 */
export async function POST(req: Request) {
    // TEMPORARILY DISABLED - Migrating to Clerk Billing
    if (DISABLE_PAYMENTS) {
        console.log('⚠️ Dodo webhook received but payments are disabled');
        return NextResponse.json({ message: 'Payments temporarily disabled' }, { status: 200 });
    }

    try {
        // 1. Get webhook secret
        const webhookSecret = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
        if (!webhookSecret) {
            console.error('❌ DODO_PAYMENTS_WEBHOOK_KEY is not configured');
            return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
        }

        // 2. Get headers and body
        // Dodo sends webhook-* headers, but Svix library expects svix-* format
        const headerPayload = await headers();

        // Accept both webhook-* (Dodo's current format) and svix-* (legacy format)
        const webhookId = headerPayload.get('webhook-id') || headerPayload.get('svix-id');
        const webhookTimestamp = headerPayload.get('webhook-timestamp') || headerPayload.get('svix-timestamp');
        const webhookSignature = headerPayload.get('webhook-signature') || headerPayload.get('svix-signature');

        if (!webhookId || !webhookTimestamp || !webhookSignature) {
            console.error('❌ Missing webhook headers');
            console.log('Available headers:', Array.from(headerPayload.keys()));
            return NextResponse.json({ error: 'Missing webhook headers' }, { status: 400 });
        }

        const payload = await req.text();

        // 3. Verify webhook signature using Svix library
        // The Svix library expects the headers in svix-* format
        const wh = new Webhook(webhookSecret);
        let event: any;

        try {
            event = wh.verify(payload, {
                'svix-id': webhookId,
                'svix-timestamp': webhookTimestamp,
                'svix-signature': webhookSignature,
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
        // Note: Dodo Payments uses 'subscription.active' NOT 'subscription.activated'
        switch (eventType) {
            case 'subscription.created':
            case 'subscription.pending':
            case 'subscription.trial_started':
                await handleSubscriptionCreated(data);
                break;

            case 'subscription.active':  // Dodo uses 'subscription.active'
            case 'subscription.activated':  // Fallback
            case 'payment.succeeded':
                await handlePaymentSucceeded(data);
                break;

            case 'subscription.cancelled':
            case 'subscription.canceled':  // Handle both spellings
                await handleSubscriptionCancelled(data);
                break;

            case 'subscription.trial_ended':
            case 'subscription.on_hold':
            case 'subscription.paused':
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
            // Don't fail for unhandled events
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
    // Dodo payload structure: data.customer.email, data.subscription_id, data.customer.customer_id
    const customerEmail = data.customer?.email || data.customer_email;
    const subscriptionId = data.subscription_id || data.subscription?.id || data.id;
    const customerId = data.customer?.customer_id || data.customer?.id || data.customer_id;

    if (!customerEmail) {
        console.error('❌ No customer email in subscription.created event');
        console.log('Available data keys:', Object.keys(data));
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

    // Determine plan from Dodo's payment_frequency_interval (Month/Year)
    const interval = data.payment_frequency_interval || data.subscription_period_interval || data.subscription?.plan?.interval;
    const plan = interval?.toLowerCase() === 'year' ? 'yearly' : 'monthly';

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
    // Only set trialUsedAt if not already set (preserves first trial date)
    await db.user.update({
        where: { id: user.id },
        data: {
            subscriptionStatus: 'trialing',
            subscriptionPlan: plan,
            subscriptionId: subscriptionId,
            customerId: customerId,
            subscriptionEndsAt: trialEndDate,
            // Track trial usage - only set once to prevent re-trial abuse
            ...(user.trialUsedAt ? {} : { trialUsedAt: new Date() }),
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
 * Handle payment succeeded (first payment after trial, recurring, or resubscription)
 */
async function handlePaymentSucceeded(data: any) {
    // Dodo payload: subscription_id at root level, customer.email, customer.customer_id
    const subscriptionId = data.subscription_id || data.subscription?.id || data.id;
    const customerEmail = data.customer?.email || data.customer_email;
    const customerId = data.customer?.customer_id || data.customer?.id || data.customer_id;

    if (!subscriptionId && !customerEmail) {
        console.error('❌ No subscription ID or email in payment.succeeded event');
        console.log('Available data keys:', Object.keys(data));
        return;
    }

    // Find user by subscription ID first, then by email (for resubscribers with new subscription ID)
    let user = await db.user.findFirst({
        where: subscriptionId ? { subscriptionId: subscriptionId } : undefined
    });

    // If not found by subscription ID, try by email (resubscription case)
    if (!user && customerEmail) {
        user = await db.user.findFirst({
            where: { email: customerEmail }
        });
    }

    if (!user) {
        console.warn(`⚠️ User not found for subscription: ${subscriptionId || customerEmail}`);
        return;
    }

    // Determine if this is a new subscription (first payment or resubscription)
    // vs a renewal (same subscription ID, already active)
    const isNewSubscription = user.subscriptionId !== subscriptionId;
    const isResubscription = isNewSubscription && (user.subscriptionStatus === 'cancelled' || user.subscriptionStatus === 'expired' || user.subscriptionStatus === 'free');
    const wasActive = user.subscriptionStatus === 'active';

    // Get plan from Dodo's payment_frequency_interval (Month/Year), or fallback
    const interval = data.payment_frequency_interval || data.subscription_period_interval || data.subscription?.plan?.interval;
    const plan = interval?.toLowerCase() === 'year' ? 'yearly'
        : interval?.toLowerCase() === 'month' ? 'monthly'
            : user.subscriptionPlan || 'monthly';

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
        { event: 'payment.succeeded', plan, isResubscription, isNewSubscription }
    );

    // Update user to active with new subscription details
    await db.user.update({
        where: { id: user.id },
        data: {
            subscriptionStatus: 'active',
            subscriptionEndsAt: nextBillingDate,
            subscriptionId: subscriptionId,
            subscriptionPlan: plan,
            customerId: customerId || user.customerId,
        }
    });

    // Send emails
    if (user.email) {
        // Send welcome email for new subscriptions and resubscriptions
        if (isNewSubscription || isResubscription) {
            await sendWelcomeEmail({
                email: user.email,
                name: undefined,
                plan: plan as 'monthly' | 'yearly',
                subscriptionId: subscriptionId
            });
        }

        // Always send receipt email for payments
        await sendReceiptEmail({
            email: user.email,
            name: undefined,
            plan: plan as 'monthly' | 'yearly',
            subscriptionId: subscriptionId
        });
    }

    console.log(`✅ Payment succeeded for user ${user.id}${isResubscription ? ' (resubscription)' : wasActive ? ' (renewal)' : ' (new)'}, active until ${nextBillingDate.toISOString()}`);
}

/**
 * Handle subscription cancelled
 */
async function handleSubscriptionCancelled(data: any) {
    // Dodo payload: subscription_id at root level
    const subscriptionId = data.subscription_id || data.subscription?.id || data.id;

    if (!subscriptionId) {
        console.error('❌ No subscription ID in cancelled event');
        console.log('Available data keys:', Object.keys(data));
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
    // Dodo payload: subscription_id at root level
    const subscriptionId = data.subscription_id || data.subscription?.id || data.id;

    if (!subscriptionId) {
        console.error('❌ No subscription ID in trial_ended event');
        console.log('Available data keys:', Object.keys(data));
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
    // Dodo payload: subscription_id at root level
    const subscriptionId = data.subscription_id || data.subscription?.id || data.id;

    if (!subscriptionId) {
        console.error('❌ No subscription ID in expired event');
        console.log('Available data keys:', Object.keys(data));
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
    // Dodo payload: subscription_id at root level
    const subscriptionId = data.subscription_id || data.subscription?.id || data.id;
    const customerEmail = data.customer?.email || data.customer_email;

    if (!subscriptionId) {
        console.error('❌ No subscription ID in updated event');
        console.log('Available data keys:', Object.keys(data));
        return;
    }

    // Find user by subscription ID, or by email if new subscription
    let user = await db.user.findFirst({
        where: { subscriptionId: subscriptionId }
    });

    if (!user && customerEmail) {
        user = await db.user.findFirst({
            where: { email: customerEmail }
        });
    }

    if (!user) {
        console.warn(`⚠️ User not found for subscription: ${subscriptionId}`);
        return;
    }

    // Get plan from Dodo's payment_frequency_interval
    const interval = data.payment_frequency_interval || data.subscription_period_interval || data.subscription?.plan?.interval;
    const newPlan = interval?.toLowerCase() === 'year' ? 'yearly' : 'monthly';

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
    // Dodo payload: subscription_id at root level
    const subscriptionId = data.subscription_id || data.subscription?.id || data.id;

    if (!subscriptionId) {
        console.error('❌ No subscription ID in payment.failed event');
        console.log('Available data keys:', Object.keys(data));
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
