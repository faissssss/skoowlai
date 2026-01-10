import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

// GET /api/workspaces - List user's workspaces
export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await db.user.findUnique({
            where: { clerkId: userId },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const workspaces = await db.workspace.findMany({
            where: {
                userId: user.id,
                isDeleted: false,
            },
            include: {
                decks: {
                    where: { isDeleted: false },
                    select: {
                        id: true,
                        title: true,
                        sourceType: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 10, // Limit to 10 most recent for performance
                },
                _count: {
                    select: { decks: { where: { isDeleted: false } } }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({ workspaces });
    } catch (error) {
        console.error('Error fetching workspaces:', error);
        return NextResponse.json({ error: 'Failed to fetch workspaces' }, { status: 500 });
    }
}

// POST /api/workspaces - Create new workspace
export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await db.user.findUnique({
            where: { clerkId: userId },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const body = await request.json();
        const { name, description, color } = body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 });
        }

        const workspace = await db.workspace.create({
            data: {
                name: name.trim(),
                description: description?.trim() || null,
                color: color || '#6366f1',
                userId: user.id,
            },
            include: {
                _count: {
                    select: { decks: { where: { isDeleted: false } } }
                }
            }
        });

        return NextResponse.json({ workspace }, { status: 201 });
    } catch (error) {
        console.error('Error creating workspace:', error);
        return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 });
    }
}

