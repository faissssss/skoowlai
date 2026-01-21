import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { db } from '@/lib/db';
import { sendWelcomeEmail, sendReceiptEmail, sendCancellationEmail, sendRenewalEmail, sendPaymentFailedEmail, sendTrialWelcomeEmail, sendPlanChangeEmail, sendOnHoldEmail, sendExpirationEmail } from '@/lib/email';
import { sendEmailWithIdempotency, generateEmailIdempotencyKey } from '@/lib/emailIdempotency';
import { logStateTransition } from '@/lib/subscriptionState';
import { SubscriptionStatus } from '@/lib/subscription';
import { DISABLE_PAYMENTS } from '@/lib/config';
import { dodoClient } from '@/lib/dodo';

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
                await handleSubscriptionCreated(data, webhookId);
                break;

            case 'subscription.active':  // Dodo uses 'subscription.active'
            case 'subscription.activated':  // Fallback
            case 'payment.succeeded':
                await handlePaymentSucceeded(data, webhookId);
                break;

            case 'subscription.renewed':
                await handleSubscriptionRenewed(data, webhookId);
                break;

            case 'subscription.cancelled':
            case 'subscription.canceled':  // Handle both spellings
                await handleSubscriptionCancelled(data, webhookId);
                break;

            case 'subscription.on_hold':
            case 'subscription.paused':
                await handleSubscriptionOnHold(data, webhookId);
                break;

            case 'subscription.trial_ended':
                await handleTrialEnded(data, webhookId);
                break;

            case 'subscription.expired':
                await handleSubscriptionExpired(data, webhookId);
                break;

            case 'subscription.updated':
            case 'subscription.plan_changed':
                await handleSubscriptionUpdated(data, webhookId);
                break;

            case 'payment.failed':
                await handlePaymentFailed(data, webhookId);
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
async function handleSubscriptionCreated(data: any, webhookId: string) {
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

    // Calculate trial end date (prefer payload next_billing_date -> trial end)
    const trialDays = typeof data.trial_period_days === 'number' ? data.trial_period_days : 7;
    let trialEndDate: Date;
    if (data.next_billing_date) {
        trialEndDate = new Date(data.next_billing_date);
    } else {
        trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + trialDays);
    }

    // Log state transition
    await logStateTransition(
        user.id,
        user.subscriptionStatus as SubscriptionStatus,
        'trialing',
        subscriptionId,
        'dodo',
        { event: 'subscription.created', plan, trialDays }
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
            ...(user.trialUsedAt ? {} : { trialUsedAt: new Date() }),
        }
    });

    // Send trial welcome email (idempotent per webhook)
    await sendEmailWithIdempotency(
        generateEmailIdempotencyKey('welcome', webhookId),
        'welcome',
        customerEmail,
        () =>
            sendTrialWelcomeEmail({
                email: customerEmail,
                name: undefined,
                trialDays,
                trialEndsAt: trialEndDate.toISOString(),
            })
    );

    console.log(`✅ Trial started for user ${user.id}, ends at ${trialEndDate.toISOString()}`);
}

/**
 * Handle payment succeeded (first payment after trial, recurring, or resubscription)
 */
