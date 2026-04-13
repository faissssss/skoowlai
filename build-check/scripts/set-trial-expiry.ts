/**
 * Set Trial Expiry Helper
 * Usage: npx tsx scripts/set-trial-expiry.ts <days-from-now> <email>
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const days = parseFloat(process.argv[2]);
    const email = process.argv[3];

    if (isNaN(days)) {
        console.error('Usage: npx tsx scripts/set-trial-expiry.ts <days> [email]');
        console.log('Example: npx tsx scripts/set-trial-expiry.ts 3 my@email.com');
        process.exit(1);
    }

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);

    // Reset to generic time to match CRON window (CRON checks current day match)
    // Actually our CRON looks for expiration == target date (full day window)

    const where = email ? { email } : { subscriptionStatus: 'trialing' };

    console.log(`Setting expiration to ${targetDate.toISOString()} (${days} days from now)...`);

    const result = await prisma.user.updateMany({
        where: where,
        data: {
            subscriptionEndsAt: targetDate,
            subscriptionStatus: 'trialing' // Ensure it's trialing so CRON picks it up
        }
    });

    console.log(`✅ Updated ${result.count} users.`);
    console.log('Ready to run: npx tsx scripts/test-cron.ts');
}

main()
    .catch((e) => {
        console.error('Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
