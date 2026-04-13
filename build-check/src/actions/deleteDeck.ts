'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { getAuthenticatedUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { headers } from 'next/headers';

export async function deleteDeck(deckId: string) {
    // 1. Authenticate
    const user = await getAuthenticatedUser();
    if (!user) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        // 2. Verify Ownership (Prevent IDOR)
        const deck = await db.deck.findUnique({
            where: { id: deckId },
            select: { userId: true, title: true }
        });

        if (!deck) {
            return { success: false, error: 'Deck not found' };
        }

        if (deck.userId !== user.id) {
            // Log unauthorized attempt?
            return { success: false, error: 'Unauthorized access' };
        }

        // 3. Perform Delete (Hard Delete as per original implementation)
        // Note: Consider switching to soft delete (isDeleted: true) in future
        await db.deck.delete({
            where: {
                id: deckId,
            },
        });

        // 4. Audit Log
        const headersList = await headers();
        const ip = headersList.get('x-forwarded-for') || 'unknown';

        await logAudit({
            userId: user.id,
            action: 'DELETE_DECK',
            resourceId: deckId,
            details: { title: deck.title },
            ipAddress: ip
        });

        revalidatePath('/dashboard');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete deck:', error);
        return { success: false, error: 'Failed to delete deck' };
    }
}
