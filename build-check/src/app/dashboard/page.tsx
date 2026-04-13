import { db, withRetry } from '@/lib/db';
import { Prisma } from '@prisma/client';
import DashboardClient from '@/components/dashboard/DashboardClient';
import { getAuthenticatedUser } from '@/lib/auth';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type DeckWithCount = Prisma.DeckGetPayload<{
    include: { _count: { select: { cards: true, quizzes: true } } }
}>;

export default async function Dashboard() {
    // Get authenticated user - redirect if not logged in
    const user = await getAuthenticatedUser();
    // Debugging: Show error instead of redirecting to see why user is null
    if (!user) {
        // Attempt to diagnose the specific error
        let errorDetails = "Unknown error";
        try {
            // 1. Test basic connection
            await db.$connect();

            // 2. Get Clerk details
            const { userId } = await import('@clerk/nextjs/server').then(m => m.auth());
            const currentUser = await import('@clerk/nextjs/server').then(m => m.currentUser());
            const userEmail = currentUser?.emailAddresses?.[0]?.emailAddress;

            if (userId) {
                // 3. Check if user exists by Clerk ID
                const userById = await db.user.findUnique({ where: { clerkId: userId } });

                if (userById) {
                    errorDetails = `SUCCESS: User found in DB by Clerk ID (${userId}).\n\nIssue is likely in 'getAuthenticatedUser' logic or upstream middleware.\nUser ID: ${userById.id}\nEmail: ${userById.email}`;
                } else {
                    // 4. Check if user exists by Email (mismatch case)
                    if (userEmail) {
                        const userByEmail = await db.user.findUnique({ where: { email: userEmail } });
                        if (userByEmail) {
                            errorDetails = `MISMATCH: User found by email (${userEmail}) but Clerk ID does not match.\n\nDB Clerk ID: ${userByEmail.clerkId}\nCurrent Clerk ID: ${userId}\n\nAction: Needs resync.`;
                        } else {
                            errorDetails = `MISSING: User not found by Clerk ID (${userId}) OR Email (${userEmail}).\n\nAction: User needs to be created.`;
                        }
                    } else {
                        errorDetails = `MISSING: User not found by Clerk ID (${userId}). No email available to check.`;
                    }
                }
            } else {
                errorDetails = "Clerk userId is null (not signed in?)";
            }
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : JSON.stringify(e);
            errorDetails = `Connection/Query Error: ${errorMessage}`;
        }

        console.error("Dashboard Access Denied:", errorDetails);

        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-background">
                <div className="max-w-2xl space-y-6">
                    <h1 className="text-3xl font-bold text-red-500">Access Error Diagnostics</h1>

                    <div className="p-6 rounded-xl bg-card border border-border text-left overflow-hidden shadow-2xl">
                        <div className="flex items-center gap-2 mb-4 border-b border-border/60 pb-2">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            <span className="font-mono text-muted-foreground text-sm">System Diagnostics</span>
                        </div>

                        <div className="space-y-3 font-mono text-xs md:text-sm text-foreground/80">
                            <div>
                                <span className="text-muted-foreground">Timestamp:</span>
                                <span className="ml-2 text-primary">{new Date().toISOString()}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Status:</span>
                                <span className="ml-2 text-emerald-400">Authenticated (Clerk)</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Database:</span>
                                <span className="ml-2 text-red-400">Connection Failed / Query Error</span>
                            </div>

                            <div className="mt-4 pt-4 border-t border-border/60">
                                <span className="text-muted-foreground block mb-2">Detailed Error Log:</span>
                                <pre className="p-3 rounded bg-black/50 text-red-300 whitespace-pre-wrap break-all border border-red-900/30">
                                    {errorDetails}
                                </pre>
                            </div>
                        </div>
                    </div>

                    <div className="text-muted-foreground max-w-lg mx-auto">
                        <p className="mb-2"><strong>Likely Cause:</strong> Missing or incorrect Production Environment Variables.</p>
                        <p className="text-sm">Please check your Vercel Project Settings &gt; Environment Variables.</p>
                    </div>

                    <Link href="/" className="inline-block px-6 py-3 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors">
                        Return to Home
                    </Link>
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

    // Serialize dates to strings for client component compatibility
    const serializedDecks = decks.map(deck => ({
        ...deck,
        createdAt: deck.createdAt.toISOString(),
    }));

    return <DashboardClient decks={serializedDecks} />;
}
