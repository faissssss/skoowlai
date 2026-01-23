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
        // 1. Get webhook secret (support multiple env var names)
        const webhookSecret =
            process.env.DODO_PAYMENTS_WEBHOOK_KEY ||
            process.env.DODO_PAYMENTS_WEBHOOK_SECRET ||
            process.env.DODO_WEBHOOK_SECRET;

        if (!webhookSecret) {
            console.error('❌ Dodo webhook secret not configured. Expected one of DODO_PAYMENTS_WEBHOOK_KEY, DODO_PAYMENTS_WEBHOOK_SECRET, DODO_WEBHOOK_SECRET');
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
                await handleSubscriptionActivated(data, webhookId);
                break;

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

    // Find user by email → fallback by clerkId metadata → fallback by customer_id
    let user = await db.user.findFirst({
        where: { email: customerEmail }
    });

    if (!user && data?.metadata?.clerkId) {
        user = await db.user.findFirst({
            where: { clerkId: data.metadata.clerkId }
        });
    }

    if (!user && customerId) {
        user = await db.user.findFirst({
            where: { customerId: customerId }
        });
    }

    if (!user) {
        console.warn(`⚠️ User not found (email=${customerEmail}, clerkId=${data?.metadata?.clerkId || 'n/a'}, customerId=${customerId || 'n/a'})`);
        return;
    }

    // Classify product as trial/no-trial using product_id when available and verify trial via flags/API
    const productIdPayload =
        data?.product_id ||
        data?.subscription?.product_id ||
        data?.productId ||
        data?.subscription?.productId ||
        null;

    let productId: string | null = productIdPayload;
    let subDetails: any = null;
    if (!productId) {
        try {
            const sub: any = await dodoClient.subscriptions?.retrieve?.(subscriptionId);
            productId = sub?.product_id || null;
            subDetails = sub;
        } catch {
            productId = null;
        }
    } else {
        // Also attempt to retrieve subscription to inspect status/trial fields
        try {
            const sub: any = await dodoClient.subscriptions?.retrieve?.(subscriptionId);
            subDetails = sub;
        } catch { }
    }

    const trialMonthlyIds = [
        process.env.NEXT_PUBLIC_DODO_STUDENT_MONTHLY_PRODUCT_ID,
        process.env.NEXT_PUBLIC_DODO_MONTHLY_PRODUCT_ID,
    ].filter(Boolean) as string[];
    const trialYearlyIds = [
        process.env.NEXT_PUBLIC_DODO_STUDENT_YEARLY_PRODUCT_ID,
        process.env.NEXT_PUBLIC_DODO_YEARLY_PRODUCT_ID,
    ].filter(Boolean) as string[];
    const noTrialMonthlyIds = [
        process.env.NEXT_PUBLIC_DODO_MONTHLY_NO_TRIAL_PRODUCT_ID,
    ].filter(Boolean) as string[];
    const noTrialYearlyIds = [
        process.env.NEXT_PUBLIC_DODO_YEARLY_NO_TRIAL_PRODUCT_ID,
    ].filter(Boolean) as string[];

    const isNoTrialProduct = productId ? (noTrialMonthlyIds.includes(productId) || noTrialYearlyIds.includes(productId)) : false;
    const isTrialProduct = productId ? (trialMonthlyIds.includes(productId) || trialYearlyIds.includes(productId)) : false;

    // Detect trial via payload flags or remote subscription details
    const statusStr = String(data?.status || data?.subscription?.status || '').toLowerCase();
    const hasTrialFlag = (typeof data.trial_period_days === 'number' && data.trial_period_days > 0) || statusStr.includes('trial');
    let remoteTrial = false;
    if (!hasTrialFlag && !isTrialProduct) {
        try {
            const st = String(subDetails?.status || '').toLowerCase();
            const tpd = typeof subDetails?.trial_period_days === 'number' && subDetails.trial_period_days > 0;
            remoteTrial = st.includes('trial') || tpd;
        } catch { }
    }
    const isTrial = isTrialProduct || hasTrialFlag || remoteTrial;

    // If this subscription is no-trial or we cannot confirm trial, skip trial flow.
    if (isNoTrialProduct || !isTrial) {
        console.log(`[Dodo Webhook] subscription.created classified as no-trial (product=${productId || 'unknown'}, trialFlag=${hasTrialFlag}, remoteTrial=${remoteTrial}) → skipping trial flow`);
        return;
    }

    // ✅ BUG #5 FIX: Prevent re-trial abuse
    // Check if user has already used their trial
    if (user.trialUsedAt) {
        console.error(`❌ Trial abuse attempt blocked: User ${user.id} already used trial at ${user.trialUsedAt.toISOString()}`);
        console.error(`   Subscription: ${subscriptionId}, Product: ${productId}`);
        // Log audit trail
        await logStateTransition(
            user.id,
            user.subscriptionStatus as SubscriptionStatus,
            user.subscriptionStatus as SubscriptionStatus, // No change
            subscriptionId,
            'dodo',
            { event: 'subscription.created', blocked: true, reason: 'trial_already_used', trialUsedAt: user.trialUsedAt }
        );
        // Reject this webhook - user should have been given no-trial product
        console.log(`⚠️ Webhook rejected. User should checkout with no-trial product.`);
        return;
    }

    // Determine plan from interval (prefer payload, then API)
    const interval =
        data.payment_frequency_interval ||
        data.subscription_period_interval ||
        data.subscription?.plan?.interval ||
        subDetails?.payment_frequency_interval ||
        subDetails?.subscription_period_interval ||
        subDetails?.plan?.interval;
    const plan = (typeof interval === 'string' && interval.toLowerCase() === 'year') ? 'yearly' : 'monthly';

    // Calculate trial end date (prefer payload/API next_billing_date)
    const trialDays =
        typeof data.trial_period_days === 'number'
            ? data.trial_period_days
            : (typeof subDetails?.trial_period_days === 'number' ? subDetails.trial_period_days : 7);
    let trialEndDate: Date;
    if (data.next_billing_date) {
        trialEndDate = new Date(data.next_billing_date);
    } else if (subDetails?.next_billing_date) {
        trialEndDate = new Date(subDetails.next_billing_date);
    } else {
        trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + trialDays);
    }

    // Log and validate state transition
    const isValidTransition = await logStateTransition(
        user.id,
        user.subscriptionStatus as SubscriptionStatus,
        'trialing',
        subscriptionId,
        'dodo',
        { event: 'subscription.created', plan, trialDays, productId, isTrialProduct }
    );

    if (!isValidTransition) {
        console.error(`❌ Invalid state transition blocked for user ${user.id}: ${user.subscriptionStatus} → trialing`);
        return;
    }

    // Update user with trial status
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

    // Send trial welcome email (idempotent per subscription)
    await sendEmailWithIdempotency(
        generateEmailIdempotencyKey('trial_welcome', `trial_${subscriptionId}`),
        'trial_welcome',
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
 * Handle subscription activated (no immediate payment). If this is a trial activation, do nothing.
 * If there is no trial, treat as immediate paid activation and send welcome + receipt.
 */
async function handleSubscriptionActivated(data: any, webhookId: string) {
    const subscriptionId = data.subscription_id || data.subscription?.id || data.id;
    const customerEmail = data.customer?.email || data.customer_email;

    if (!subscriptionId) {
        console.error('❌ No subscription ID in subscription.active event');
        console.log('Available data keys:', Object.keys(data));
        return;
    }

    // Find user by subscription ID first, then by email
    let user = await db.user.findFirst({ where: { subscriptionId } });
    if (!user && customerEmail) {
        user = await db.user.findFirst({ where: { email: customerEmail } });
    }
    if (!user) {
        console.warn(`⚠️ User not found for subscription: ${subscriptionId}`);
        return;
    }

    // Classify product using product_id (payload or API) and guard trial via payload/API
    let pid: string | null =
        data?.product_id ||
        data?.subscription?.product_id ||
        data?.productId ||
        data?.subscription?.productId ||
        null;

    let subDetails: any = null;
    if (!pid) {
        try {
            const sub: any = await dodoClient.subscriptions?.retrieve?.(subscriptionId);
            pid = sub?.product_id || null;
            subDetails = sub;
        } catch {
            pid = null;
        }
    } else {
        try {
            const sub: any = await dodoClient.subscriptions?.retrieve?.(subscriptionId);
            subDetails = sub;
        } catch { }
    }

    const noTrialMonthlyIds = [process.env.NEXT_PUBLIC_DODO_MONTHLY_NO_TRIAL_PRODUCT_ID].filter(Boolean) as string[];
    const noTrialYearlyIds = [process.env.NEXT_PUBLIC_DODO_YEARLY_NO_TRIAL_PRODUCT_ID].filter(Boolean) as string[];
    const trialMonthlyIds = [
        process.env.NEXT_PUBLIC_DODO_STUDENT_MONTHLY_PRODUCT_ID,
        process.env.NEXT_PUBLIC_DODO_MONTHLY_PRODUCT_ID,
    ].filter(Boolean) as string[];
    const trialYearlyIds = [
        process.env.NEXT_PUBLIC_DODO_STUDENT_YEARLY_PRODUCT_ID,
        process.env.NEXT_PUBLIC_DODO_YEARLY_PRODUCT_ID,
    ].filter(Boolean) as string[];

    const isNoTrialProduct = pid ? (noTrialMonthlyIds.includes(pid) || noTrialYearlyIds.includes(pid)) : false;
    const isTrialProduct = pid ? (trialMonthlyIds.includes(pid) || trialYearlyIds.includes(pid)) : false;

    const statusStr = String(data?.status || data?.subscription?.status || subDetails?.status || '').toLowerCase();
    const hasTrialFlag = (typeof data.trial_period_days === 'number' && data.trial_period_days > 0) || statusStr.includes('trial');
    const wasTrialing = user.subscriptionStatus === 'trialing';
    const remoteTrial = !hasTrialFlag && !wasTrialing && !isTrialProduct
        ? (String(subDetails?.status || '').toLowerCase().includes('trial') ||
            (typeof subDetails?.trial_period_days === 'number' && subDetails.trial_period_days > 0))
        : false;

    // If trial (by flag, prior state, product, or remote), ensure DB reflects trial and send Trial Welcome idempotently
    if (hasTrialFlag || wasTrialing || isTrialProduct || remoteTrial) {
        const plan = await inferPlanFromPayloadOrApi(
            data,
            subscriptionId,
            (user.subscriptionPlan as 'monthly' | 'yearly' | null) || 'monthly'
        );

        const trialDays =
            (typeof data.trial_period_days === 'number' && data.trial_period_days > 0)
                ? data.trial_period_days
                : (typeof (subDetails?.trial_period_days) === 'number' && subDetails.trial_period_days > 0)
                    ? subDetails.trial_period_days
                    : 7;

        let trialEndDate: Date;
        if (data.next_billing_date) {
            trialEndDate = new Date(data.next_billing_date);
        } else if (subDetails?.next_billing_date) {
            trialEndDate = new Date(subDetails.next_billing_date);
        } else {
            trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + trialDays);
        }

        const isValidTransition = await logStateTransition(
            user.id,
            user.subscriptionStatus as SubscriptionStatus,
            'trialing',
            subscriptionId,
            'dodo',
            { event: 'subscription.active (trial)', plan, pid, remoteTrial }
        );

        if (!isValidTransition) {
            console.error(`❌ Invalid state transition blocked for user ${user.id}: ${user.subscriptionStatus} → trialing`);
            return;
        }

        await db.user.update({
            where: { id: user.id },
            data: {
                subscriptionStatus: 'trialing',
                subscriptionPlan: plan,
                subscriptionEndsAt: trialEndDate,
                subscriptionId,
                customerId: user.customerId || data.customer?.customer_id || data.customer?.id || data.customer_id || user.customerId,
                ...(user.trialUsedAt ? {} : { trialUsedAt: new Date() }),
            }
        });

        const toEmail = user.email || customerEmail;
        if (toEmail) {
            await sendEmailWithIdempotency(
                generateEmailIdempotencyKey('trial_welcome', `trial_${subscriptionId}`),
                'trial_welcome',
                toEmail,
                () =>
                    sendTrialWelcomeEmail({
                        email: toEmail!,
                        name: undefined,
                        trialDays,
                        trialEndsAt: trialEndDate.toISOString(),
                    })
            );
        }

        console.log(`[Dodo Webhook] subscription.active treated as TRIAL for user ${user.id} → DB set to trialing until ${trialEndDate.toISOString()} (pid=${pid})`);
        return;
    }

    // Otherwise, this is an immediate paid activation (no trial)
    const plan = await inferPlanFromPayloadOrApi(
        data,
        subscriptionId,
        (user.subscriptionPlan as 'monthly' | 'yearly' | null) || 'monthly'
    );

    // Determine next billing date
    let nextBillingDate: Date;
    if (data.next_billing_date) {
        nextBillingDate = new Date(data.next_billing_date);
    } else {
        nextBillingDate = new Date();
        if (plan === 'yearly') nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
        else nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    }

    const isValidTransition = await logStateTransition(
        user.id,
        user.subscriptionStatus as SubscriptionStatus,
        'active',
        subscriptionId,
        'dodo',
        { event: 'subscription.active', plan, pid, isNoTrialProduct }
    );

    if (!isValidTransition) {
        console.error(`❌ Invalid state transition blocked for user ${user.id}: ${user.subscriptionStatus} → active`);
        return;
    }

    await db.user.update({
        where: { id: user.id },
        data: {
            subscriptionStatus: 'active',
            subscriptionEndsAt: nextBillingDate,
            subscriptionId,
            subscriptionPlan: plan,
            customerId: user.customerId,
        },
    });

    if (user.email) {
        await sendEmailWithIdempotency(
            generateEmailIdempotencyKey('welcome', `sub_${subscriptionId}`),
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

        // Do not send receipt here to avoid dupes when payment.succeeded also fires
    }

    console.log(`✅ Subscription activated (no-trial) for user ${user.id}, active until ${nextBillingDate.toISOString()}`);
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
    const wasTrialing = user.subscriptionStatus === 'trialing';

    // Distinguish $0 trial "payments" from real paid conversions
    const normalizeAmount = (v: any): number | null => {
        if (typeof v === 'number') return v;
        if (typeof v === 'string') {
            const n = parseInt(v, 10);
            return Number.isFinite(n) ? n : null;
        }
        return null;
    };
    const totalAmount = normalizeAmount(data?.total_amount) ?? normalizeAmount(data?.amount) ?? null;
    const isZeroAmount = totalAmount !== null && totalAmount === 0;

    // Classify product via product_id (payload or API)
    let pid: string | null =
        data?.product_id ||
        data?.subscription?.product_id ||
        data?.productId ||
        data?.subscription?.productId ||
        null;
    if (!pid) {
        try {
            const sub: any = await dodoClient.subscriptions?.retrieve?.(subscriptionId);
            pid = sub?.product_id || null;
        } catch {
            pid = null;
        }
    }

    const noTrialMonthlyIds = [process.env.NEXT_PUBLIC_DODO_MONTHLY_NO_TRIAL_PRODUCT_ID].filter(Boolean) as string[];
    const noTrialYearlyIds = [process.env.NEXT_PUBLIC_DODO_YEARLY_NO_TRIAL_PRODUCT_ID].filter(Boolean) as string[];
    const trialMonthlyIds = [
        process.env.NEXT_PUBLIC_DODO_STUDENT_MONTHLY_PRODUCT_ID,
        process.env.NEXT_PUBLIC_DODO_MONTHLY_PRODUCT_ID,
    ].filter(Boolean) as string[];
    const trialYearlyIds = [
        process.env.NEXT_PUBLIC_DODO_STUDENT_YEARLY_PRODUCT_ID,
        process.env.NEXT_PUBLIC_DODO_YEARLY_PRODUCT_ID,
    ].filter(Boolean) as string[];
    const isNoTrialProduct = pid ? (noTrialMonthlyIds.includes(pid) || noTrialYearlyIds.includes(pid)) : false;
    const isTrialProduct = pid ? (trialMonthlyIds.includes(pid) || trialYearlyIds.includes(pid)) : false;

    // If this is a trial product and amount is $0 or missing, skip Pro welcome/receipt/state change
    if ((wasTrialing || isTrialProduct) && (isZeroAmount || totalAmount === null)) {
        console.log(`[Dodo Webhook] payment.succeeded ${totalAmount === null ? '(no amount)' : '$0'} during trial for user ${user.id} → skipping Pro welcome/receipt/state change`);
        return;
    }

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

    // Log and validate state transition
    const isValidTransition = await logStateTransition(
        user.id,
        user.subscriptionStatus as SubscriptionStatus,
        'active',
        subscriptionId,
        'dodo',
        { event: 'payment.succeeded', plan, isResubscription, isNewSubscription, pid, isNoTrialProduct }
    );

    if (!isValidTransition) {
        console.error(`❌ Invalid state transition blocked for user ${user.id}: ${user.subscriptionStatus} → active`);
        return;
    }

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

    // Send emails (idempotent by subscription/period)
    if (user.email) {
        // For no-trial products: send Pro Welcome immediately; For trial conversion: send after real charge
        if (isNoTrialProduct || isNewSubscription || isResubscription || wasTrialing) {
            await sendEmailWithIdempotency(
                generateEmailIdempotencyKey('welcome', `sub_${subscriptionId}`),
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

        // Key receipt by subscription + billing period to avoid dupes
        const periodKey = nextBillingDate.toISOString().slice(0, 10);
        await sendEmailWithIdempotency(
            generateEmailIdempotencyKey('receipt', `sub_${subscriptionId}_${periodKey}`),
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

    let user = await db.user.findFirst({
        where: { subscriptionId: subscriptionId }
    });

    if (!user && data?.customer?.customer_id) {
        user = await db.user.findFirst({ where: { customerId: data.customer.customer_id } });
    }
    if (!user && data?.customer?.email) {
        user = await db.user.findFirst({ where: { email: data.customer.email } });
    }
    if (!user && data?.metadata?.clerkId) {
        user = await db.user.findFirst({ where: { clerkId: data.metadata.clerkId } });
    }

    if (!user) {
        console.warn(`⚠️ User not found for subscription: ${subscriptionId}`);
        return;
    }

    // Log and validate state transition
    const isValidTransition = await logStateTransition(
        user.id,
        user.subscriptionStatus as SubscriptionStatus,
        'cancelled',
        subscriptionId,
        'dodo',
        { event: 'subscription.cancelled' }
    );

    if (!isValidTransition) {
        console.error(`❌ Invalid state transition blocked for user ${user.id}: ${user.subscriptionStatus} → cancelled`);
        return;
    }

    // ✅ BUG #6 FIX: Keep access until trial/subscription end date
    // For both trial and paid subscriptions, user should keep access until subscriptionEndsAt
    if (user.subscriptionStatus === 'trialing') {
        await db.user.update({
            where: { id: user.id },
            data: {
                subscriptionStatus: 'cancelled',
                // Keep existing subscriptionEndsAt (trial end date) - don't revoke immediately
            }
        });
        console.log(`✅ Trial cancelled for user ${user.id}, access until ${user.subscriptionEndsAt?.toISOString()}`);
    } else {
        // If paid, keep access until end of billing period
        await db.user.update({
            where: { id: user.id },
            data: {
                subscriptionStatus: 'cancelled',
            }
        });
        console.log(`✅ Subscription cancelled for user ${user.id}, access until ${user.subscriptionEndsAt?.toISOString()}`)
            ;
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

    // Log and validate state transition
    const isValidTransition = await logStateTransition(
        user.id,
        user.subscriptionStatus as SubscriptionStatus,
        'expired',
        subscriptionId,
        'dodo',
        { event: 'subscription.trial_ended' }
    );

    if (!isValidTransition) {
        console.error(`❌ Invalid state transition blocked for user ${user.id}: ${user.subscriptionStatus} → expired`);
        return;
    }

    // Set to expired
    await db.user.update({
        where: { id: user.id },
        data: {
            subscriptionStatus: 'expired',
            subscriptionEndsAt: new Date(),
        }
    });

    // Send expiration email to notify user
    if (user.email) {
        await sendEmailWithIdempotency(
            generateEmailIdempotencyKey('trial_ended', _webhookId),
            'trial_ended',
            user.email,
            () =>
                sendExpirationEmail({
                    email: user.email!,
                    name: undefined,
                    endedAt: new Date(),
                })
        );
    }

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

    // Log and validate state transition
    const isValidTransition = await logStateTransition(
        user.id,
        user.subscriptionStatus as SubscriptionStatus,
        'expired',
        subscriptionId,
        'dodo',
        { event: 'subscription.expired' }
    );

    if (!isValidTransition) {
        console.error(`❌ Invalid state transition blocked for user ${user.id}: ${user.subscriptionStatus} → expired`);
        return;
    }

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
 * ✅ BUG #8 FIX: Transition to on_hold status with grace period
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

    // Calculate grace period (7 days from now)
    const gracePeriodDays = 7;
    const gracePeriodEndsAt = new Date();
    gracePeriodEndsAt.setDate(gracePeriodEndsAt.getDate() + gracePeriodDays);

    // Log and validate state transition to on_hold
    const isValidTransition = await logStateTransition(
        user.id,
        user.subscriptionStatus as SubscriptionStatus,
        'on_hold',
        subscriptionId,
        'dodo',
        { event: 'payment.failed', reason: data.reason, gracePeriodDays }
    );

    if (!isValidTransition) {
        console.error(`❌ Invalid state transition blocked for user ${user.id}: ${user.subscriptionStatus} → on_hold`);
        // Still send email to notify user, even if state transition blocked
    } else {
        // Update user to on_hold with grace period
        await db.user.update({
            where: { id: user.id },
            data: {
                subscriptionStatus: 'on_hold',
                paymentGracePeriodEndsAt: gracePeriodEndsAt,
            }
        });
        console.log(`⚠️ Payment failed for user ${user.id}, status → on_hold, grace period until ${gracePeriodEndsAt.toISOString()}`);
    }

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

    const isValidTransition = await logStateTransition(
        user.id,
        user.subscriptionStatus as SubscriptionStatus,
        'active',
        subscriptionId,
        'dodo',
        { event: 'subscription.renewed', plan }
    );

    if (!isValidTransition) {
        console.error(`❌ Invalid state transition blocked for user ${user.id}: ${user.subscriptionStatus} → active`);
        return;
    }

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
 * Sets a grace period to keep user access while payment is retried
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

    // Calculate grace period (7 days from now)
    const gracePeriodDays = 7;
    const gracePeriodEndsAt = new Date();
    gracePeriodEndsAt.setDate(gracePeriodEndsAt.getDate() + gracePeriodDays);

    const isValidTransition = await logStateTransition(
        user.id,
        user.subscriptionStatus as SubscriptionStatus,
        'on_hold',
        subscriptionId,
        'dodo',
        { event: 'subscription.on_hold', gracePeriodDays }
    );

    if (!isValidTransition) {
        console.error(`❌ Invalid state transition blocked for user ${user.id}: ${user.subscriptionStatus} → on_hold`);
        return;
    }

    await db.user.update({
        where: { id: user.id },
        data: {
            subscriptionStatus: 'on_hold',
            paymentGracePeriodEndsAt: gracePeriodEndsAt,
            // Preserve subscriptionEndsAt for reference
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
                    reason: data?.reason,
                    gracePeriodEndsAt: gracePeriodEndsAt,
                })
        );
    }
    console.log(`⚠️ Subscription on hold for user ${user.id}, grace period until ${gracePeriodEndsAt.toISOString()}`);
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
        process.env.NEXT_PUBLIC_DODO_MONTHLY_NO_TRIAL_PRODUCT_ID,
    ].filter(Boolean) as string[];
    const yearlyIds = [
        process.env.NEXT_PUBLIC_DODO_STUDENT_YEARLY_PRODUCT_ID,
        process.env.NEXT_PUBLIC_DODO_YEARLY_PRODUCT_ID,
        process.env.NEXT_PUBLIC_DODO_YEARLY_NO_TRIAL_PRODUCT_ID,
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
