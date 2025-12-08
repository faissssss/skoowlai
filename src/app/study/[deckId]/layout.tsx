import { db } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import StudyPageLayout from '@/components/study/StudyPageLayout';
import { currentUser } from '@clerk/nextjs/server';
import { getUserRole } from '@/lib/permissions';

export default async function StudyLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ deckId: string }>;
}) {
    const { deckId } = await params;
    const clerkUser = await currentUser();

    // Get deck
    const deck = await db.deck.findUnique({
        where: { id: deckId },
        select: {
            id: true,
            title: true,
            summary: true,
            userId: true,
            isPublic: true,
        },
    });

    if (!deck) {
        notFound();
    }

    // Get current user from our database
    let currentUserId: string | undefined;
    let userRole: 'OWNER' | 'EDITOR' | 'VIEWER' | null = null;

    if (clerkUser && clerkUser.emailAddresses.length > 0) {
        const email = clerkUser.emailAddresses[0].emailAddress;

        // Try to find user by email
        let dbUser = await db.user.findUnique({
            where: { email },
        });

        // If not found, check if there's a demo user to migrate
        if (!dbUser) {
            const demoUser = await db.user.findUnique({
                where: { email: 'demo@sheesh.ai' },
            });

            if (demoUser) {
                // Migrate demo user to real user
                console.log('Migrating demo user to', email);
                dbUser = await db.user.update({
                    where: { id: demoUser.id },
                    data: { email },
                });
            } else {
                // Create new user
                console.log('Creating new user', email);
                dbUser = await db.user.create({
                    data: { email },
                });
            }
        }

        if (dbUser) {
            currentUserId = dbUser.id;
            userRole = await getUserRole(dbUser.id, deckId);
        }
    }

    // Check access
    if (!deck.isPublic && !userRole) {
        // No access - redirect to dashboard
        redirect('/dashboard');
    }

    // If public but no role, treat as VIEWER
    if (deck.isPublic && !userRole) {
        userRole = 'VIEWER';
    }

    return (
        <StudyPageLayout
            deck={deck}
            currentUserId={currentUserId}
            userRole={userRole}
        >
            {children}
        </StudyPageLayout>
    );
}
