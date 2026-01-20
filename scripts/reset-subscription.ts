import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = 'yourskoowlai@gmail.com';
    console.log(`Resetting subscription for ${email}...`);

    try {
        // First find if user exists
        const existingUser = await prisma.user.findFirst({
            where: { email }
        });

        if (!existingUser) {
            console.log(`❌ User with email ${email} not found.`);
            return;
        }

        const user = await prisma.user.update({
            where: { id: existingUser.id }, // Use ID to be safe
            data: {
                subscriptionStatus: 'free',
                subscriptionPlan: null,
                subscriptionId: null,
                subscriptionEndsAt: null,
            }
        });
        console.log('✅ User reset successfully:', user.email, user.subscriptionStatus);
    } catch (e) {
        console.error('❌ Error resetting user:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
