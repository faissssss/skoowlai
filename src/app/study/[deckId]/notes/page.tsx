import { db, withRetry } from '@/lib/db';
import { notFound } from 'next/navigation';
import ClientNotesWrapper from './ClientNotesWrapper';

export default async function NotesPage({ params }: { params: Promise<{ deckId: string }> }) {
    const { deckId } = await params;
    const deck = await withRetry(() => db.deck.findUnique({
        where: { id: deckId },
    }));

    if (!deck) {
        notFound();
    }

    return <ClientNotesWrapper deckId={deck.id} initialContent={deck.summary} />;
}

