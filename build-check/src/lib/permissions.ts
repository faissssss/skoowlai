import { db } from '@/lib/db';

export type Role = 'VIEWER' | 'EDITOR' | 'OWNER';

export type Permission = 'VIEW' | 'EDIT' | 'DELETE' | 'SHARE';

// Role permission matrix
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    VIEWER: ['VIEW'],
    EDITOR: ['VIEW', 'EDIT'],
    OWNER: ['VIEW', 'EDIT', 'DELETE', 'SHARE'],
};

/**
 * Check if a user has a specific permission on a deck
 */
export async function checkPermission(
    userId: string,
    deckId: string,
    permission: Permission
): Promise<boolean> {
    // First check if user is the deck owner
    const deck = await db.deck.findUnique({
        where: { id: deckId },
        select: { userId: true, isPublic: true },
    });

    if (!deck) return false;

    // Owner has all permissions
    if (deck.userId === userId) return true;

    // For VIEW permission, check if deck is public
    if (permission === 'VIEW' && deck.isPublic) return true;

    // Check collaborator role
    const collaborator = await db.collaborator.findUnique({
        where: {
            userId_deckId: { userId, deckId },
        },
    });

    if (!collaborator) return false;

    return ROLE_PERMISSIONS[collaborator.role as Role].includes(permission);
}

/**
 * Get user's role for a deck (returns OWNER if they own it)
 */
export async function getUserRole(
    userId: string,
    deckId: string
): Promise<Role | null> {
    // Check if user owns the deck
    const deck = await db.deck.findUnique({
        where: { id: deckId },
        select: { userId: true, isPublic: true },
    });

    if (!deck) return null;

    if (deck.userId === userId) return 'OWNER';

    // Check collaborator role
    const collaborator = await db.collaborator.findUnique({
        where: {
            userId_deckId: { userId, deckId },
        },
    });

    if (collaborator) return collaborator.role as Role;

    // If deck is public, user has VIEWER access
    if (deck.isPublic) return 'VIEWER';

    return null;
}

/**
 * Check if user can access a deck (at minimum VIEW permission)
 */
export async function canAccessDeck(
    userId: string,
    deckId: string
): Promise<boolean> {
    return checkPermission(userId, deckId, 'VIEW');
}

/**
 * Check if user can edit a deck
 */
export async function canEditDeck(
    userId: string,
    deckId: string
): Promise<boolean> {
    return checkPermission(userId, deckId, 'EDIT');
}

/**
 * Check if user is the owner of a deck
 */
export async function isOwner(
    userId: string,
    deckId: string
): Promise<boolean> {
    const deck = await db.deck.findUnique({
        where: { id: deckId },
        select: { userId: true },
    });

    return deck?.userId === userId;
}
