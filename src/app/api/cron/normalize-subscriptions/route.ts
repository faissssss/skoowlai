import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Small cron job to normalize long-expired subscriptions back to "free" status.
// This keeps status labels aligned with how access is interpreted (expired ≈ free).
// Configure with a daily cron, e.g.:
// { "path": "/api/cron/normalize-subscriptions", "schedule": "0 5 * * *" }

const DAYS_BEFORE_FREE = 7;

export async function GET(req: NextRequest) {
    // Verify cron secret to prevent unauthorized access
    const authHeader = req.headers.get('authorization');
    const querySecret = req.nextUrl.searchParams.get('secret');
    const cronSecret = process.env.CRON_SECRET;
    const isProd = process.env.NODE_ENV === 'production';

    if (isProd && !cronSecret) {
        return NextResponse.json(
            { error: 'CRON_SECRET not configured' },
            { status: 500 }
        );
    }

    // Allow authentication via header OR query parameter
    const hasSecret = Boolean(cronSecret);
    const isAuthorized = !hasSecret
        ? !isProd
        : (authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret);

    if (!isAuthorized) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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


