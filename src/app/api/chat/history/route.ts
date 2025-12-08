import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const deckId = searchParams.get('deckId');

    if (!deckId) {
        return NextResponse.json({ error: 'deckId is required' }, { status: 400 });
    }

    try {
        const messages = await db.chatMessage.findMany({
            where: { deckId },
            orderBy: { createdAt: 'asc' },
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
    const { searchParams } = new URL(req.url);
    const deckId = searchParams.get('deckId');

    if (!deckId) {
        return NextResponse.json({ error: 'deckId is required' }, { status: 400 });
    }

    try {
        await db.chatMessage.deleteMany({
            where: { deckId },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to clear chat history:', error);
        return NextResponse.json({ error: 'Failed to clear chat history' }, { status: 500 });
    }
}
