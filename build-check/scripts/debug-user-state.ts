import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = process.env.DEBUG_USER_EMAIL || process.argv[2];
    
    if (!email) {
        console.error('❌ Missing required argument: email');
        console.log('\nUsage:');
        console.log('  npx tsx scripts/debug-user-state.ts <email>');
        console.log('\nOr set environment variable:');
        console.log('  DEBUG_USER_EMAIL=user@example.com');
        console.log('  npx tsx scripts/debug-user-state.ts');
        process.exit(1);
    }
    
    console.log(`Checking status for ${email}...`);

    try {
        const user = await prisma.user.findFirst({
            where: { email },
            select: {
                id: true,
                clerkId: true,
                email: true,
                subscriptionStatus: true,
                subscriptionPlan: true,
                subscriptionEndsAt: true,
                createdAt: true
            }
        });

        if (!user) {
            console.log(`❌ User ${email} not found.`);
        } else {
            console.log('✅ User found:');
            console.table(user);
        }

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
