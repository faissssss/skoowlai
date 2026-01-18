import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@clerk/nextjs/server';

/**
 * Check if user is eligible for a free trial
 * Returns { eligible: boolean } based on whether they've used a trial before
 */
export async function GET() {
    const { userId } = await auth();

    if (!userId) {
        // Not logged in - assume eligible (will check again on actual subscription)
        return NextResponse.json({ eligible: true });
    }

    try {
        const user = await db.user.findUnique({
            where: { clerkId: userId },
            select: { trialUsedAt: true }
        });

        if (!user) {
            // User not found in DB - eligible
            return NextResponse.json({ eligible: true });
        }

        // User is eligible if they haven't used a trial
        const eligible = user.trialUsedAt === null;
        return NextResponse.json({ eligible });
    } catch (error) {
        console.error('Error checking trial eligibility:', error);
        // On error, default to eligible (fail open for UX)
        return NextResponse.json({ eligible: true });
    }
}
