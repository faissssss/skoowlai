import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { checkCsrfOrigin } from '@/lib/csrf';

interface RouteParams {
    params: Promise<{ workspaceId: string }>;
}

// POST /api/workspaces/[workspaceId]/decks - Add decks to workspace
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const csrfError = checkCsrfOrigin(request);
        if (csrfError) return csrfError;

        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { workspaceId } = await params;

        const user = await db.user.findUnique({
            where: { clerkId: userId },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Verify workspace ownership
        const workspace = await db.workspace.findFirst({
            where: {
                id: workspaceId,
                userId: user.id,
                isDeleted: false,
            }
        });

        if (!workspace) {
            return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
        }

        const body = await request.json();
        const { deckIds } = body;

        if (!Array.isArray(deckIds) || deckIds.length === 0) {
            return NextResponse.json({ error: 'deckIds array is required' }, { status: 400 });
        }

        // Verify deck ownership and update
        const result = await db.deck.updateMany({
            where: {
                id: { in: deckIds },
                userId: user.id,
                isDeleted: false,
            },
            data: { workspaceId }
        });

        return NextResponse.json({
            success: true,
            count: result.count,
            message: `${result.count} deck(s) added to workspace`
        });
    } catch (error) {
        console.error('Error adding decks to workspace:', error);
        return NextResponse.json({ error: 'Failed to add decks to workspace' }, { status: 500 });
    }
}

// DELETE /api/workspaces/[workspaceId]/decks - Remove decks from workspace
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const csrfError = checkCsrfOrigin(request);
        if (csrfError) return csrfError;

        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { workspaceId } = await params;

        const user = await db.user.findUnique({
            where: { clerkId: userId },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Verify workspace ownership
        const workspace = await db.workspace.findFirst({
            where: {
                id: workspaceId,
                userId: user.id,
                isDeleted: false,
            }
        });

        if (!workspace) {
            return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
        }

        const body = await request.json();
        const { deckIds } = body;

        if (!Array.isArray(deckIds) || deckIds.length === 0) {
            return NextResponse.json({ error: 'deckIds array is required' }, { status: 400 });
        }

        // Remove decks from workspace (set workspaceId to null)
        const result = await db.deck.updateMany({
            where: {
                id: { in: deckIds },
                userId: user.id,
                workspaceId: workspaceId,
                isDeleted: false,
            },
            data: { workspaceId: null }
        });

        return NextResponse.json({
            success: true,
            count: result.count,
            message: `${result.count} deck(s) removed from workspace`
        });
    } catch (error) {
        console.error('Error removing decks from workspace:', error);
        return NextResponse.json({ error: 'Failed to remove decks from workspace' }, { status: 500 });
    }
}

