/**
 * Manually trigger Dodo webhook for testing
 * Usage: npx tsx scripts/trigger-webhook.ts <event-type> <subscription-id>
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const eventType = process.argv[2];
    const subscriptionId = process.argv[3];

    if (!eventType || !subscriptionId) {
        console.log('Usage: npx tsx scripts/trigger-webhook.ts <event-type> <subscription-id>');
        console.log('\nAvailable events:');
        console.log('  trial_ended    - Trial period ended (no payment)');
        console.log('  expired        - Subscription expired');
        console.log('  payment_failed - Payment failed');
        console.log('\nExample:');
        console.log('  npx tsx scripts/trigger-webhook.ts trial_ended sub_xxxxx');
        process.exit(1);
    }

    // Get user by subscription ID
    const user = await prisma.user.findFirst({
        where: { subscriptionId },
        select: {
            email: true,
            subscriptionStatus: true,
            subscriptionId: true,
        }
    });

    if (!user) {
        console.error(`❌ No user found with subscription ID: ${subscriptionId}`);
        process.exit(1);
    }

    console.log('Found user:', user.email);
    console.log('Current status:', user.subscriptionStatus);

    // Build webhook payload
    const webhookUrl = 'http://localhost:3000/api/webhooks/dodo-payments';

    const payloads: Record<string, any> = {
        trial_ended: {
            event: 'subscription.trial_ended',
            subscription_id: subscriptionId,
            customer: {
                email: user.email,
                customer_id: 'test_customer',
            },
            status: 'expired',
        },
        expired: {
            event: 'subscription.expired',
            subscription_id: subscriptionId,
            customer: {
                email: user.email,
            },
            status: 'expired',
        },
        payment_failed: {
            event: 'payment.failed',
            subscription_id: subscriptionId,
            customer: {
                email: user.email,
            },
            reason: 'Test payment failure',
        },
    };

    const payload = payloads[eventType];
    if (!payload) {
        console.error(`❌ Unknown event type: ${eventType}`);
        console.log('Available:', Object.keys(payloads).join(', '));
        process.exit(1);
    }

    console.log('\n📤 Sending webhook to:', webhookUrl);
    console.log('Event:', payload.event);

    const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'svix-id': 'test_' + Date.now(),
            'svix-timestamp': Math.floor(Date.now() / 1000).toString(),
            'svix-signature': 'test_signature',
        },
        body: JSON.stringify(payload),
    });

    console.log('\n📥 Response:', response.status, response.statusText);

    if (response.ok) {
        console.log('✅ Webhook processed successfully!');

        // Fetch updated user
        const updated = await prisma.user.findFirst({
            where: { subscriptionId },
            select: {
                email: true,
                subscriptionStatus: true,
                subscriptionPlan: true,
                subscriptionEndsAt: true,
            }
        });

        console.log('\n📊 Updated user:');
        console.log('  Status:', updated?.subscriptionStatus);
        console.log('  Plan:', updated?.subscriptionPlan);
        console.log('  Ends:', updated?.subscriptionEndsAt?.toISOString());
    } else {
        console.error('❌ Webhook failed');
        const text = await response.text();
        console.error(text);
    }
}

main()
    .catch((e) => {
        console.error('Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
