import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { dodoClient } from '@/lib/dodo';
import { checkCsrfOrigin } from '@/lib/csrf';

type Plan = 'monthly' | 'yearly';
type SubStatus = 'free' | 'active' | 'cancelled' | 'on_hold' | 'expired' | 'trialing';

function normStr(v: unknown): string | null {
    return typeof v === 'string' ? v.toLowerCase() : null;
}

function intervalToPlan(interval: string | null): Plan | null {
    if (!interval) return null;
    if (/(year|annual|annually|yr)/.test(interval)) return 'yearly';
    if (/(month|mo)/.test(interval)) return 'monthly';
    return null;
}

function mapDodoStatus(s: string | null): SubStatus | null {
    if (!s) return null;
    const v = s.toLowerCase();
    if (v === 'active' || v === 'on') return 'active';
    if (v === 'pending' || v === 'trialing' || v === 'trial_started') return 'trialing';
    if (v === 'cancelled' || v === 'canceled') return 'cancelled';
    if (v === 'expired') return 'expired';
    if (v === 'on_hold' || v === 'paused') return 'on_hold';
    return null;
}

function parseDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'number') {
        const ms = value < 1e12 ? value * 1000 : value;
        const d = new Date(ms);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof value === 'string') {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
}

/**
 * Find the most relevant subscription for a customer by scanning all subs.
 * Preference: active > trialing > pending > on_hold, and yearly over monthly.
 */
async function findPreferredSubscriptionByCustomer(customerId: string): Promise<any | null> {
    const sdk: any = dodoClient as any;
    if (!sdk?.subscriptions?.list) return null;

    let best: any = null;
    const score = (sub: any) => {
        const status = normStr(sub?.status) || '';
        let s = 0;
        if (status === 'active') s += 100;
        else if (status === 'trialing' || status === 'trial_started') s += 90;
        else if (status === 'pending') s += 80;
        else if (status === 'on_hold') s += 50;

        const interval = normStr(
            sub?.payment_frequency_interval ||
            sub?.subscription_period_interval ||
            sub?.plan?.interval
        ) || '';
        if (interval.includes('year')) s += 10;

        const nb = sub?.next_billing_date ? Date.parse(sub.next_billing_date) : 0;
        const cr = sub?.created_at ? Date.parse(sub.created_at) : 0;
        return s + Math.floor(nb / 1e5) + Math.floor(cr / 1e6);
    };

    try {
        for await (const item of sdk.subscriptions.list()) {
            const sub = item;
            const cid =
                sub?.customer?.customer_id ?? sub?.customer_id ?? sub?.customerId ?? null;
            if (cid !== customerId) continue;

            const st = normStr(sub?.status) || '';
            if (['cancelled', 'canceled', 'expired'].includes(st)) continue;

            if (!best || score(sub) > score(best)) best = sub;
        }
    } catch {
        return null;
    }
    return best;
}

/**
 * Pulls authoritative subscription info from Dodo and reconciles local DB for the current user.
 * - Updates subscriptionPlan (monthly/yearly) using interval or billing period length
 * - Updates subscriptionEndsAt from next_billing_date
 * - Backfills customerId if missing
 * - Optionally aligns status when a clear mapping exists
 */