async function handlePaymentSucceeded(data: any, webhookId: string) {
    // Dodo payload: subscription_id at root level, customer.email, customer.customer_id
    const subscriptionId = data.subscription_id || data.subscription?.id || data.id;
    const customerEmail = data.customer?.email || data.customer_email;
    const customerId = data.customer?.customer_id || data.customer?.id || data.customer_id;

    if (!subscriptionId && !customerEmail) {
        console.error('❌ No subscription ID or email in payment.succeeded event');
        console.log('Available data keys:', Object.keys(data));
        return;
    }

    // Find user by subscription ID first, then by customerId, then by email (resubscription case)
    let user = await db.user.findFirst({
        where: subscriptionId ? { subscriptionId: subscriptionId } : undefined
    });

    // Fallback: find by customerId if provided
    if (!user && customerId) {
        user = await db.user.findFirst({
            where: { customerId: customerId }
        });
    }

    // Fallback: find by email
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

    // Determine plan robustly using payload → API fallback
    const plan = await inferPlanFromPayloadOrApi(
        data,
        subscriptionId,
        (user.subscriptionPlan as 'monthly' | 'yearly' | null) || 'monthly'
    );

    // Determine next billing date (prefer payload next_billing_date)
    let nextBillingDate: Date;
    if (data.next_billing_date) {
        nextBillingDate = new Date(data.next_billing_date);
    } else {
        nextBillingDate = new Date();
        if (plan === 'yearly') {
            nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
        } else {
            nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        }
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

    // Send emails (idempotent per webhook)
    if (user.email) {
        if (isNewSubscription || isResubscription) {
            await sendEmailWithIdempotency(
                generateEmailIdempotencyKey('welcome', webhookId),
                'welcome',
                user.email,
                () =>
                    sendWelcomeEmail({
                        email: user.email!,
                        name: undefined,
                        plan: plan as 'monthly' | 'yearly',
                        subscriptionId
                    })
            );
        }

        await sendEmailWithIdempotency(
            generateEmailIdempotencyKey('receipt', webhookId),
            'receipt',
            user.email,
            () =>
                sendReceiptEmail({
                    email: user.email!,
                    name: undefined,
                    plan: plan as 'monthly' | 'yearly',
                    subscriptionId
                })
        );
    }

    console.log(`✅ Payment succeeded for user ${user.id}${isResubscription ? ' (resubscription)' : wasActive ? ' (renewal)' : ' (new)'}, active until ${nextBillingDate.toISOString()}`);
}

/**
 * Handle subscription cancelled
 */
async function handleSubscriptionCancelled(data: any, webhookId: string) {
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
            }
        });
        console.log(`✅ Subscription cancelled for user ${user.id}, access until ${user.subscriptionEndsAt?.toISOString()}`);
    }

    // Send cancellation email (idempotent per webhook)
    if (user.email && user.subscriptionPlan && user.subscriptionEndsAt) {
        await sendEmailWithIdempotency(
            generateEmailIdempotencyKey('cancellation', webhookId),
            'cancellation',
            user.email,
            () =>
                sendCancellationEmail({
                    email: user.email!,
                    name: undefined,
                    plan: user.subscriptionPlan as 'monthly' | 'yearly',
                    accessEndsAt: user.subscriptionEndsAt!
                })
        );
    }
}

/**
 * Handle trial ended without payment
 */
async function handleTrialEnded(data: any, _webhookId: string) {
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
async function handleSubscriptionExpired(data: any, _webhookId: string) {
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

    if (user.email) {
        await sendEmailWithIdempotency(
            generateEmailIdempotencyKey('expired', _webhookId),
            'expired',
            user.email,
            () =>
                sendExpirationEmail({
                    email: user.email!,
                    name: undefined,
                    endedAt: new Date(),
                })
        );
    }
    console.log(`✅ Subscription expired for user ${user.id}`);
}

/**
 * Handle subscription updated (plan change, etc)
 */
async function handleSubscriptionUpdated(data: any, webhookId: string) {
    // Dodo payload: subscription_id at root level
    const subscriptionId = data.subscription_id || data.subscription?.id || data.id;
    const customerEmail = data.customer?.email || data.customer_email;
    const customerId = data.customer?.customer_id || data.customer?.id || data.customer_id;

    if (!subscriptionId) {
        console.error('❌ No subscription ID in updated event');
        console.log('Available data keys:', Object.keys(data));
        return;
    }

    // Find user by subscription ID, or by customerId/email if new subscription
    let user = await db.user.findFirst({
        where: { subscriptionId: subscriptionId }
    });

    if (!user && customerId) {
        user = await db.user.findFirst({
            where: { customerId: customerId }
        });
    }

    if (!user && customerEmail) {
        user = await db.user.findFirst({
            where: { email: customerEmail }
        });
    }

    if (!user) {
        console.warn(`⚠️ User not found for subscription: ${subscriptionId}`);
        return;
    }

    // Determine plan robustly using payload → API fallback
    const newPlan = await inferPlanFromPayloadOrApi(
        data,
        subscriptionId,
        user.subscriptionPlan as 'monthly' | 'yearly' | null
    );

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

        // Notify user (idempotent per webhook)
        if (user.email) {
            const nextBillingDate = data.next_billing_date ? new Date(data.next_billing_date) : (user.subscriptionEndsAt || new Date());
            await sendEmailWithIdempotency(
                generateEmailIdempotencyKey('plan_change', webhookId),
                'plan_change',
                user.email,
                () =>
                    sendPlanChangeEmail({
                        email: user.email!,
                        name: undefined,
                        newPlan,
                        nextBillingDate
                    })
            );
        }
    }
}

/**
 * Handle payment failed
 */
