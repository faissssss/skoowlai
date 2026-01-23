/**
 * Fast-forward trial expiration for testing
 * Sets subscriptionEndsAt to 1 minute from now
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = process.argv[2];

    if (!email) {
        console.error('Usage: npx tsx scripts/fast-forward-trial.ts <email>');
        process.exit(1);
    }

    // Set trial to expire in 1 minute
    const newEndDate = new Date(Date.now() + 60 * 1000);

    const result = await prisma.user.update({
        where: { email },
        data: {
            subscriptionEndsAt: newEndDate,
        },
        select: {
            email: true,
            subscriptionStatus: true,
            subscriptionPlan: true,
            subscriptionEndsAt: true,
        }
    });

    console.log('✅ Updated subscription:');
    console.log('  Email:', result.email);
    console.log('  Status:', result.subscriptionStatus);
    console.log('  Plan:', result.plan);
    console.log('  Ends At:', result.subscriptionEndsAt?.toISOString());
    console.log('\n⏰ Trial will expire in 1 minute!');
    console.log('  Wait for Dodo webhook or manually trigger subscription.trial_ended');
}

main()
    .catch((e) => {
        console.error('Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
