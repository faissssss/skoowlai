import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

async function main() {
    const email = 'yourskoowlai@gmail.com';
    console.log(`Checking Clerk subscription for ${email}...`);

    if (!CLERK_SECRET_KEY) {
        console.error('CLERK_SECRET_KEY missing');
        return;
    }

    try {
        const user = await prisma.user.findFirst({
            where: { email },
            select: { clerkId: true }
        });

        if (!user) {
            console.log('User not in DB');
            return;
        }

        // 1. Get User from Clerk to see if we can find subscription ID
        // Clerk Users don't always have sub ID directly exposed easily in API, 
        // but we can list subscriptions for the user?
        // Actually Clerk Backend API has `GET /subscriptions?user_id=...`? 
        // No, usually it's `GET /users/{user_id}/oauth_access_tokens` etc.
        // For Clerk Billing (Stripe wrapper), it might be different.

        // Let's try listing subscriptions if endpoint exists, or check user "private_metadata" or similar.
        // Or just GET user and inspect.

        const userResp = await fetch(`https://api.clerk.com/v1/users/${user.clerkId}`, {
            headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` }
        });
        const userData = await userResp.json();
        console.log('--- Clerk User Data (Partial) ---');
        console.log('ID:', userData.id);
        console.log('Public Meta:', userData.public_metadata);
        console.log('Private Meta:', userData.private_metadata);

        // Check for subscriptions?
        // If Clerk Billing is enabled, maybe we can fetch subscriptions list?
        // API: https://clerk.com/docs/reference/backend-api/tag/Subscriptions
        // GET /v1/subscriptions?user_id={...}

        // Note: This endpoint might not be public or stable if it's new Billing. 
        // But let's try.

        /* 
           Actually, if we can't hit that, we rely on what we see in the webhook logs. 
           But let's try to see if we can get it.
        */

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
