import { verifyWebhook } from '@clerk/nextjs/webhooks';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { sendWelcomeEmail, sendReceiptEmail, sendCancellationEmail, sendPlanChangeEmail, sendTrialWelcomeEmail } from '@/lib/email';
import { sendEmailWithIdempotency, generateEmailIdempotencyKey } from '@/lib/emailIdempotency';

/**
 * Clerk Webhook Handler
 * 
 * Handles:
 * - User events (user.created, user.updated, user.deleted) for user data sync
 * - Subscription events from Clerk Billing for subscription status sync
 */

// GET handler to allow ngrok browser warning to pass
export async function GET() {
    return new Response('Clerk webhook endpoint is active', { status: 200 });
}

export async function POST(req: NextRequest) {
    let evt: any;

    try {
        // Debug: Check if signing secret is loaded
        const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
        console.log(`[Clerk Webhook] Signing secret loaded: ${signingSecret ? 'YES (length: ' + signingSecret.length + ')' : 'NO - MISSING!'}`);

        // Step 1: Verify the webhook FIRST (this is fast and required)
        evt = await verifyWebhook(req);
    } catch (err) {
        console.error('[Clerk Webhook] Error verifying webhook:', err);
        return new Response('Error verifying webhook', { status: 400 });
    }

    // Step 2: Return 200 OK immediately to prevent timeout
    // Clerk will stop retrying once it gets 200
    const eventType = evt.type;
    console.log(`[Clerk Webhook] ✅ Received and acknowledged: ${eventType}`);

    // Step 3: Process the event ASYNCHRONOUSLY (fire and forget)
    // This runs AFTER the response is sent
    processWebhookEvent(evt).catch(err => {
        console.error('[Clerk Webhook] Background processing error:', err);
    });

    return new Response('Webhook received', { status: 200 });
}

/**
 * Process webhook event in the background (after 200 OK is sent)
 */
async function processWebhookEvent(evt: any) {
    const eventType = evt.type;
    console.log(`[Clerk Webhook] 🔄 Processing event: ${eventType}`);
    console.log(`[Clerk Webhook] Full event data:`, JSON.stringify(evt.data, null, 2));

    // Handle user events
    if (eventType.startsWith('user.')) {
        await handleUserEvent(evt);
    }

    // Handle subscription-related events (various possible prefixes)
    if (eventType.startsWith('subscription') ||
        eventType.startsWith('checkout') ||
        eventType.startsWith('invoice') ||
        eventType.startsWith('payment')) {
        await handleSubscriptionEvent(evt);
    }

    console.log(`[Clerk Webhook] ✓ Finished processing: ${eventType}`);
}

/**
 * Handle user events and sync to database
 */
async function handleUserEvent(evt: any) {
    const { data, type } = evt;

    console.log(`[Clerk Webhook] Processing ${type} for user ${data.id}`);

    switch (type) {
        case 'user.created': {
            // Create new user in database
            const email = data.email_addresses?.[0]?.email_address;

            if (!email) {
                console.log('[Clerk Webhook] No email found for user, skipping');
                return;
            }

            try {
                await db.user.upsert({
                    where: { clerkId: data.id },
                    update: {
                        email,
                    },
                    create: {
                        clerkId: data.id,
                        email,
                        subscriptionStatus: 'free',
                    },
                });
                console.log(`[Clerk Webhook] Created/updated user ${data.id}`);
            } catch (error) {
                console.error(`[Clerk Webhook] Failed to create user ${data.id}:`, error);
            }
            break;
        }

        case 'user.updated': {
            // Update existing user email
            const email = data.email_addresses?.[0]?.email_address;

            try {
                await db.user.update({
                    where: { clerkId: data.id },
                    data: {
                        email,
                    },
                });
                console.log(`[Clerk Webhook] Updated user ${data.id}`);
            } catch (error) {
                console.error(`[Clerk Webhook] Failed to update user ${data.id}:`, error);
            }
            break;
        }

        case 'user.deleted': {
            // Soft delete user
            try {
                await db.user.update({
                    where: { clerkId: data.id },
                    data: {
                        isDeleted: true,
                        deletedAt: new Date(),
                    },
                });
                console.log(`[Clerk Webhook] Soft deleted user ${data.id}`);
            } catch (error) {
                console.error(`[Clerk Webhook] Failed to delete user ${data.id}:`, error);
            }
            break;
        }

        default:
            console.log(`[Clerk Webhook] Unhandled user event: ${type}`);
    }
}

/**
 * Handle subscription events and sync to database
 */
