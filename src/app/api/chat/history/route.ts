import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { checkCsrfOrigin } from '@/lib/csrf';

export async function GET(req: NextRequest) {
    const { user, errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(req.url);
    const deckId = searchParams.get('deckId');

    if (!deckId) {
        return NextResponse.json({ error: 'deckId is required' }, { status: 400 });
    }

    try {
        const deck = await db.deck.findUnique({
            where: { id: deckId },
            select: { userId: true },
        });
        if (!deck) {
            return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
        }
        if (deck.userId !== user.id) {
            return NextResponse.json({ error: 'Unauthorized access to deck' }, { status: 403 });
        }

        const messages = await db.chatMessage.findMany({
            where: { deckId },
            orderBy: [
                { createdAt: 'asc' },
                { id: 'asc' }, // Secondary sort by ID for consistent ordering
            ],
        });

        // Convert to AI SDK format
        const formattedMessages = messages.map(msg => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            citation: (msg as any).citation, // Cast to any to bypass stale type definition
        }));

        return NextResponse.json({ messages: formattedMessages });
    } catch (error) {
        console.error('Failed to load chat history:', error);
        return NextResponse.json({ error: 'Failed to load chat history' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const csrfError = checkCsrfOrigin(req);
    if (csrfError) return csrfError;

    const { user, errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(req.url);
    const deckId = searchParams.get('deckId');

    if (!deckId) {
        return NextResponse.json({ error: 'deckId is required' }, { status: 400 });
    }

    try {
        const deck = await db.deck.findUnique({
            where: { id: deckId },
            select: { userId: true },
        });
        if (!deck) {
            return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
        }
        if (deck.userId !== user.id) {
            return NextResponse.json({ error: 'Unauthorized access to deck' }, { status: 403 });
        }

        await db.chatMessage.deleteMany({
            where: { deckId },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to clear chat history:', error);
        return NextResponse.json({ error: 'Failed to clear chat history' }, { status: 500 });
    }
}
