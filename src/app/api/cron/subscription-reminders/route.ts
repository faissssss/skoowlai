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

            // Format as date string for comparison (YYYY-MM-DD)
            const targetDateStr = targetDate.toISOString().split('T')[0];

            // Find users with subscriptions ending on target date
            // This assumes you have a subscriptionEndDate field - if not, we'll need to calculate from subscription creation + plan duration
            const users = await db.user.findMany({
                where: {
                    subscriptionStatus: 'active',
                    // For now, we'll check yearly subscriptions that started approximately 1 year - X days ago
                    // You may want to add a subscriptionEndDate field for accurate tracking
                },
                select: {
                    id: true,
                    email: true,
                    // name: true, // Field does not exist in User model
                    subscriptionPlan: true,
                    subscriptionId: true,
                    createdAt: true,
                }
            });

            for (const user of users) {
                if (!user.email || !user.subscriptionPlan) continue;

                // Calculate approximate end date based on subscription plan
                const startDate = new Date(user.createdAt);
                const endDate = new Date(startDate);
                if (user.subscriptionPlan === 'yearly') {
                    endDate.setFullYear(endDate.getFullYear() + 1);
                } else {
                    endDate.setMonth(endDate.getMonth() + 1);
                }

                // Check if subscription ends on target date
                const endDateStr = endDate.toISOString().split('T')[0];
                if (endDateStr === targetDateStr) {
                    await sendSubscriptionReminderEmail({
                        email: user.email,
                        name: undefined, // name field not available in User model
                        plan: user.subscriptionPlan as 'monthly' | 'yearly',
                        subscriptionId: user.subscriptionId || 'unknown',
                        daysRemaining: days,
                    });
                    emailsSent++;
                    console.log(`Sent ${days}-day reminder to ${user.email}`);
                }
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