async function handleSubscriptionEvent(evt: any) {
    const { data, type } = evt;

    // Extract user ID from the event
    // Clerk Commerce events have user_id nested in payer object
    const clerkUserId = data.payer?.user_id || data.user_id || data.subscriber_id;

    if (!clerkUserId) {
        console.log('[Clerk Webhook] No user ID found in event, skipping');
        console.log('[Clerk Webhook] Available data keys:', Object.keys(data));
        return;
    }

    console.log(`[Clerk Webhook] Processing ${type} for user ${clerkUserId}`);

    // Map Clerk subscription status to our database status
    let subscriptionStatus: string;
    let subscriptionPlan: string | null = null;
    let subscriptionEndsAt: Date | null = null;

    switch (type) {
        case 'subscription.created':
        case 'subscription.active':
        case 'subscription.updated':
            // For subscription.updated, check status field
            if (data.status === 'active') {
                subscriptionStatus = 'active';
                // Try to get plan info from items array
                const activeItem = data.items?.find((item: any) => item.status === 'active' && item.plan?.slug !== 'free_user');
                if (activeItem) {
                    subscriptionPlan = activeItem.interval === 'annual' ? 'yearly' : 'monthly';
                }
            } else if (data.status === 'canceled' || data.status === 'cancelled') {
                subscriptionStatus = 'cancelled';
            } else if (data.status === 'ended' || data.status === 'expired') {
                subscriptionStatus = 'expired';
            } else if (data.status === 'trialing') {
                subscriptionStatus = 'trialing';
                if (data.trial_end) {
                    subscriptionEndsAt = new Date(data.trial_end > 9999999999 ? data.trial_end : data.trial_end * 1000);
                }
            } else {
                // incomplete, incomplete_expired, unpaid, paused, etc.
                console.log(`[Clerk Webhook] Subscription status is ${data.status}, treating as free/inactive`);
                subscriptionStatus = 'free';
                subscriptionPlan = null;
            }
            break;
        case 'subscription.past_due':
            subscriptionStatus = 'active'; // Grace period - still give access
            break;
        case 'subscriptionItem.active':
            subscriptionStatus = 'active';
            if (data.plan_id) {
                // Clerk uses 'annual' not 'year'
                subscriptionPlan = data.interval === 'annual' ? 'yearly' : 'monthly';
            }
            break;
        case 'subscriptionItem.canceled':
        case 'subscription.canceled':
            subscriptionStatus = 'cancelled';
            // Clerk Commerce uses period_end, Stripe uses current_period_end
            const periodEnd = data.period_end || data.current_period_end;
            if (periodEnd) {
                // Handle both milliseconds and seconds timestamp formats
                subscriptionEndsAt = new Date(periodEnd > 9999999999 ? periodEnd : periodEnd * 1000);
            }
            console.log(`[Clerk Webhook] Cancellation - period_end: ${periodEnd}, subscriptionEndsAt: ${subscriptionEndsAt}`);
            break;
        case 'subscription.ended':
            // When subscription ends, user goes back to free plan
            subscriptionStatus = 'free';
            subscriptionPlan = null;
            break;
        case 'subscriptionItem.upcoming':
            // Upcoming renewal notification - no action needed, just acknowledge
            console.log('[Clerk Webhook] Subscription renewal upcoming - acknowledged');
            return; // Exit early, no DB update needed
        default:
            console.log(`[Clerk Webhook] Unhandled subscription event: ${type}`);
            return;
    }

    // Fetch user BEFORE update to check for plan changes
    let oldSubscriptionPlan: string | null = null;
    try {
        const currentUser = await db.user.findUnique({
            where: { clerkId: clerkUserId },
            select: { subscriptionPlan: true }
        });
        oldSubscriptionPlan = currentUser?.subscriptionPlan || null;
    } catch (e) {
        console.error(`[Clerk Webhook] Failed to fetch current user state:`, e);
    }

    // Update user in database
    try {
        const updateData: {
            subscriptionStatus: string;
            subscriptionPlan?: string;
            subscriptionEndsAt?: Date;
            subscriptionId?: string;
        } = { subscriptionStatus };

        if (subscriptionPlan) updateData.subscriptionPlan = subscriptionPlan;
        if (subscriptionEndsAt) updateData.subscriptionEndsAt = subscriptionEndsAt;
        if (data.id) updateData.subscriptionId = data.id;

        await db.user.update({
            where: { clerkId: clerkUserId },
            data: updateData,
        });

        console.log(`[Clerk Webhook] Updated user ${clerkUserId} with status: ${subscriptionStatus}`);

        // Extract email and name for notifications
        const email = data.payer?.email || data.email;
        const name = data.payer?.first_name || data.first_name || 'there';

        if (subscriptionStatus === 'trialing' && email) {
            console.log(`[Clerk Webhook] Sending trial welcome email to ${email}`);
            const trialDays = data.trial_end ? Math.ceil((data.trial_end - data.start_date) / (24 * 60 * 60)) : 7;
            const trialEndsAtDate = subscriptionEndsAt ? subscriptionEndsAt.toLocaleDateString() : undefined;
            const trialKey = generateEmailIdempotencyKey('welcome', `trial_${data.id || clerkUserId}`);

            await sendEmailWithIdempotency(trialKey, 'welcome', email, () =>
                sendTrialWelcomeEmail({
                    email,
                    name,
                    trialDays,
                    trialEndsAt: trialEndsAtDate
                })
            );
        }

        // Send Emails Based on Event Type (NO idempotency - send every time)
        if (subscriptionStatus === 'active' && email && subscriptionPlan) {
            console.log(`[Clerk Webhook] Sending emails for active subscription to ${email}`);

            // Detect if this is a plan switch (using pre-update state)
            const isPlanSwitch = oldSubscriptionPlan && oldSubscriptionPlan !== subscriptionPlan;

            if (isPlanSwitch) {
                console.log(`[Clerk Webhook] Plan switch detected from ${oldSubscriptionPlan} to ${subscriptionPlan}`);

                // Determine next billing date
                const nextBillingDate = subscriptionEndsAt ||
                    (data.period_end ? new Date(data.period_end > 9999999999 ? data.period_end : data.period_end * 1000) :
                        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

                const planChangeKey = generateEmailIdempotencyKey('receipt', `planchange_${data.id}_${subscriptionPlan}`);
                await sendEmailWithIdempotency(planChangeKey, 'receipt', email, () =>
                    sendPlanChangeEmail({
                        email,
                        name,
                        newPlan: subscriptionPlan as string,
                        nextBillingDate
                    })
                );
            } else {
                // Normal receipt for new subs or renewals
                const receiptKey = generateEmailIdempotencyKey('receipt', data.id || `${clerkUserId}_${Date.now()}`);
                await sendEmailWithIdempotency(receiptKey, 'receipt', email, () =>
                    sendReceiptEmail({
                        email,
                        name,
                        plan: subscriptionPlan as 'monthly' | 'yearly',
                        subscriptionId: data.id || 'sub_unknown'
                    })
                );
            }

            // Send welcome only on creation AND NOT on plan switch (existing user)
            if ((type === 'subscription.created' || type === 'subscriptionItem.active') && !isPlanSwitch) {
                const welcomeKey = generateEmailIdempotencyKey('welcome', data.id || clerkUserId);
                await sendEmailWithIdempotency(welcomeKey, 'welcome', email, () =>
                    sendWelcomeEmail({
                        email,
                        name,
                        plan: subscriptionPlan as 'monthly' | 'yearly',
                        subscriptionId: data.id || 'sub_unknown'
                    })
                );
            }
        }

        // Send Cancellation Email ONLY if truly cancelling (not switching plans)
        if (subscriptionStatus === 'cancelled' && email) {
            // Check current DB status - if still/already active, user is switching plans, not cancelling
            const currentUser = await db.user.findUnique({
                where: { clerkId: clerkUserId },
                select: { subscriptionStatus: true }
            });

            const isSwitchingPlans = currentUser?.subscriptionStatus === 'active';

            if (isSwitchingPlans) {
                console.log(`[Clerk Webhook] User is switching plans, skipping cancellation email`);
            } else {
                console.log(`[Clerk Webhook] Sending cancellation email to ${email}`);

                // Get plan from items or use default
                let plan: 'monthly' | 'yearly' = 'monthly';
                const activeItem = data.items?.find((item: any) => item.plan?.slug !== 'free_user');
                if (activeItem) {
                    plan = activeItem.interval === 'annual' ? 'yearly' : 'monthly';
                }

                // Calculate access end date
                const accessEndsAt = subscriptionEndsAt ||
                    (data.period_end ? new Date(data.period_end > 9999999999 ? data.period_end : data.period_end * 1000) :
                        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

                const cancelKey = generateEmailIdempotencyKey('cancellation', data.id || clerkUserId);
                await sendEmailWithIdempotency(cancelKey, 'cancellation', email, () =>
                    sendCancellationEmail({
                        email,
                        name,
                        plan,
                        accessEndsAt
                    })
                );
            }
        }

    } catch (error) {
        console.error(`[Clerk Webhook] Failed to update user ${clerkUserId}:`, error);
    }
}
