import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

/**
 * Sync subscription status from Clerk Billing to local database
 * This ensures our database matches Clerk's source of truth
 */
export async function POST() {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Initialize Clerk client
        const client = await clerkClient();

        // Get subscription from Clerk Billing API
        let clerkSubscription;
        try {
            clerkSubscription = await client.billing.getUserBillingSubscription(userId);
        } catch (err: any) {
            // If no subscription found, user is on free plan
            console.log('[Sync] No Clerk subscription found for user:', userId);
            clerkSubscription = null;
        }

        // Map Clerk status to our status
        let subscriptionStatus = 'free';
        let subscriptionPlan: string | null = null;
        let subscriptionEndsAt: Date | null = null;
        let subscriptionId: string | null = null;

        if (clerkSubscription) {
            // Cast to any because Clerk Billing types are incomplete (beta)
            const sub = clerkSubscription as any;
            subscriptionId = sub.id;

            switch (sub.status) {
                case 'active':
                    subscriptionStatus = 'active';
                    break;
                case 'trialing':
                    subscriptionStatus = 'trialing';
                    break;
                case 'canceled':
                    subscriptionStatus = 'cancelled';
                    break;
                case 'past_due':
                    subscriptionStatus = 'active'; // Grace period
                    break;
                case 'ended':
                case 'expired':
                    subscriptionStatus = 'free';
                    break;
                default:
                    subscriptionStatus = 'free';
            }

            // Get plan from subscription items
            const activeItem = (sub.plans || sub.items)?.find(
                (item: any) => item.id && item.slug !== 'free_user'
            );
            if (activeItem) {
                subscriptionPlan = activeItem.interval === 'annual' ? 'yearly' : 'monthly';
            }

            // Get period end date
            if (sub.periodEnd || sub.period_end) {
                subscriptionEndsAt = new Date(sub.periodEnd || sub.period_end);
            }
        }

        // Update database to match Clerk
        await db.user.update({
            where: { clerkId: userId },
            data: {
                subscriptionStatus,
                subscriptionPlan,
                subscriptionEndsAt,
                subscriptionId,
            }
        });

        console.log(`[Sync] Updated user ${userId}: status=${subscriptionStatus}, plan=${subscriptionPlan}`);

        return NextResponse.json({
            success: true,
            status: subscriptionStatus,
            plan: subscriptionPlan,
            subscriptionEndsAt,
        });

    } catch (error) {
        console.error('[Sync] Error syncing subscription:', error);
        return NextResponse.json(
            { error: 'Failed to sync subscription' },
            { status: 500 }
        );
    }
}
