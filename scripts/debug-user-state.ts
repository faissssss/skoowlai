import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = 'yourskoowlai@gmail.com';
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
