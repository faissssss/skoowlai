import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PATCH - Update deck title
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ deckId: string }> }
) {
    try {
        const { deckId } = await params;
        const body = await req.json();
        const { title } = body;

        if (!title || typeof title !== 'string' || title.trim().length === 0) {
            return NextResponse.json(
                { error: 'Title is required' },
                { status: 400 }
            );
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
            { error: 'Failed to update title' },
            { status: 500 }
        );
    }
}

// GET - Get deck details
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ deckId: string }> }
) {
    try {
        const { deckId } = await params;

        const deck = await db.deck.findUnique({
            where: { id: deckId },
            select: {
                id: true,
                title: true,
                sourceType: true,
                createdAt: true,
            },
        });

        if (!deck) {
            return NextResponse.json(
                { error: 'Deck not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(deck);
    } catch (error) {
        console.error('Error fetching deck:', error);
        return NextResponse.json(
            { error: 'Failed to fetch deck' },
            { status: 500 }
        );
    }
}
