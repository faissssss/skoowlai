import { db, withRetry } from '@/lib/db';
import { Prisma } from '@prisma/client';
import DashboardClient from '@/components/dashboard/DashboardClient';
import { getAuthenticatedUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type DeckWithCount = Prisma.DeckGetPayload<{
    include: { _count: { select: { cards: true, quizzes: true } } }
}>;

export default async function Dashboard() {
    // Get authenticated user - redirect if not logged in
    const user = await getAuthenticatedUser();
    if (!user) {
        redirect('/');
    }

    let decks: DeckWithCount[] = [];
    try {
        // Fetch only decks that the user owns or has been shared with them
        decks = await withRetry(() => db.deck.findMany({
            where: {
                OR: [
                    { userId: user.id },  // User owns the deck
                    { collaborators: { some: { userId: user.id, isDeleted: false } } }  // User collaborates
                ],
                isDeleted: false,  // Exclude soft-deleted decks
            },
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { cards: true, quizzes: true } } }
        }));
    } catch (error) {
        console.error("Failed to fetch decks:", error);
    }

    return <DashboardClient decks={decks} />;
}
