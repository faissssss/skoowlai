import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

async function main() {
    const email = 'yourskoowlai@gmail.com';
    console.log(`Searching for user ${email}...`);

    if (!CLERK_SECRET_KEY) {
        console.error('❌ CLERK_SECRET_KEY not found in environment');
        return;
    }

    try {
        // 1. Find user in DB to get Clerk ID
        const user = await prisma.user.findFirst({
            where: { email },
        });

        if (!user) {
            console.log(`⚠️ User ${email} not found in local database.`);
            await deleteFromClerkByEmail(email);
            return;
        }

        const clerkId = user.clerkId;
        console.log(`Found user in DB. Clerk ID: ${clerkId}`);

        // 2. Delete Dependencies (Manual Cascade)
        console.log('Deleting dependent records...');

        // Audit Logs
        await prisma.auditLog.deleteMany({ where: { userId: user.id } });

        // Collaborators
        // (Collaborator points to User)
        await prisma.collaborator.deleteMany({ where: { userId: user.id } });

        // Workspaces
        // Note: Workspaces likely have Decks. If Workspaces don't cascade delete Decks, we must handle Decks first?
        // Decks have `userId` index. Let's delete Decks separately.

        // Decks
        // Decks have many relations (Cards, etc.) which usually Cascade from Deck.
        // But Quiz might not. Just in case, let's be robust.
        // But usually deleting Deck is enough if schema says Cascade.
        // If not, we'd fail on Deck deletion.
        await prisma.deck.deleteMany({ where: { userId: user.id } });

        // Workspaces (after decks, just in case decks link to workspace)
        await prisma.workspace.deleteMany({ where: { userId: user.id } });

        console.log('Dependencies deleted.');

        // 3. Delete User from DB
        await prisma.user.delete({
            where: { id: user.id },
        });
        console.log(`✅ Deleted user from local database.`);

        // 4. Delete from Clerk
        await deleteFromClerk(clerkId);

    } catch (e) {
        console.error('❌ Error during reset:', e);
    } finally {
        await prisma.$disconnect();
    }
}

async function deleteFromClerk(userId: string) {
    console.log(`Deleting user ${userId} from Clerk...`);
    const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
            'Content-Type': 'application/json',
        },
    });

    if (response.ok) {
        console.log(`✅ Deleted user ${userId} from Clerk.`);
    } else {
        // If 404, it's already gone
        if (response.status === 404) {
            console.log(`✅ User ${userId} already deleted from Clerk.`);
        } else {
            console.error(`❌ Failed to delete from Clerk: ${response.status} ${response.statusText}`);
            const body = await response.text();
            console.error(body);
        }
    }
}

async function deleteFromClerkByEmail(email: string) {
    console.log(`Attempting to find user by email ${email} in Clerk...`);
    const searchParams = new URLSearchParams();
    searchParams.append('email_address', email);

    const response = await fetch(`https://api.clerk.com/v1/users?${searchParams.toString()}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        console.error('❌ Failed to search Clerk users');
        return;
    }

    const users = await response.json();
    if (Array.isArray(users) && users.length > 0) {
        const userId = users[0].id;
        console.log(`Found user ${userId} in Clerk. Deleting...`);
        await deleteFromClerk(userId);
    } else {
        console.log(`⚠️ User not found in Clerk.`);
    }
}

main();
