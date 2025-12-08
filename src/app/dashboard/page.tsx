import { db, withRetry } from '@/lib/db';
import { Prisma } from '@prisma/client';
import DashboardClient from '@/components/dashboard/DashboardClient';

export const dynamic = 'force-dynamic';

type DeckWithCount = Prisma.DeckGetPayload<{
    include: { _count: { select: { cards: true, quizzes: true } } }
}>;

export default async function Dashboard() {
    let decks: DeckWithCount[] = [];
    try {
        // withRetry handles Neon auto-suspend wake-up delays
        decks = await withRetry(() => db.deck.findMany({
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { cards: true, quizzes: true } } }
        }));
    } catch (error) {
        console.error("Failed to fetch decks:", error);
    }

    return <DashboardClient decks={decks} />;
}
