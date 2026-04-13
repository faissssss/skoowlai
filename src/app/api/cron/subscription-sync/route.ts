import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { reconcileFromDodo } from '@/app/api/subscription/sync/route';
import { verifyCronAuth } from '@/lib/cron-auth';

// Periodic authoritative sync against Dodo for all users with non-free subscriptions.
// Intended to self-heal when webhooks are delayed or lost.
//
// Configure in vercel.json (example):
// {
//   "crons": [
//     { "path": "/api/cron/subscription-sync", "schedule": "0 * * * *" }
//   ]
// }

const BATCH_LIMIT = 250;

export async function GET(req: NextRequest) {
  // SECURITY: Verify cron authentication (header-only, no query params)
  const auth = verifyCronAuth(req);
  if (!auth.authorized) return auth.response;

  try {
    const users = await db.user.findMany({
      where: {
        OR: [
          {
            subscriptionStatus: {
              in: ['trialing', 'active', 'cancelled', 'on_hold', 'expired'],
            },
          },
          {
            subscriptionId: {
              not: null,
            },
          },
          {
            customerId: {
              not: null,
            },
          },
        ],
      },
      select: {
        id: true,
        clerkId: true,
        subscriptionStatus: true,
        subscriptionId: true,
      },
      take: BATCH_LIMIT,
    });

    if (users.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No users requiring subscription sync',
      });
    }

    const results: Array<{
      userId: string;
      clerkId: string | null;
      ok: boolean;
      error?: string;
      source?: string;
      status?: string;
      plan?: string | null;
    }> = [];

    for (const user of users) {
      if (!user.clerkId) {
        results.push({
          userId: user.id,
          clerkId: null,
          ok: false,
          error: 'missing_clerk_id',
        });
        continue;
      }

      try {
        const res = await reconcileFromDodo(user.clerkId);
        results.push({
          userId: user.id,
          clerkId: user.clerkId,
          ok: true,
          source: res.source,
          status: res.status,
          plan: res.plan,
        });
      } catch (e: any) {
        results.push({
          userId: user.id,
          clerkId: user.clerkId,
          ok: false,
          error: e?.message ?? 'sync_failed',
        });
      }
    }

    const okCount = results.filter((r) => r.ok).length;

    return NextResponse.json({
      success: true,
      processed: users.length,
      synced: okCount,
      results,
    });
  } catch (error) {
    console.error('[Cron][subscription-sync] Error syncing subscriptions:', error);
    return NextResponse.json(
      { error: 'Failed to run subscription sync cron' },
      { status: 500 },
    );
  }
}

// Vercel Cron configuration
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 second timeout for subscription sync


