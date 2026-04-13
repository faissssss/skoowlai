import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { checkCsrfOrigin } from '@/lib/csrf';

interface RouteParams {
    params: Promise<{ workspaceId: string }>;
}

// GET /api/workspaces/[workspaceId] - Get workspace details
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
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

        const workspace = await db.workspace.findFirst({
            where: {
                id: workspaceId,
                userId: user.id,
                isDeleted: false,
            },
            include: {
                decks: {
                    where: { isDeleted: false },
                    orderBy: { createdAt: 'desc' },
                    include: {
                        _count: {
                            select: { cards: { where: { isDeleted: false } } }
                        }
                    }
                },
                _count: {
                    select: { decks: { where: { isDeleted: false } } }
                }
            }
        });

        if (!workspace) {
            return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
        }

        return NextResponse.json({ workspace });
    } catch (error) {
        console.error('Error fetching workspace:', error);
        return NextResponse.json({ error: 'Failed to fetch workspace' }, { status: 500 });
    }
}

// PATCH /api/workspaces/[workspaceId] - Update workspace
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

        // Verify ownership
        const existingWorkspace = await db.workspace.findFirst({
            where: {
                id: workspaceId,
                userId: user.id,
                isDeleted: false,
            }
        });

        if (!existingWorkspace) {
            return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
        }

        const body = await request.json();
        const { name, description, color } = body;

        const workspace = await db.workspace.update({
            where: { id: workspaceId },
            data: {
                ...(name && { name: name.trim() }),
                ...(description !== undefined && { description: description?.trim() || null }),
                ...(color && { color }),
            },
            include: {
                _count: {
                    select: { decks: { where: { isDeleted: false } } }
                }
            }
        });

        return NextResponse.json({ workspace });
    } catch (error) {
        console.error('Error updating workspace:', error);
        return NextResponse.json({ error: 'Failed to update workspace' }, { status: 500 });
    }
}

// DELETE /api/workspaces/[workspaceId] - Soft delete workspace
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

        // Verify ownership
        const existingWorkspace = await db.workspace.findFirst({
            where: {
                id: workspaceId,
                userId: user.id,
                isDeleted: false,
            }
        });

        if (!existingWorkspace) {
            return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
        }

        // Soft delete workspace and unlink all decks
        await db.$transaction([
            // Unlink all decks from this workspace
            db.deck.updateMany({
                where: { workspaceId },
                data: { workspaceId: null }
            }),
            // Soft delete the workspace
            db.workspace.update({
                where: { id: workspaceId },
                data: {
                    isDeleted: true,
                    deletedAt: new Date()
                }
            })
        ]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting workspace:', error);
        return NextResponse.json({ error: 'Failed to delete workspace' }, { status: 500 });
    }
}

