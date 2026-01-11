import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendSubscriptionReminderEmail } from '@/lib/email';

// This endpoint should be triggered by a cron job (e.g., Vercel Cron)
// Configure in vercel.json: { "crons": [{ "path": "/api/cron/subscription-reminders", "schedule": "0 9 * * *" }] }

export async function GET(req: NextRequest) {
    // Verify cron secret to prevent unauthorized access
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const today = new Date();

        // Find users whose subscriptions expire in 3 or 7 days
        const reminderDays = [3, 7];
        let emailsSent = 0;

        for (const days of reminderDays) {
            const targetDate = new Date(today);
            targetDate.setDate(targetDate.getDate() + days);

            // Set to start of day for comparison
            targetDate.setHours(0, 0, 0, 0);
            const targetDateEnd = new Date(targetDate);
            targetDateEnd.setHours(23, 59, 59, 999);

            // Find users whose subscriptions end on target date
            const users = await db.user.findMany({
                where: {
                    subscriptionStatus: 'active',
                    subscriptionEndsAt: {
                        gte: targetDate,
                        lte: targetDateEnd,
                    },
                },
                select: {
                    id: true,
                    email: true,
                    subscriptionPlan: true,
                    subscriptionId: true,
                    subscriptionEndsAt: true,
                }
            });

            for (const user of users) {
                if (!user.email || !user.subscriptionPlan) continue;

                await sendSubscriptionReminderEmail({
                    email: user.email,
                    name: undefined,
                    plan: user.subscriptionPlan as 'monthly' | 'yearly',
                    subscriptionId: user.subscriptionId || 'unknown',
                    daysRemaining: days,
                });
                emailsSent++;
                console.log(`Sent ${days}-day reminder to ${user.email}`);
            }
        }

        return NextResponse.json({
            success: true,
            emailsSent,
            message: `Sent ${emailsSent} reminder emails`
        });
    } catch (error) {
        console.error('Error processing subscription reminders:', error);
        return NextResponse.json(
            { error: 'Failed to process reminders' },
            { status: 500 }
        );
    }
}
