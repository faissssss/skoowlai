import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const headerList = await headers();
        const headersObj: Record<string, string> = {};
        headerList.forEach((val, key) => {
            headersObj[key] = val;
        });

        const bodyText = await req.text();
        const secret = process.env.DODO_PAYMENTS_WEBHOOK_KEY || '';

        console.log('🔍 [DEBUG] Headers:', JSON.stringify(headersObj, null, 2));
        console.log('🔍 [DEBUG] Payload:', bodyText.substring(0, 100) + '...');

        // Check for common headers
        const msgId = headersObj['webhook-id'] || headersObj['svix-id'] || '';
        const msgTimestamp = headersObj['webhook-timestamp'] || headersObj['svix-timestamp'] || '';
        const receivedSignature = headersObj['webhook-signature'] || headersObj['svix-signature'] || '';

        const responseData = {
            status: 'CHECK DODO RESPONSE TAB',
            headersReceived: headersObj,
            secretConfigured: secret ? `Yes (starts with ${secret.substring(0, 6)}...)` : 'No',
            payloadPreview: bodyText.substring(0, 50) + '...',
            missingHeaders: [] as string[]
        };

        if (!msgId) responseData.missingHeaders.push('webhook-id / svix-id');
        if (!msgTimestamp) responseData.missingHeaders.push('webhook-timestamp / svix-timestamp');
        if (!receivedSignature) responseData.missingHeaders.push('webhook-signature / svix-signature');

        // Force 400 if critical headers are missing so Dodo marks it as failed and user checks logs
        if (responseData.missingHeaders.length > 0) {
            return NextResponse.json({ ...responseData, error: 'Missing required headers' }, { status: 400 });
        }

        return NextResponse.json(responseData);
    } catch (error) {
        console.error('Debug webhook error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
