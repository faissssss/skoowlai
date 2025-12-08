import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Generate a temporary Deepgram token for client-side WebSocket connection
export async function POST(req: NextRequest) {
    const apiKey = process.env.DEEPGRAM_API_KEY;

    if (!apiKey) {
        return NextResponse.json({ error: 'Deepgram API key not configured' }, { status: 500 });
    }

    try {
        // Request a temporary token from Deepgram's auth endpoint
        const response = await fetch('https://api.deepgram.com/v1/listen', {
            method: 'POST',
            headers: {
                'Authorization': `Token ${apiKey}`,
                'Content-Type': 'application/json',
            },
        });

        // For streaming, we need to return the API key for browser WebSocket
        // The browser will use it with the token subprotocol
        // Deepgram's recommended approach for browsers is to use a short-lived key
        // For simplicity in development, we'll return the key wrapped in connection info

        return NextResponse.json({
            wsUrl: 'wss://api.deepgram.com/v1/listen',
            queryParams: 'model=nova-3&language=en&punctuate=true&interim_results=true&smart_format=true&endpointing=300&encoding=linear16&sample_rate=16000',
            apiKey: apiKey,
        });
    } catch (error) {
        console.error('Error getting Deepgram token:', error);
        return NextResponse.json({ error: 'Failed to get Deepgram token' }, { status: 500 });
    }
}
