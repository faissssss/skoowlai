import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from './db';
import { NextResponse } from 'next/server';

/**
 * Get or create the authenticated user from the database
 * Uses Clerk authentication to identify the user
 * 
 * @returns The user object from the database, or null if not authenticated
 */
export async function getAuthenticatedUser() {
    try {
        const { userId } = await auth();

        if (!userId) {
            return null;
        }

        // Try to find existing user by Clerk ID
        let user = await db.user.findUnique({
            where: { clerkId: userId }
        });

        // If user doesn't exist, create them
        if (!user) {
            // Get user details from Clerk
            const clerkUser = await currentUser();
            const email = clerkUser?.emailAddresses?.[0]?.emailAddress || `user-${userId}@skoowl.ai`;

            user = await db.user.create({
                data: {
                    clerkId: userId,
                    email: email,
                }
            });
        }

        return user;
    } catch (error) {
        console.error('Error getting authenticated user:', error);
        return null;
    }
}

/**
 * Require authentication - returns error response if not authenticated
 * Use this at the start of API routes that require authentication
 */
export async function requireAuth() {
    const user = await getAuthenticatedUser();

    if (!user) {
        return {
            user: null,
            errorResponse: NextResponse.json(
                { error: 'Unauthorized', details: 'Please sign in to continue.' },
                { status: 401 }
            )
        };
    }

    return { user, errorResponse: null };
}
