import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Debug webhook to inspect raw headers and body
 * Dodo should send this: webhook-signature, webhook-id
 */
export async function POST(req: Request) {
    try {
        const headerList = await headers();
        const headersObj: Record<string, string> = {};
        headerList.forEach((val, key) => {
            headersObj[key] = val;
        });

        const bodyText = await req.text();

        console.log('🔍 [DEBUG WEBHOOK] Headers:', JSON.stringify(headersObj, null, 2));
        console.log('🔍 [DEBUG WEBHOOK] Body:', bodyText);

        return NextResponse.json({
            received: true,
            headers: headersObj,
            bodyLength: bodyText.length
        });
    } catch (error) {
        console.error('Debug webhook error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
