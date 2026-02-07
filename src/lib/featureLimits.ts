import { db } from './db';
import { NextResponse } from 'next/server';
import { requireAuth } from './auth';

// Usage limits for free users
export const FREE_LIMITS = {
    STUDY_DECKS_DAILY: 3,
    FLASHCARDS_DAILY: 5,
    QUIZZES_DAILY: 5,
    MINDMAPS_DAILY: 5,
    CHAT_DAILY: 20,
};

// Usage limits for pro plan
export const STUDENT_LIMITS = {
    STUDY_DECKS_DAILY: Infinity,
    FLASHCARDS_DAILY: Infinity,
    QUIZZES_DAILY: Infinity,
    MINDMAPS_DAILY: Infinity,
    CHAT_DAILY: 100,
};

export type FeatureType = 'flashcard' | 'quiz' | 'mindmap' | 'chat' | 'studyDeck';

interface FeatureLimitResult {
    allowed: boolean;
    isSubscriber: boolean;
    currentUsage: number;
    limit: number;
    errorResponse?: NextResponse;
    user?: any;
}

function isSameDay(date1: Date, date2: Date): boolean {
    return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
    );
}

/**
 * Check if user can use a feature based on their subscription and usage
 */
export async function checkFeatureLimit(feature: FeatureType): Promise<FeatureLimitResult> {
    const { user, errorResponse } = await requireAuth();

    if (errorResponse) {
        return { allowed: false, isSubscriber: false, currentUsage: 0, limit: 0, errorResponse };
    }

    const today = new Date();
    const hasFutureAccess =
        user.subscriptionEndsAt ? new Date(user.subscriptionEndsAt) > today : false;

    // Treat trialing users as subscribers, and cancelled users retain access until period end
    const isSubscriber =
        user.subscriptionStatus === 'active' ||
        user.subscriptionStatus === 'trialing' ||
        (user.subscriptionStatus === 'cancelled' && hasFutureAccess);

    // Get the appropriate usage field and limit
    const usageMap: Record<FeatureType, { countField: string; dateField: string; freeLimit: number; studentLimit: number }> = {
        flashcard: {
            countField: 'flashcardUsageCount',
            dateField: 'lastUsageDate',
            freeLimit: FREE_LIMITS.FLASHCARDS_DAILY,
            studentLimit: STUDENT_LIMITS.FLASHCARDS_DAILY,
        },
        quiz: {
            countField: 'quizUsageCount',
            dateField: 'lastUsageDate',
            freeLimit: FREE_LIMITS.QUIZZES_DAILY,
            studentLimit: STUDENT_LIMITS.QUIZZES_DAILY,
        },
        mindmap: {
            countField: 'mindmapUsageCount',
            dateField: 'lastUsageDate',
            freeLimit: FREE_LIMITS.MINDMAPS_DAILY,
            studentLimit: STUDENT_LIMITS.MINDMAPS_DAILY,
        },
        chat: {
            countField: 'chatUsageCount',
            dateField: 'lastChatUsageDate',
            freeLimit: FREE_LIMITS.CHAT_DAILY,
            studentLimit: STUDENT_LIMITS.CHAT_DAILY,
        },
        studyDeck: {
            countField: 'dailyUsageCount',
            dateField: 'lastUsageDate',
            freeLimit: FREE_LIMITS.STUDY_DECKS_DAILY,
            studentLimit: STUDENT_LIMITS.STUDY_DECKS_DAILY,
        },
    };

    const config = usageMap[feature];
    const limit = isSubscriber ? config.studentLimit : config.freeLimit;

    // Get current usage
    let currentUsage = (user as any)[config.countField] || 0;
    const lastUsageDate = (user as any)[config.dateField] ? new Date((user as any)[config.dateField]) : null;

    // Reset counter if it's a new day
    if (lastUsageDate && !isSameDay(lastUsageDate, today)) {
        await db.user.update({
            where: { id: user.id },
            data: { [config.countField]: 0 },
        });
        currentUsage = 0;
    }

    // Subscribers have unlimited access (except chat which has higher limit)
    if (isSubscriber && limit === Infinity) {
        return { allowed: true, isSubscriber, currentUsage, limit, user };
    }

    // Check if limit reached
    if (currentUsage >= limit) {
        const featureNames: Record<FeatureType, string> = {
            flashcard: 'flashcard generations',
            quiz: 'quiz generations',
            mindmap: 'mind map generations',
            chat: 'AI chat messages',
            studyDeck: 'study deck creations',
        };

        return {
            allowed: false,
            isSubscriber,
            currentUsage,
            limit,
            errorResponse: NextResponse.json(
                {
                    error: 'Daily limit reached',
                    details: `You've used all ${limit} of your daily ${featureNames[feature]}. Upgrade to Student plan for unlimited access!`,
                    limit,
                    used: currentUsage,
                    upgradeRequired: true,
                    feature,
                },
                { status: 429 }
            ),
            user,
        };
    }

    return { allowed: true, isSubscriber, currentUsage, limit, user };
}

/**
 * Increment usage after successful feature use
 */
export async function incrementFeatureUsage(userId: string, feature: FeatureType): Promise<void> {
    const fieldMap: Record<FeatureType, string> = {
        flashcard: 'flashcardUsageCount',
        quiz: 'quizUsageCount',
        mindmap: 'mindmapUsageCount',
        chat: 'chatUsageCount',
        studyDeck: 'dailyUsageCount',
    };

    const dateFieldMap: Record<FeatureType, string> = {
        flashcard: 'lastUsageDate',
        quiz: 'lastUsageDate',
        mindmap: 'lastUsageDate',
        chat: 'lastChatUsageDate',
        studyDeck: 'lastUsageDate',
    };

    await db.user.update({
        where: { id: userId },
        data: {
            [fieldMap[feature]]: { increment: 1 },
            [dateFieldMap[feature]]: new Date(),
        },
    });
    // Let the error propagate to the caller for proper handling
}

/**
 * Check if user can use custom count feature
 */
export function canUseCustomCount(isSubscriber: boolean): boolean {
    return isSubscriber;
}