async function handlePaymentFailed(data: any, webhookId: string) {
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

    // Notify user (idempotent per webhook)
    if (user.email && user.subscriptionPlan) {
        await sendEmailWithIdempotency(
            generateEmailIdempotencyKey('payment_failed', webhookId),
            'payment_failed',
            user.email,
            () =>
                sendPaymentFailedEmail({
                    email: user.email!,
                    name: undefined,
                    plan: user.subscriptionPlan as 'monthly' | 'yearly',
                    reason: data.reason
                })
        );
    }

    console.log(`⚠️ Payment failed for user ${user.id}`);
    // Note: Dodo Payments will retry automatically
}

/**
 * Handle subscription renewed (end-of-period success)
 */
async function handleSubscriptionRenewed(data: any, webhookId: string) {
    const subscriptionId = data.subscription_id || data.subscription?.id || data.id;
    if (!subscriptionId) {
        console.error('❌ No subscription ID in renewed event');
        return;
    }

    const user = await db.user.findFirst({ where: { subscriptionId } });
    if (!user) {
        console.warn(`⚠️ User not found for subscription: ${subscriptionId}`);
        return;
    }

    const interval = data.payment_frequency_interval || data.subscription_period_interval || data.subscription?.plan?.interval;
    const plan = interval?.toLowerCase() === 'year' ? 'yearly' : 'monthly';

    // Prefer next_billing_date from payload
    let nextBillingDate: Date;
    if (data.next_billing_date) nextBillingDate = new Date(data.next_billing_date);
    else {
        nextBillingDate = new Date();
        if (plan === 'yearly') nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
        else nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    }

    await logStateTransition(
        user.id,
        user.subscriptionStatus as SubscriptionStatus,
        'active',
        subscriptionId,
        'dodo',
        { event: 'subscription.renewed', plan }
    );

    await db.user.update({
        where: { id: user.id },
        data: {
            subscriptionStatus: 'active',
            subscriptionPlan: plan,
            subscriptionEndsAt: nextBillingDate,
        }
    });

    if (user.email) {
        await sendEmailWithIdempotency(
            generateEmailIdempotencyKey('renewal', webhookId),
            'renewal',
            user.email,
            () =>
                sendRenewalEmail({
                    email: user.email!,
                    name: undefined,
                    plan: plan as 'monthly' | 'yearly',
                    nextRenewalDate: nextBillingDate
                })
        );
    }

    console.log(`✅ Subscription renewed for user ${user.id}, next billing: ${nextBillingDate.toISOString()}`);
}

/**
 * Handle subscription on hold (payment method/update required)
 */
async function handleSubscriptionOnHold(data: any, _webhookId: string) {
    const subscriptionId = data.subscription_id || data.subscription?.id || data.id;
    if (!subscriptionId) {
        console.error('❌ No subscription ID in on_hold event');
        return;
    }

    const user = await db.user.findFirst({ where: { subscriptionId } });
    if (!user) {
        console.warn(`⚠️ User not found for subscription: ${subscriptionId}`);
        return;
    }

    await logStateTransition(
        user.id,
        user.subscriptionStatus as SubscriptionStatus,
        'on_hold',
        subscriptionId,
        'dodo',
        { event: 'subscription.on_hold' }
    );

    await db.user.update({
        where: { id: user.id },
        data: {
            subscriptionStatus: 'on_hold',
            // Preserve subscriptionEndsAt; access limited by UI rules
        }
    });

    if (user.email && user.subscriptionPlan) {
        await sendEmailWithIdempotency(
            generateEmailIdempotencyKey('on_hold', _webhookId),
            'on_hold',
            user.email,
            () =>
                sendOnHoldEmail({
                    email: user.email!,
                    name: undefined,
                    plan: user.subscriptionPlan as 'monthly' | 'yearly',
                    reason: data?.reason
                })
        );
    }
    console.log(`⚠️ Subscription on hold for user ${user.id}`);
}

/**
 * Handle GET requests for health check
 */
/**
 * Infer plan ('monthly' | 'yearly') from webhook payload with API fallback.
 */
