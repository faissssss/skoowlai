import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";

export type SubscriptionStatus = 'free' | 'active' | 'cancelled' | 'on_hold' | 'expired' | 'trialing';
export type SubscriptionPlan = 'monthly' | 'yearly' | null;

export interface UserSubscription {
    status: SubscriptionStatus;
    plan: SubscriptionPlan;
    isActive: boolean;
    isPro: boolean;
    customerId: string | null;
    subscriptionId: string | null;
    subscriptionEndsAt: Date | null;
}

/**
 * Get the current user's subscription status
 */
export async function getUserSubscription(): Promise<UserSubscription> {
    const { userId } = await auth();

    if (!userId) {
        return {
            status: 'free',
            plan: null,
            isActive: false,
            isPro: false,
            customerId: null,
            subscriptionId: null,
            subscriptionEndsAt: null,
        };
    }

    try {
        const user = await db.user.findUnique({
            where: { clerkId: userId },
            select: {
                subscriptionStatus: true,
                subscriptionPlan: true,
                subscriptionId: true,
                customerId: true,
                subscriptionEndsAt: true,
            }
        });

        if (!user) {
            return {
                status: 'free',
                plan: null,
                isActive: false,
                isPro: false,
                customerId: null,
                subscriptionId: null,
                subscriptionEndsAt: null,
            };
        }

        const isActive = user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing';

        return {
            status: user.subscriptionStatus as SubscriptionStatus,
            plan: user.subscriptionPlan as SubscriptionPlan,
            isActive,
            isPro: isActive,
            customerId: user.customerId,
            subscriptionId: user.subscriptionId,
            subscriptionEndsAt: user.subscriptionEndsAt,
        };
    } catch (error) {
        console.error('Error fetching subscription:', error);
        return {
            status: 'free',
            plan: null,
            isActive: false,
            isPro: false,
            customerId: null,
            subscriptionId: null,
            subscriptionEndsAt: null,
        };
    }
}

/**
 * Get usage limits based on subscription status
 */
export function getUsageLimits(isActive: boolean) {
    if (isActive) {
        // Student plan - unlimited study resources, limited AI chat
        return {
            studyDecksDaily: Infinity,
            flashcardsDaily: Infinity,
            quizzesDaily: Infinity,
            mindMapsDaily: Infinity,
            aiChatDaily: 100,
            customFlashcardCount: true,
            customQuizCount: true,
        };
    }

    // Free plan limits
    return {
        studyDecksDaily: 3,
        flashcardsDaily: 5,
        quizzesDaily: 5,
        mindMapsDaily: 5,
        aiChatDaily: 20,
        customFlashcardCount: false,
        customQuizCount: false,
    };
}

/**
 * Check if user has access to a specific feature
 */
export function checkFeatureAccess(isActive: boolean, feature: string): boolean {
    const premiumFeatures = ['custom_flashcard_count', 'custom_quiz_count', 'unlimited_access'];

    if (isActive) return true;

    // Free users can't access premium features
    return !premiumFeatures.includes(feature);
}
