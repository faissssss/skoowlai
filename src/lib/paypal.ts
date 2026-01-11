/**
 * Shared PayPal utilities
 */

export async function getPayPalAccessToken(): Promise<string> {
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    const clientSecret = process.env.NEXT_PAYPAL_SECRET;

    // Detect environment based on client ID format or manual override
    // Sandbox IDs usually start with 'sb' or similar, but reliable way is explicit config
    // We'll stick to 'api-m.paypal.com' as default unless explicit 'sandbox' logic is needed globally.
    // For now, mirroring existing behavior:
    const baseUrl = 'https://api-m.paypal.com';
    // If you need sandbox support, this should be configurable via env, e.g. PAYPAL_ENV='sandbox'

    if (!clientId || !clientSecret) {
        throw new Error('Missing PayPal credentials');
    }

    const authRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });

    if (!authRes.ok) {
        throw new Error(`PayPal auth failed: ${await authRes.text()}`);
    }

    const data = await authRes.json();
    return data.access_token;
}