async function inferPlanFromPayloadOrApi(
    data: any,
    subscriptionId: string,
    fallback?: 'monthly' | 'yearly' | null
): Promise<'monthly' | 'yearly'> {
    const norm = (v: any): string | null => (typeof v === 'string' ? v.toLowerCase() : (typeof v === 'number' ? String(v) : null));
    const num = (v: any): number | null => {
        const n = typeof v === 'number' ? v : (typeof v === 'string' ? parseInt(v, 10) : NaN);
        return Number.isFinite(n) ? n : null;
    };
    const mapToPlan = (interval: string | null): 'monthly' | 'yearly' | null => {
        if (!interval) return null;
        if (/(year|annual|annually|yr)/.test(interval)) return 'yearly';
        if (/(month|mo)/.test(interval)) return 'monthly';
        return null;
    };
    const planFromIntervalAndCount = (interval: string | null, count: number | null): 'monthly' | 'yearly' | null => {
        const base = mapToPlan(interval);
        if (base === 'yearly') return 'yearly';
        if (base === 'monthly') {
            // Treat 12-month cycles as yearly plans configured as monthly x 12
            if (count !== null && count >= 12) return 'yearly';
            return 'monthly';
        }
        return null;
    };

    // Preferred: map by product_id when available (trial periods make date heuristics unreliable)
    const monthlyIds = [
        process.env.NEXT_PUBLIC_DODO_STUDENT_MONTHLY_PRODUCT_ID,
        process.env.NEXT_PUBLIC_DODO_MONTHLY_PRODUCT_ID,
    ].filter(Boolean) as string[];
    const yearlyIds = [
        process.env.NEXT_PUBLIC_DODO_STUDENT_YEARLY_PRODUCT_ID,
        process.env.NEXT_PUBLIC_DODO_YEARLY_PRODUCT_ID,
    ].filter(Boolean) as string[];

    const pidPayload =
        data?.product_id ||
        data?.subscription?.product_id ||
        data?.productId ||
        data?.subscription?.productId ||
        null;

    if (pidPayload) {
        if (yearlyIds.includes(String(pidPayload))) return 'yearly';
        if (monthlyIds.includes(String(pidPayload))) return 'monthly';
    }

    // 1) Try payload interval + count
    const intervalCandidates = [
        norm(data?.payment_frequency_interval),
        norm(data?.subscription_period_interval),
        norm(data?.subscription?.plan?.interval),
        norm(data?.subscription?.planInterval),
        norm(data?.plan?.interval),
    ];
    const countCandidates = [
        num(data?.payment_frequency_count),
        num(data?.subscription_period_count),
        num(data?.subscription?.plan?.count),
        num(data?.plan?.count),
    ];
    for (const interval of intervalCandidates) {
        for (const count of [countCandidates[0], countCandidates[1], countCandidates[2], countCandidates[3], null]) {
            const p = planFromIntervalAndCount(interval, count);
            if (p) return p;
        }
    }

    // 2) Dates heuristic (may be trial length, so only use as weak signal)
    try {
        const next = data?.next_billing_date ? new Date(data.next_billing_date) : null;
        const prev = data?.previous_billing_date ? new Date(data.previous_billing_date) : null;
        if (next && prev) {
            const days = (next.getTime() - prev.getTime()) / 86400000;
            if (days > 300) return 'yearly';
            if (days <= 60) return 'monthly';
        }
    } catch {
        // ignore
    }

    // 3) Fallback to API retrieve (prefer product_id first, then interval/dates)
    try {
        const sub: any = await dodoClient.subscriptions?.retrieve?.(subscriptionId);
        const pid = sub?.product_id;
        if (pid) {
            if (yearlyIds.includes(String(pid))) return 'yearly';
            if (monthlyIds.includes(String(pid))) return 'monthly';
        }

        const intervalApi =
            norm(sub?.payment_frequency_interval) ||
            norm(sub?.subscription_period_interval) ||
            norm(sub?.plan?.interval);
        const countApi =
            num(sub?.payment_frequency_count) ||
            num(sub?.subscription_period_count) ||
            num(sub?.plan?.count) ||
            null;

        const planApi = planFromIntervalAndCount(intervalApi, countApi);
        if (planApi) return planApi;

        const next2 = sub?.next_billing_date ? new Date(sub.next_billing_date) : null;
        const prev2 = sub?.previous_billing_date ? new Date(sub.previous_billing_date) : null;
        if (next2 && prev2) {
            const days2 = (next2.getTime() - prev2.getTime()) / 86400000;
            if (days2 > 300) return 'yearly';
            if (days2 <= 60) return 'monthly';
        }
    } catch (e) {
        console.warn('[Webhook] inferPlanFromPayloadOrApi: retrieve failed', e);
    }

    return (fallback as 'monthly' | 'yearly') || 'monthly';
}

export async function GET() {
    return NextResponse.json({
        status: 'active',
        message: 'Dodo Payments Webhook Listener is running',
        webhook_url: 'https://skoowlai.com/api/webhooks/dodo-payments'
    });
}
