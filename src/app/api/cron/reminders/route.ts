import { db } from '@/lib/db';
import { sendSubscriptionReminderEmail } from '@/lib/email';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    // Basic authorization using a secret query param or header (for cron job security)
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const today = new Date();
        const threeDaysFromNow = new Date(today);
        threeDaysFromNow.setDate(today.getDate() + 3);

        // Normalize time to start of day for comparison
        threeDaysFromNow.setHours(0, 0, 0, 0);
        const fourDaysFromNow = new Date(threeDaysFromNow);
        fourDaysFromNow.setDate(fourDaysFromNow.getDate() + 1);

        console.log(`[Reminders] Checking for expirations between ${threeDaysFromNow.toISOString()} and ${fourDaysFromNow.toISOString()}`);

        // Find subscriptions ending in 3 days
        const usersToRemind = await db.user.findMany({
            where: {
                subscriptionStatus: { in: ['active', 'trialing'] },
                subscriptionEndsAt: {
                    gte: threeDaysFromNow,
                    lt: fourDaysFromNow
                },
                email: { not: undefined } // Ensure email exists
            }
        });

        console.log(`[Reminders] Found ${usersToRemind.length} users to remind`);

        const results = await Promise.allSettled(usersToRemind.map(async (user) => {
            if (!user.email) return;

            const isTrial = user.subscriptionStatus === 'trialing';
            const plan = (user.subscriptionPlan === 'annual' || user.subscriptionPlan === 'yearly') ? 'yearly' : 'monthly';

            await sendSubscriptionReminderEmail({
                email: user.email,
                name: 'there', // We don't store first name in DB currently unless user updated it
                plan,
                daysRemaining: 3,
                isTrial
            });

            return user.email;
        }));

        const sentCount = results.filter(r => r.status === 'fulfilled').length;

        return NextResponse.json({
            success: true,
            remindersSent: sentCount,
            totalFound: usersToRemind.length
        });

    } catch (error) {
        console.error('[Reminders] Error sending reminders:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
