import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyCronAuth } from '@/lib/cron-auth';

// Small cron job to normalize long-expired subscriptions back to "free" status.
// This keeps status labels aligned with how access is interpreted (expired ≈ free).
// Configure with a daily cron, e.g.:
// { "path": "/api/cron/normalize-subscriptions", "schedule": "0 5 * * *" }

const DAYS_BEFORE_FREE = 7;

export async function GET(req: NextRequest) {
    // SECURITY: Verify cron authentication (header-only, no query params)
    const auth = verifyCronAuth(req);
    if (!auth.authorized) return auth.response;

    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - DAYS_BEFORE_FREE);

    try {
        // Find users whose subscriptions have been expired for at least DAYS_BEFORE_FREE days
        const candidates = await db.user.findMany({
            where: {
                subscriptionStatus: 'expired',
                subscriptionEndsAt: {
                    not: null,
                    lt: cutoff,
                },
            },
            select: {
                id: true,
                subscriptionEndsAt: true,
            },
        });

        const ids = candidates.map((u) => u.id);

        if (ids.length === 0) {
            return NextResponse.json({
                success: true,
                updatedCount: 0,
                message: 'No expired subscriptions to normalize',
            });
        }

        const result = await db.user.updateMany({
            where: { id: { in: ids } },
            data: {
                subscriptionStatus: 'free',
                subscriptionPlan: null,
                subscriptionId: null,
                subscriptionEndsAt: null,
            },
        });

        return NextResponse.json({
            success: true,
            updatedCount: result.count,
            normalizedUserIds: ids,
        });
    } catch (error) {
        console.error('Error normalizing subscriptions:', error);
        return NextResponse.json(
            { error: 'Failed to normalize subscriptions' },
            { status: 500 },
        );
    }
}

// Vercel Cron configuration
export const runtime = 'nodejs';
export const maxDuration = 30; // 30 second timeout


