import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

/**
 * Legacy: Sync subscription status from Clerk Billing to local database
 *
 * Current: Subscriptions are managed via Dodo Payments webhooks and stored in our DB.
 * This endpoint is kept as a harmless no-op for the UI which calls it before fetching `/api/subscription`.
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

        const user = await db.user.findUnique({
            where: { clerkId: userId },
            select: {
                subscriptionStatus: true,
                subscriptionPlan: true,
                subscriptionEndsAt: true,
                subscriptionId: true,
            },
        });

        return NextResponse.json({
            success: true,
            status: user?.subscriptionStatus ?? 'free',
            plan: user?.subscriptionPlan ?? null,
            subscriptionEndsAt: user?.subscriptionEndsAt ?? null,
            subscriptionId: user?.subscriptionId ?? null,
            source: 'db',
        });

    } catch (error) {
        console.error('[Sync] Error syncing subscription:', error);
        return NextResponse.json(
            { error: 'Failed to sync subscription' },
            { status: 500 }
        );
    }
}
