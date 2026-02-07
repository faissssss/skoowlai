import { db, withRetry } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import StudyPageLayout from '@/components/study/StudyPageLayout';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getUserRole } from '@/lib/permissions';

export default async function StudyLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ deckId: string }>;
}) {
    const { deckId } = await params;

    // Get auth state (lighter than fetching full user)
    const session = await auth();
    const clerkId = session.userId;

    // Get deck with workspace info
    const deck = await withRetry(() => db.deck.findUnique({
        where: { id: deckId },
        select: {
            id: true,
            title: true,
            summary: true,
            userId: true,
            isPublic: true,
            workspace: {
                select: {
                    id: true,
                    name: true,
                    color: true,
                }
            }
        },
    }));

    if (!deck) {
        notFound();
    }

    // Get current user from our database
    let currentUserId: string | undefined;
    let userRole: 'OWNER' | 'EDITOR' | 'VIEWER' | null = null;
    let dbUser = null;

    if (clerkId) {
        // Fast path: Try finding by clerkId first
        dbUser = await db.user.findUnique({
            where: { clerkId },
        });

        // Slow path: If not found, we might need to sync/migrate by email
        if (!dbUser) {
            try {
                const clerkUser = await currentUser();
                if (clerkUser && clerkUser.emailAddresses.length > 0) {
                    const email = clerkUser.emailAddresses[0].emailAddress;

                    // Check for existing user by email (migration case)
                    const existingUserByEmail = await db.user.findUnique({
                        where: { email },
                    });

                    if (existingUserByEmail) {
                        // Link clerkId to existing email user
                        console.log('Linking Clerk ID to existing user:', email);
                        dbUser = await db.user.update({
                            where: { id: existingUserByEmail.id },
                            data: { clerkId },
                        });
                    } else {
                        // Check for demo user
                        const demoUser = await db.user.findUnique({
                            where: { email: 'demo@sheesh.ai' },
                        });

                        if (demoUser) {
                            // Migrate demo user
                            console.log('Migrating demo user to', email);
                            dbUser = await db.user.update({
                                where: { id: demoUser.id },
                                data: { email, clerkId },
                            });
                        } else {
                            // Create new user
                            console.log('Creating new user', email);
                            dbUser = await db.user.create({
                                data: {
                                    email,
                                    clerkId,
                                },
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('Error during user sync/migration:', error);
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
