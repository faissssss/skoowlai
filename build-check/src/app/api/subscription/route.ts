import { NextResponse } from 'next/server';
import { getUserSubscription } from '@/lib/subscription';

export async function GET() {
    try {
        const subscription = await getUserSubscription();
        console.log('[Subscription API] Status:', subscription.status, 'isActive:', subscription.isActive, 'isPro:', subscription.isPro);
        return NextResponse.json({
            status: subscription.status,
            plan: subscription.plan,
            isActive: subscription.isActive,
            subscriptionEndsAt: subscription.subscriptionEndsAt,
            customerId: subscription.customerId,
            subscriptionId: subscription.subscriptionId,
            trialUsedAt: subscription.trialUsedAt,
        });
    } catch (error) {
        console.error('Failed to get subscription:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
