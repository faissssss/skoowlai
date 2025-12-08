'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function deleteDeck(deckId: string) {
    try {
        await db.deck.delete({
            where: {
                id: deckId,
            },
        });
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete deck:', error);
        return { success: false, error: 'Failed to delete deck' };
    }
}
