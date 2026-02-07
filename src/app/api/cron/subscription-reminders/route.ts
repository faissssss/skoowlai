import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendSubscriptionReminderEmail } from '@/lib/email';
import { sendEmailWithIdempotency, generateEmailIdempotencyKey } from '@/lib/emailIdempotency';

// This endpoint should be triggered by a cron job (e.g., Vercel Cron)
// Configure in vercel.json: { "crons": [{ "path": "/api/cron/subscription-reminders", "schedule": "0 9 * * *" }] }

export async function GET(req: NextRequest) {
    // Verify cron secret to prevent unauthorized access
    const authHeader = req.headers.get('authorization');
    const querySecret = req.nextUrl.searchParams.get('secret');
    const cronSecret = process.env.CRON_SECRET;

    // Allow authentication via header OR query parameter
    const isAuthorized =
        !cronSecret ||
        authHeader === `Bearer ${cronSecret}` ||
        querySecret === cronSecret;

    if (!isAuthorized) {
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
                    subscriptionStatus: { in: ['active', 'trialing'] },
                    subscriptionEndsAt: {
                        gte: targetDate,
                        lte: targetDateEnd,
                    },
                },
                select: {
                    id: true,
                    email: true,
                    subscriptionStatus: true,
                    subscriptionPlan: true,
                    subscriptionId: true,
                    subscriptionEndsAt: true,
                }
            });

            for (const user of users) {
                if (!user.email || !user.subscriptionPlan) continue;

                const isTrial = user.subscriptionStatus === 'trialing';
                const dateKey = targetDate.toISOString().slice(0, 10);
                const uniqueId = `${user.subscriptionId || user.id}:${days}:${dateKey}`;
                const emailType: 'trial_ending' | 'reminder' = isTrial ? 'trial_ending' : 'reminder';
                const idempotencyKey = generateEmailIdempotencyKey(emailType, uniqueId);

                const sent = await sendEmailWithIdempotency(
                    idempotencyKey,
                    emailType,
                    user.email,
                    () =>
                        sendSubscriptionReminderEmail({
                            email: user.email,
                            name: undefined,
                            plan: user.subscriptionPlan as 'monthly' | 'yearly',
                            subscriptionId: user.subscriptionId || 'unknown',
                            daysRemaining: days,
                            isTrial: isTrial,
                        })
                );

                if (sent) {
                    emailsSent++;
                    console.log(`Sent ${days}-day ${isTrial ? 'trial' : 'renewal'} reminder to ${user.email}`);
                } else {
                    console.log(`Skipped duplicate ${days}-day ${isTrial ? 'trial' : 'renewal'} reminder for ${user.email}`);
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

// Vercel Cron configuration
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 second timeout for email processing

