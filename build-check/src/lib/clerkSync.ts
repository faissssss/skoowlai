import { clerkClient } from '@clerk/nextjs/server';

/**
 * Sync subscription data from Dodo to Clerk user metadata
 * This updates Clerk's user metadata so the UserProfile billing section shows correct data
 */
export async function syncSubscriptionToClerk(
    clerkId: string,
    data: {
        status: string;
        plan?: string | null;
        subscriptionId?: string | null;
        customerId?: string | null;
        subscriptionEndsAt?: Date | null;
    }
) {
    try {
        const client = await clerkClient();
        
        // Build subscription metadata for Clerk
        const subscriptionMeta: Record<string, string | number | null> = {
            status: data.status,
            plan: data.plan || null,
            subscription_id: data.subscriptionId || null,
            customer_id: data.customerId || null,
        };

        // Add end date if exists
        if (data.subscriptionEndsAt) {
            subscriptionMeta.current_period_end = data.subscriptionEndsAt.getTime() / 1000; // Unix timestamp
        }

        // Update Clerk user metadata
        await client.users.updateUser(clerkId, {
            publicMetadata: {
                subscription: subscriptionMeta,
            },
        });

        console.log(`✅ Synced subscription to Clerk for user ${clerkId}:`, subscriptionMeta);
        return true;
    } catch (error) {
        console.error(`❌ Failed to sync subscription to Clerk for user ${clerkId}:`, error);
        return false;
    }
}

/**
 * Remove subscription data from Clerk user metadata
 */
export async function clearClerkSubscription(clerkId: string) {
    try {
        const client = await clerkClient();
        
        await client.users.updateUser(clerkId, {
            publicMetadata: {
                subscription: null,
            },
        });

        console.log(`✅ Cleared subscription from Clerk for user ${clerkId}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to clear subscription from Clerk for user ${clerkId}:`, error);
        return false;
    }
}
