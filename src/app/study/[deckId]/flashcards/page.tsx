import { db } from '@/lib/db';
import { notFound } from 'next/navigation';
import ClientFlashcardDeck from './ClientFlashcardDeck';

export default async function FlashcardsPage({ params }: { params: Promise<{ deckId: string }> }) {
    const { deckId } = await params;
    const deck = await db.deck.findUnique({
        where: { id: deckId },
        include: { cards: true },
    });

    if (!deck) {
        notFound();
    }

    return (
        <div className="max-w-3xl mx-auto">
            <ClientFlashcardDeck deckId={deckId} initialCards={deck.cards} />
        </div>
    );
}
