import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug endpoint to test webhook signature verification
 * This helps diagnose if the DODO_PAYMENTS_WEBHOOK_KEY is correct
 */
export async function GET(request: NextRequest) {
    try {
        const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY;

        return NextResponse.json({
            exists: !!webhookKey,
            length: webhookKey?.length || 0,
            startsWithWhsec: webhookKey?.startsWith('whsec_') || false,
            firstChars: webhookKey?.substring(0, 10) || 'N/A',
            environment: process.env.DODO_PAYMENTS_ENVIRONMENT || 'not set',
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        return NextResponse.json({
            error: String(error)
        }, { status: 500 });
    }
}
