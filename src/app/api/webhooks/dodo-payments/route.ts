import { Webhooks } from "@dodopayments/nextjs";
import { db } from "@/lib/db";
import { sendWelcomeEmail, sendReceiptEmail, sendRenewalEmail, sendPaymentFailedEmail } from "@/lib/email";
import { logStateTransition, logSubscriptionChange } from "@/lib/subscriptionState";
import { SubscriptionStatus } from "@/lib/subscription";
import { sendEmailWithIdempotency, generateEmailIdempotencyKey } from "@/lib/emailIdempotency";

export const POST = Webhooks({
    webhookKey: process.env.NEXT_PUBLIC_DODO_PAYMENTS_WEBHOOK_KEY || 'dummy_webhook_key_for_build',

    // Called when subscription becomes active (new subscription or renewal)
    onSubscriptionActive: async (payload) => {
        try {
            const data = payload.data as any;
            const customerEmail = data.customer?.email;
            const customerName = data.customer?.name;
            const subscriptionId = data.subscription_id || data.subscription?.subscription_id;
            const customerId = data.customer?.customer_id;

            // Determine plan from billing interval
            const billingInterval = data.recurring_pre_tax_amount?.interval ||
                data.subscription?.billing?.interval ||
                'month';
            const plan = billingInterval === 'year' ? 'yearly' : 'monthly';

            // Check if this is a trial
            // Dodo/PayPal trials usually have 0 amount charged initially OR status 'trialing'
            const isTrial = data.status === 'trialing' ||
                (data.payment_amount === 0) ||
                (data.subscription?.status === 'trialing');

            // Get next billing date / trial end date
            // Prefer explicit next_billing_date from payload, fall back to calculation
            let subscriptionEndsAt = data.next_billing_date ? new Date(data.next_billing_date) :
                data.subscription?.next_billing_date ? new Date(data.subscription.next_billing_date) :
                    null;

            if (!subscriptionEndsAt) {
                subscriptionEndsAt = new Date();
                if (isTrial) {
                    // Default trial length fallback (e.g. 7 days) if not provided
                    subscriptionEndsAt.setDate(subscriptionEndsAt.getDate() + 7);
                } else if (plan === 'yearly') {
                    subscriptionEndsAt.setFullYear(subscriptionEndsAt.getFullYear() + 1);
                } else {
                    subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + 1);
                }
            }

            // Check if this is a new subscription or renewal
            let isRenewal = false;
            if (subscriptionId) {
                const existingUser = await db.user.findFirst({
                    where: { subscriptionId: subscriptionId }
                });

                if (existingUser) {
                    if (existingUser.email === customerEmail) {
                        // Same user, same subscription - this is a renewal
                        isRenewal = true;
                    } else {
                        // Different user trying to use same subscription (security issue)
                        console.warn(`⚠️ Security Alert: Subscription ${subscriptionId} is being reused! Moved from ${existingUser.email} to ${customerEmail}.`);
                        await db.user.update({
                            where: { id: existingUser.id },
                            data: { subscriptionId: null, subscriptionStatus: 'free', subscriptionPlan: null }
                        });
                    }
                }
            }

            if (customerEmail) {
                // Use transaction to prevent race condition with concurrent cancel
                await db.$transaction(async (tx) => {
                    // Find the user to get their current state (within transaction)
                    const user = await tx.user.findFirst({
                        where: { email: customerEmail },
                        select: { id: true, subscriptionStatus: true }
                    });

                    if (!user) {
                        console.log(`No user found for email ${customerEmail}`);
                        return;
                    }

                    const currentStatus = (user.subscriptionStatus || 'free') as SubscriptionStatus;
                    const newStatus: SubscriptionStatus = isTrial ? 'trialing' : 'active';

                    // Race condition check: If user just cancelled, don't reactivate (unless renewal)
                    if (currentStatus === 'cancelled' && !isRenewal) {
                        console.log(`⚠️ Skipping activation for ${customerEmail} - user has cancelled`);
                        await logStateTransition(
                            user.id,
                            'cancelled',
                            newStatus,
                            subscriptionId || 'unknown',
                            'dodo',
                            { blocked: true, reason: 'User already cancelled' }
                        );
                        return;
                    }

                    // Validate and log the state transition
                    const isValidTransition = await logStateTransition(
                        user.id,
                        currentStatus,
                        newStatus,
                        subscriptionId || 'unknown',
                        'dodo',
                        { customerEmail, plan, isRenewal, isTrial }
                    );

                    // Block invalid transitions (except for renewals which just extend the period)
                    if (!isValidTransition && !isRenewal) {
                        console.warn(`⚠️ Skipping state update for ${customerEmail}: invalid transition`);
                        return;
                    }

                    await tx.user.update({
                        where: { id: user.id },
                        data: {
                            subscriptionStatus: newStatus,
                            subscriptionId: subscriptionId,
                            customerId: customerId,
                            subscriptionPlan: plan,
                            subscriptionEndsAt: subscriptionEndsAt,
                        }
                    });
                    console.log(`Subscription ${isRenewal ? 'renewed' : (isTrial ? 'trial started' : 'activated')} for ${customerEmail}, ends at ${subscriptionEndsAt.toISOString()}`);

                    // Send appropriate email based on new vs renewal (with idempotency)
                    const emailKey = subscriptionId || `${customerEmail}_${Date.now()}`;

                    if (isRenewal) {
                        await sendEmailWithIdempotency(
                            generateEmailIdempotencyKey('renewal', emailKey),
                            'renewal',
                            customerEmail,
                            () => sendRenewalEmail({
                                email: customerEmail,
                                name: customerName || undefined,
                                plan: plan as 'monthly' | 'yearly',
                                nextRenewalDate: subscriptionEndsAt,
                            })
                        );
                    } else {
                        await sendEmailWithIdempotency(
                            generateEmailIdempotencyKey('welcome', emailKey),
                            'welcome',
                            customerEmail,
                            () => sendWelcomeEmail({
                                email: customerEmail,
                                name: customerName || undefined,
                                plan: plan as 'monthly' | 'yearly',
                                subscriptionId: subscriptionId || 'unknown',
                            })
                        );
                    }
                });
            }
        } catch (error) {
            console.error('Error processing subscription active webhook:', error);
        }
    },

    // Called when subscription is cancelled
    onSubscriptionCancelled: async (payload) => {
        try {
            const data = payload.data as any;
            const subscriptionId = data.subscription_id || data.subscription?.subscription_id;

            if (subscriptionId) {
                // Find user to validate and log transition
                const user = await db.user.findFirst({
                    where: { subscriptionId: subscriptionId },
                    select: { id: true, subscriptionStatus: true }
                });

                if (user) {
                    await logStateTransition(
                        user.id,
                        user.subscriptionStatus as SubscriptionStatus,
                        'cancelled',
                        subscriptionId,
                        'dodo',
                        { event: 'SUBSCRIPTION_CANCELLED' }
                    );
                }

                await db.user.updateMany({
                    where: { subscriptionId: subscriptionId },
                    data: {
                        subscriptionStatus: 'cancelled',
                    }
                });
                console.log(`Subscription cancelled: ${subscriptionId}`);
            }
        } catch (error) {
            console.error('Error processing subscription cancelled webhook:', error);
        }
    },

    // Called when subscription expires (after cancellation period ends)
    onSubscriptionExpired: async (payload) => {
        try {
            const data = payload.data as any;
            const subscriptionId = data.subscription_id || data.subscription?.subscription_id;

            if (subscriptionId) {
                // Find user to log transition
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
                        'dodo',
                        { event: 'SUBSCRIPTION_EXPIRED' }
                    );
                }

                await db.user.updateMany({
                    where: { subscriptionId: subscriptionId },
                    data: {
                        subscriptionStatus: 'free',
                        subscriptionId: null,
                        subscriptionPlan: null,
                    }
                });
                console.log(`Subscription expired: ${subscriptionId}`);
            }
        } catch (error) {
            console.error('Error processing subscription expired webhook:', error);
        }
    },

    // Called when subscription is on hold (payment issues)
    onSubscriptionOnHold: async (payload) => {
        try {
            const data = payload.data as any;
            const subscriptionId = data.subscription_id || data.subscription?.subscription_id;

            if (subscriptionId) {
                // Find user with this subscription
                const user = await db.user.findFirst({
                    where: { subscriptionId: subscriptionId },
                    select: { id: true, email: true, subscriptionStatus: true, subscriptionPlan: true }
                });

                if (user) {
                    await logStateTransition(
                        user.id,
                        user.subscriptionStatus as SubscriptionStatus,
                        'on_hold',
                        subscriptionId,
                        'dodo',
                        { event: 'SUBSCRIPTION_ON_HOLD' }
                    );
                }

                await db.user.updateMany({
                    where: { subscriptionId: subscriptionId },
                    data: {
                        subscriptionStatus: 'on_hold',
                    }
                });
                console.log(`Subscription on hold: ${subscriptionId}`);

                // Send payment failed email
                if (user?.email) {
                    await sendPaymentFailedEmail({
                        email: user.email,
                        plan: (user.subscriptionPlan as 'monthly' | 'yearly') || 'monthly',
                        reason: 'Payment could not be processed',
                    });
                }
            }
        } catch (error) {
            console.error('Error processing subscription on hold webhook:', error);
        }
    },

    // Called when payment succeeds
    onPaymentSucceeded: async (payload) => {
        try {
            const data = payload.data as any;
            console.log(`Payment succeeded: ${data.payment_id}`);

            // Send receipt email
            const customerEmail = data.customer?.email;
            const billingInterval = data.recurring_pre_tax_amount?.interval ||
                data.subscription?.billing?.interval ||
                'month';
            const plan = billingInterval === 'year' ? 'yearly' : 'monthly';
            const subscriptionId = data.subscription_id || data.subscription?.subscription_id;

            if (customerEmail) {
                await sendReceiptEmail({
                    email: customerEmail,
                    name: data.customer?.name,
                    plan: plan,
                    subscriptionId: subscriptionId || 'unknown'
                });
            }
        } catch (error) {
            console.error('Error processing payment succeeded webhook:', error);
        }
    },

    // Called when payment fails (works for both first-time and renewal attempts)
    onPaymentFailed: async (payload) => {
        try {
            const data = payload.data as any;
            console.log(`Payment failed: ${data.payment_id}`);

            // Try to find user associated with this payment and send email
            const customerEmail = data.customer?.email;
            if (customerEmail) {
                const user = await db.user.findFirst({
                    where: { email: customerEmail },
                    select: { subscriptionPlan: true }
                });

                // Determine plan from existing user or from payment data
                const billingInterval = data.recurring_pre_tax_amount?.interval ||
                    data.subscription?.billing?.interval ||
                    'month';
                const plan = user?.subscriptionPlan ||
                    (billingInterval === 'year' ? 'yearly' : 'monthly');

                // Send payment failed email (for both first-time and renewal failures)
                await sendPaymentFailedEmail({
                    email: customerEmail,
                    name: data.customer?.name,
                    plan: plan as 'monthly' | 'yearly',
                    reason: data.failure_reason || 'Payment was declined',
                });
            }
        } catch (error) {
            console.error('Error processing payment failed webhook:', error);
        }
    },
});
