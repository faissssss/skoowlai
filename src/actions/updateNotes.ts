'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function updateNotes(deckId: string, content: string) {
    try {
        await db.deck.update({
            where: { id: deckId },
            data: { summary: content },
        });

        revalidatePath(`/study/${deckId}/notes`);
        return { success: true };
    } catch (error) {
        console.error('Failed to update notes:', error);
        return { success: false, error: 'Failed to update notes' };
    }
}
