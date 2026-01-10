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
    // Debugging: Show error instead of redirecting to see why user is null
    if (!user) {
        // Log to server console (visible in user's terminal)
        console.error("Dashboard Access Denied: getAuthenticatedUser returned null for userId:", (await getAuthenticatedUser()));

        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-slate-50 dark:bg-slate-950">
                <div className="max-w-md space-y-4">
                    <h1 className="text-2xl font-bold text-red-500">Access Error</h1>
                    <p className="text-slate-600 dark:text-slate-400">
                        We couldn't retrieve your user profile. This might be due to a database connection issue or an authentication sync error.
                    </p>
                    <div className="p-4 rounded-lg bg-slate-200 dark:bg-slate-800 text-left text-xs font-mono overflow-auto">
                        <p>Status: Authenticated with Clerk</p>
                        <p>Database User: Not Found / Error</p>
                        <p>Timestamp: {new Date().toISOString()}</p>
                    </div>
                    <a href="/" className="inline-block px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                        Return Home
                    </a>
                </div>
            </div>
        );
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
