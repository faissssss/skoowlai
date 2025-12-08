'use server';

import { db } from '@/lib/db';
import { isOwner } from '@/lib/permissions';

type Role = 'VIEWER' | 'EDITOR' | 'OWNER';
import { revalidatePath } from 'next/cache';

// Types for response
type ActionResult =
    | { success: true; data?: any }
    | { success: false; error: string };

/**
 * Get all collaborators for a deck
 */
export async function getCollaborators(deckId: string): Promise<ActionResult> {
    try {
        const collaborators = await db.collaborator.findMany({
            where: { deckId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        // Also get the owner info
        const deck = await db.deck.findUnique({
            where: { id: deckId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                    },
                },
            },
        });

        return {
            success: true,
            data: {
                owner: deck?.user,
                collaborators: collaborators.map(c => ({
                    id: c.id,
                    userId: c.userId,
                    email: c.user.email,
                    role: c.role,
                    createdAt: c.createdAt,
                })),
                isPublic: deck?.isPublic || false,
            },
        };
    } catch (error) {
        console.error('Failed to get collaborators:', error);
        return { success: false, error: 'Failed to get collaborators' };
    }
}

/**
 * Invite a collaborator by email
 */
export async function inviteCollaborator(
    currentUserId: string,
    deckId: string,
    email: string,
    role: 'VIEWER' | 'EDITOR'
): Promise<ActionResult> {
    try {
        // Check if current user is the owner
        const ownerCheck = await isOwner(currentUserId, deckId);
        if (!ownerCheck) {
            return { success: false, error: 'Only the owner can invite collaborators' };
        }

        // Find user by email
        const user = await db.user.findUnique({
            where: { email: email.toLowerCase().trim() },
        });

        if (!user) {
            return { success: false, error: 'User not found. They need to create an account first.' };
        }

        // Check if user is the owner
        const deck = await db.deck.findUnique({
            where: { id: deckId },
            select: { userId: true },
        });

        if (deck?.userId === user.id) {
            return { success: false, error: 'Cannot add yourself as a collaborator' };
        }

        // Check if already a collaborator
        const existing = await db.collaborator.findUnique({
            where: {
                userId_deckId: { userId: user.id, deckId },
            },
        });

        if (existing) {
            return { success: false, error: 'User is already a collaborator' };
        }

        // Create collaborator
        const collaborator = await db.collaborator.create({
            data: {
                userId: user.id,
                deckId,
                role: role as Role,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                    },
                },
            },
        });

        revalidatePath(`/study/${deckId}`);

        return {
            success: true,
            data: {
                id: collaborator.id,
                userId: collaborator.userId,
                email: collaborator.user.email,
                role: collaborator.role,
            },
        };
    } catch (error) {
        console.error('Failed to invite collaborator:', error);
        return { success: false, error: 'Failed to invite collaborator' };
    }
}

/**
 * Update a collaborator's role
 */
export async function updateCollaboratorRole(
    currentUserId: string,
    collaboratorId: string,
    newRole: 'VIEWER' | 'EDITOR'
): Promise<ActionResult> {
    try {
        // Get the collaborator to find the deck
        const collaborator = await db.collaborator.findUnique({
            where: { id: collaboratorId },
            select: { deckId: true },
        });

        if (!collaborator) {
            return { success: false, error: 'Collaborator not found' };
        }

        // Check if current user is the owner
        const ownerCheck = await isOwner(currentUserId, collaborator.deckId);
        if (!ownerCheck) {
            return { success: false, error: 'Only the owner can change roles' };
        }

        // Update the role
        await db.collaborator.update({
            where: { id: collaboratorId },
            data: { role: newRole as Role },
        });

        revalidatePath(`/study/${collaborator.deckId}`);

        return { success: true };
    } catch (error) {
        console.error('Failed to update role:', error);
        return { success: false, error: 'Failed to update role' };
    }
}

/**
 * Remove a collaborator
 */
export async function removeCollaborator(
    currentUserId: string,
    collaboratorId: string
): Promise<ActionResult> {
    try {
        // Get the collaborator to find the deck
        const collaborator = await db.collaborator.findUnique({
            where: { id: collaboratorId },
            select: { deckId: true, userId: true },
        });

        if (!collaborator) {
            return { success: false, error: 'Collaborator not found' };
        }

        // Check if current user is the owner OR the collaborator themselves (leaving)
        const ownerCheck = await isOwner(currentUserId, collaborator.deckId);
        if (!ownerCheck && currentUserId !== collaborator.userId) {
            return { success: false, error: 'Only the owner can remove collaborators' };
        }

        // Delete the collaborator
        await db.collaborator.delete({
            where: { id: collaboratorId },
        });

        revalidatePath(`/study/${collaborator.deckId}`);

        return { success: true };
    } catch (error) {
        console.error('Failed to remove collaborator:', error);
        return { success: false, error: 'Failed to remove collaborator' };
    }
}

/**
 * Toggle public access for a deck
 */
export async function setPublicAccess(
    currentUserId: string,
    deckId: string,
    isPublic: boolean
): Promise<ActionResult> {
    try {
        // Check if current user is the owner
        const ownerCheck = await isOwner(currentUserId, deckId);
        if (!ownerCheck) {
            return { success: false, error: 'Only the owner can change access settings' };
        }

        await db.deck.update({
            where: { id: deckId },
            data: { isPublic },
        });

        revalidatePath(`/study/${deckId}`);

        return { success: true };
    } catch (error) {
        console.error('Failed to update access:', error);
        return { success: false, error: 'Failed to update access settings' };
    }
}