export async function reconcileFromDodo(userClerkId: string) {
    const user = await db.user.findUnique({
        where: { clerkId: userClerkId },
        select: {
            id: true,
            email: true,
            subscriptionStatus: true,
            subscriptionPlan: true,
            subscriptionEndsAt: true,
            subscriptionId: true,
            customerId: true,
            paymentGracePeriodEndsAt: true,
        },
    });

    if (!user) {
        return {
            success: true,
            status: 'free' as SubStatus,
            plan: null as Plan | null,
            subscriptionEndsAt: null as Date | null,
            subscriptionId: null as string | null,
            source: 'db',
        };
    }

    if (!user.subscriptionId && !user.customerId) {
        // Nothing to reconcile without a subscriptionId or customerId
        return {
            success: true,
            status: user.subscriptionStatus as SubStatus,
            plan: (user.subscriptionPlan as Plan | null) ?? null,
            subscriptionEndsAt: user.subscriptionEndsAt ?? null,
            subscriptionId: null,
            source: 'db',
        };
    }

    // Attempt remote retrieval (if we have subscriptionId)
    let sub: any = null;
    let selectedSub: any = null;
    if (user.subscriptionId) {
        try {
            sub = await dodoClient.subscriptions?.retrieve?.(user.subscriptionId);
            selectedSub = sub;
        } catch (e) {
            console.warn('[Sync] Failed to retrieve subscription from Dodo:', e);
        }
    }

    // Compute desired values based on selectedSub
    let nextPlan: Plan | null = null;
    if (selectedSub) {
        nextPlan =
            intervalToPlan(normStr(selectedSub?.payment_frequency_interval)) ||
            intervalToPlan(normStr(selectedSub?.subscription_period_interval)) ||
            intervalToPlan(normStr(selectedSub?.plan?.interval)) ||
            null;

        if (!nextPlan) {
            // Derive from billing dates if interval not present
            try {
                const next = selectedSub?.next_billing_date ? new Date(selectedSub.next_billing_date) : null;
                const prev = selectedSub?.previous_billing_date ? new Date(selectedSub.previous_billing_date) : null;
                if (next && prev) {
                    const days = (next.getTime() - prev.getTime()) / 86400000;
                    if (days > 300) nextPlan = 'yearly';
                    else if (days <= 60) nextPlan = 'monthly';
                }
            } catch {
                // ignore
            }
        }
    }

    // If we have a customerId, look for a more preferred subscription (e.g., newly created yearly)
    if (user.customerId) {
        const preferred = await findPreferredSubscriptionByCustomer(user.customerId);
        if (preferred && preferred.subscription_id && preferred.subscription_id !== user.subscriptionId) {
            selectedSub = preferred;

            nextPlan =
                intervalToPlan(normStr(selectedSub?.payment_frequency_interval)) ||
                intervalToPlan(normStr(selectedSub?.subscription_period_interval)) ||
                intervalToPlan(normStr(selectedSub?.plan?.interval)) ||
                nextPlan;

            // Derive again if still unknown
            if (!nextPlan) {
                try {
                    const next = selectedSub?.next_billing_date ? new Date(selectedSub.next_billing_date) : null;
                    const prev = selectedSub?.previous_billing_date ? new Date(selectedSub.previous_billing_date) : null;
                    if (next && prev) {
                        const days = (next.getTime() - prev.getTime()) / 86400000;
                        if (days > 300) nextPlan = 'yearly';
                        else if (days <= 60) nextPlan = 'monthly';
                    }
                } catch { }
            }
        }
    }

    if (!selectedSub) {
        return {
            success: true,
            status: user.subscriptionStatus as SubStatus,
            plan: (user.subscriptionPlan as Plan | null) ?? null,
            subscriptionEndsAt: user.subscriptionEndsAt ?? null,
            subscriptionId: user.subscriptionId ?? null,
            source: 'db',
        };
    }

    const nextEndsAt: Date | null = selectedSub?.next_billing_date ? new Date(selectedSub.next_billing_date) : null;
    const nextCustomerId: string | null =
        selectedSub?.customer?.customer_id ?? selectedSub?.customer_id ?? selectedSub?.customerId ?? null;
    const dodoStatus: SubStatus | null = mapDodoStatus(normStr(selectedSub?.status));

    // If user locally cancelled a trial immediately (EndsAt ~ now), do not let remote "trialing/active"
    // resurrect status or future endsAt. Allow only remote cancelled/expired to tighten state.
    const now = new Date();
    const immediateLocalCancel =
        (user.subscriptionStatus === 'cancelled') &&
        !!user.subscriptionEndsAt &&
        (user.subscriptionEndsAt.getTime() <= now.getTime() + 2 * 60 * 1000); // 2 min skew

    // Build minimal update with guards
    const update: Record<string, any> = {};

    // Always allow customerId backfill
    if (nextCustomerId && nextCustomerId !== user.customerId) update.customerId = nextCustomerId;

    // Only override identifiers/plan/dates if NOT an immediate local cancel
    if (!immediateLocalCancel) {
        if (selectedSub?.subscription_id && selectedSub.subscription_id !== user.subscriptionId) {
            update.subscriptionId = selectedSub.subscription_id;
        }
        if (nextPlan && nextPlan !== user.subscriptionPlan) update.subscriptionPlan = nextPlan;
        if (nextEndsAt && String(user.subscriptionEndsAt) !== String(nextEndsAt)) {
            update.subscriptionEndsAt = nextEndsAt;
        }
    }

    // Status override rules:
    // - Normal: accept any mapped remote status
    // - Immediate local cancel: only accept remote 'cancelled' or 'expired'
    // - Scheduled cancel: preserve local 'cancelled' even if remote shows 'active' with cancel_at_next_billing_date
    // - Trial: preserve local 'trialing' if remote shows 'active' (Dodo sends active for trials)
    const scheduledCancel = selectedSub?.cancel_at_next_billing_date === true;

    if (dodoStatus && dodoStatus !== (user.subscriptionStatus as SubStatus)) {
        // PROTECTION 1: Don't override local 'cancelled' with remote 'active' if Dodo has scheduled cancel
        if (user.subscriptionStatus === 'cancelled' && dodoStatus === 'active' && scheduledCancel) {
            console.log('[Sync] Preserving local cancelled status (Dodo has cancel_at_next_billing_date=true)');
        }
        // PROTECTION 2: Don't override local 'trialing' with remote 'active' (Dodo trials are 'active' until end)
        else if (user.subscriptionStatus === 'trialing' && dodoStatus === 'active') {
            console.log('[Sync] Preserving local trialing status (Dodo reports active for trials)');
        }
        else if (!immediateLocalCancel || dodoStatus === 'cancelled' || dodoStatus === 'expired') {
            update.subscriptionStatus = dodoStatus;
        }
    }

    if (dodoStatus === 'on_hold') {
        const graceFromSub = parseDate(
            selectedSub?.payment_grace_period_ends_at ??
            selectedSub?.grace_period_ends_at ??
            selectedSub?.grace_period_end ??
            selectedSub?.retry_until ??
            selectedSub?.payment_retry_until ??
            selectedSub?.payment_retry_ends_at ??
            selectedSub?.payment_failure_grace_period_ends_at
        );
        const fallbackGrace = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        if (!user.paymentGracePeriodEndsAt || user.paymentGracePeriodEndsAt.getTime() < now.getTime()) {
            update.paymentGracePeriodEndsAt = graceFromSub ?? fallbackGrace;
        }
    } else if (dodoStatus && user.paymentGracePeriodEndsAt) {
        update.paymentGracePeriodEndsAt = null;
    }

    let updated = user;
    if (Object.keys(update).length > 0) {
        updated = await db.user.update({
            where: { id: user.id },
            data: update,
            select: {
                id: true,
                email: true,
                subscriptionStatus: true,
                subscriptionPlan: true,
                subscriptionEndsAt: true,
                subscriptionId: true,
                customerId: true,
            },
        });
    }

    return {
        success: true,
        status: updated.subscriptionStatus as SubStatus,
        plan: updated.subscriptionPlan as Plan | null,
        subscriptionEndsAt: updated.subscriptionEndsAt ?? null,
        subscriptionId: updated.subscriptionId ?? null,
        source: sub ? 'dodo' : 'db',
    };
}

export async function POST(req: NextRequest) {
    try {
        const csrfError = checkCsrfOrigin(req);
        if (csrfError) return csrfError;

        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const result = await reconcileFromDodo(userId);
        return NextResponse.json(result);
    } catch (error) {
        console.error('[Sync] Error syncing subscription:', error);
        return NextResponse.json({ error: 'Failed to sync subscription' }, { status: 500 });
    }
}

// Convenience GET so you can open it in browser while testing via ngrok
export async function GET(req: NextRequest) {
    try {
        const csrfError = checkCsrfOrigin(req);
        if (csrfError) return csrfError;

        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const result = await reconcileFromDodo(userId);
        return NextResponse.json(result);
    } catch (error) {
        console.error('[Sync][GET] Error syncing subscription:', error);
        return NextResponse.json({ error: 'Failed to sync subscription' }, { status: 500 });
    }
}
