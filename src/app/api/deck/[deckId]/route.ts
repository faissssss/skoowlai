import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';

// PATCH - Update deck title
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ deckId: string }> }
) {
    // 1. Authenticate user first
    const { user, errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    try {
        const { deckId } = await params;
        const body = await req.json();

        const updateDeckSchema = z.object({
            title: z.string().min(1).max(100)
        }).strict();

        const payload = updateDeckSchema.safeParse(body);

        if (!payload.success) {
            return NextResponse.json(
                { error: 'Invalid request', details: payload.error.flatten() },
                { status: 400 }
            );
        }

        const { title } = payload.data;

        // Verify ownership before update
        const existingDeck = await db.deck.findUnique({
            where: { id: deckId },
            select: { userId: true }
        });

        if (!existingDeck) {
            return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
        }

        if (existingDeck.userId !== user.id) {
            return NextResponse.json({ error: 'Unauthorized access to deck' }, { status: 403 });
        }

        const deck = await db.deck.update({
            where: { id: deckId },
            data: { title: title.trim() },
        });

        return NextResponse.json({
            success: true,
            title: deck.title,
        });
    } catch (error) {
        console.error('Error updating deck title:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}

// GET - Get deck details
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ deckId: string }> }
) {
    // 1. Authenticate user first
    const { user, errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    try {
        const { deckId } = await params;

        // Fetch deck and check ownership
        const deck = await db.deck.findUnique({
            where: { id: deckId },
            select: {
                id: true,
                title: true,
                sourceType: true,
                createdAt: true,
                userId: true, // Need this for ownership check
            },
        });

        if (!deck) {
            return NextResponse.json(
                { error: 'Deck not found' },
                { status: 404 }
            );
        }

        if (deck.userId !== user.id) {
            return NextResponse.json(
                { error: 'Unauthorized access to deck' },
                { status: 403 }
            );
        }

        // Remove userId from response if strict privacy needed, 
        // but it's the user's own id so it's fine.
        return NextResponse.json(deck);
    } catch (error) {
        console.error('Error fetching deck:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
