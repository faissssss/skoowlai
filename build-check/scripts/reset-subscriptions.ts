/**
 * Reset All Subscriptions Script
 * 
 * Resets all users to free plan by clearing subscription fields
 * Useful for testing subscription workflows
 * 
 * Usage:
 *   npx tsx scripts/reset-subscriptions.ts          # Dry run (preview)
 *   npx tsx scripts/reset-subscriptions.ts --commit # Actually reset
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const args = process.argv.slice(2);
    const isCommit = args.includes('--commit');

    console.log('🔍 Fetching all users with subscriptions...\n');

    // Find all users with any subscription data
    const users = await prisma.user.findMany({
        where: {
            OR: [
                { subscriptionStatus: { not: 'free' } },
                { subscriptionPlan: { not: null } },
                { subscriptionId: { not: null } },
                { customerId: { not: null } },
                { trialUsedAt: { not: null } },
            ]
        },
        select: {
            id: true,
            email: true,
            subscriptionStatus: true,
            subscriptionPlan: true,
            subscriptionId: true,
            customerId: true,
            trialUsedAt: true,
            subscriptionEndsAt: true,
            paymentGracePeriodEndsAt: true,
        }
    });

    console.log(`Found ${users.length} users with subscription data:\n`);

    // Display users
    users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email}`);
        console.log(`   Status: ${user.subscriptionStatus || 'null'}`);
        console.log(`   Plan: ${user.subscriptionPlan || 'null'}`);
        console.log(`   Trial Used: ${user.trialUsedAt ? user.trialUsedAt.toISOString() : 'null'}`);
        console.log(`   Subscription ID: ${user.subscriptionId || 'null'}`);
        console.log('');
    });

    if (users.length === 0) {
        console.log('✅ No users with subscription data found. Database is already clean.');
        return;
    }

    if (!isCommit) {
        console.log('⚠️  DRY RUN MODE - No changes will be made');
        console.log('   To actually reset subscriptions, run:');
        console.log('   npx tsx scripts/reset-subscriptions.ts --commit\n');
        return;
    }

    console.log('⚠️  COMMIT MODE - Resetting all subscriptions...\n');

    // Reset all users to free plan
    const result = await prisma.user.updateMany({
        where: {
            OR: [
                { subscriptionStatus: { not: 'free' } },
                { subscriptionPlan: { not: null } },
                { subscriptionId: { not: null } },
            ]
        },
        data: {
            subscriptionStatus: 'free',
            subscriptionPlan: null,
            subscriptionId: null,
            customerId: null,
            subscriptionEndsAt: null,
            trialUsedAt: null,
            paymentGracePeriodEndsAt: null,
        }
    });

    console.log(`✅ Successfully reset ${result.count} users to free plan\n`);
    console.log('All subscription fields cleared:');
    console.log('  - subscriptionStatus → "free"');
    console.log('  - subscriptionPlan → null');
    console.log('  - subscriptionId → null');
    console.log('  - customerId → null');
    console.log('  - subscriptionEndsAt → null');
    console.log('  - trialUsedAt → null (users can trial again)');
    console.log('  - paymentGracePeriodEndsAt → null');
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
