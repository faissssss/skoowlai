import { Webhooks } from "@dodopayments/nextjs";
import { db } from "@/lib/db";
import { sendSubscriptionEmails, sendRenewalEmail, sendPaymentFailedEmail } from "@/lib/email";

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
                // Calculate subscription end date based on plan
                const subscriptionEndsAt = new Date();
                if (plan === 'yearly') {
                    subscriptionEndsAt.setFullYear(subscriptionEndsAt.getFullYear() + 1);
                } else {
                    subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + 1);
                }

                await db.user.updateMany({
                    where: { email: customerEmail },
                    data: {
                        subscriptionStatus: 'active',
                        subscriptionId: subscriptionId,
                        customerId: customerId,
                        subscriptionPlan: plan,
                        subscriptionEndsAt: subscriptionEndsAt,
                    }
                });
                console.log(`Subscription ${isRenewal ? 'renewed' : 'activated'} for ${customerEmail}, ends at ${subscriptionEndsAt.toISOString()}`);

                // Send appropriate email based on new vs renewal
                if (isRenewal) {
                    await sendRenewalEmail({
                        email: customerEmail,
                        name: customerName || undefined,
                        plan: plan as 'monthly' | 'yearly',
                        nextRenewalDate: subscriptionEndsAt,
                    });
                } else {
                    await sendSubscriptionEmails({
                        email: customerEmail,
                        name: customerName || undefined,
                        plan: plan as 'monthly' | 'yearly',
                        subscriptionId: subscriptionId || 'unknown',
                    });
                }
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
                    select: { email: true, subscriptionPlan: true }
                });

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
        const data = payload.data as any;
        console.log(`Payment succeeded: ${data.payment_id}`);
    },

    // Called when payment fails
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

                if (user?.subscriptionPlan) {
                    await sendPaymentFailedEmail({
                        email: customerEmail,
                        name: data.customer?.name,
                        plan: user.subscriptionPlan as 'monthly' | 'yearly',
                        reason: data.failure_reason || 'Payment was declined',
                    });
                }
            }
        } catch (error) {
            console.error('Error processing payment failed webhook:', error);
        }
    },
});

