import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    // 1. Simple Security Check
    // Use the CRON_SECRET or a temporary secret 'setup_2024'
    const secret = req.nextUrl.searchParams.get('secret');
    if (secret !== process.env.CRON_SECRET && secret !== 'setup_2024') {
        return NextResponse.json({ error: 'Unauthorized. Provide ?secret=setup_2024' }, { status: 401 });
    }

    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    const clientSecret = process.env.NEXT_PAYPAL_SECRET;

    // Allow overriding env via query param for testing (sandbox vs live)
    // Default to strict logic or what matches current codebase
    const isSandbox = req.nextUrl.searchParams.get('env') === 'sandbox';
    const baseUrl = isSandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';

    if (!clientId || !clientSecret) {
        return NextResponse.json({ error: 'Missing PayPal credentials in .env' }, { status: 500 });
    }

    try {
        // 2. Get Access Token
        console.log(`Connecting to PayPal (${baseUrl})...`);
        const authRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
        });

        if (!authRes.ok) {
            const errorText = await authRes.text();
            return NextResponse.json({ error: 'PayPal Auth Failed', details: errorText }, { status: 400 });
        }

        const { access_token } = await authRes.json();

        // 3. Create Product
        // We create a new product each time to avoid conflict, or could reuse if we stored ID.
        // For setup script, creating fresh is fine.
        const prodRes = await fetch(`${baseUrl}/v1/catalogs/products`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json',
                'PayPal-Request-Id': `PRODUCT-${Date.now()}`
            },
            body: JSON.stringify({
                name: 'Skoowl AI Pro',
                description: 'Premium subscription for Skoowl AI',
                type: 'SERVICE',
                category: 'SOFTWARE',
            })
        });

        if (!prodRes.ok) {
            return NextResponse.json({ error: 'Product Creation Failed', details: await prodRes.text() }, { status: 400 });
        }

        const product = await prodRes.json();
        const productId = product.id;

        // 4. Create Monthly Plan with 7-Day Trial
        const planRes = await fetch(`${baseUrl}/v1/billing/plans`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json',
                'PayPal-Request-Id': `PLAN-MONTHLY-${Date.now()}`
            },
            body: JSON.stringify({
                product_id: productId,
                name: 'Skoowl AI Pro Monthly (7-Day Trial)',
                description: 'Monthly subscription with 7-day free trial',
                status: 'ACTIVE',
                billing_cycles: [
                    {
                        frequency: { interval_unit: 'DAY', interval_count: 7 },
                        tenure_type: 'TRIAL',
                        sequence: 1,
                        total_cycles: 1,
                        pricing_scheme: { fixed_price: { value: '0', currency_code: 'USD' } }
                    },
                    {
                        frequency: { interval_unit: 'MONTH', interval_count: 1 },
                        tenure_type: 'REGULAR',
                        sequence: 2,
                        total_cycles: 0,
                        pricing_scheme: { fixed_price: { value: '4.99', currency_code: 'USD' } }
                    }
                ],
                payment_preferences: {
                    auto_bill_outstanding: true,
                    setup_fee: { value: '0', currency_code: 'USD' },
                    setup_fee_failure_action: 'CONTINUE',
                    payment_failure_threshold: 3
                },
                taxes: { percentage: '0', inclusive: false }
            })
        });

        if (!planRes.ok) {
            return NextResponse.json({ error: 'Monthly Plan Creation Failed', details: await planRes.text() }, { status: 400 });
        }

        const monthlyPlan = await planRes.json();

        // 5. Create Yearly Plan with 7-Day Trial
        const yearlyPlanRes = await fetch(`${baseUrl}/v1/billing/plans`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json',
                'PayPal-Request-Id': `PLAN-YEARLY-${Date.now()}`
            },
            body: JSON.stringify({
                product_id: productId,
                name: 'Skoowl AI Pro Yearly (7-Day Trial)',
                description: 'Yearly subscription with 7-day free trial',
                status: 'ACTIVE',
                billing_cycles: [
                    {
                        frequency: { interval_unit: 'DAY', interval_count: 7 },
                        tenure_type: 'TRIAL',
                        sequence: 1,
                        total_cycles: 1,
                        pricing_scheme: { fixed_price: { value: '0', currency_code: 'USD' } }
                    },
                    {
                        frequency: { interval_unit: 'YEAR', interval_count: 1 },
                        tenure_type: 'REGULAR',
                        sequence: 2,
                        total_cycles: 0,
                        pricing_scheme: { fixed_price: { value: '39.99', currency_code: 'USD' } }
                    }
                ],
                payment_preferences: {
                    auto_bill_outstanding: true,
                    setup_fee: { value: '0', currency_code: 'USD' },
                    setup_fee_failure_action: 'CONTINUE',
                    payment_failure_threshold: 3
                },
                taxes: { percentage: '0', inclusive: false }
            })
        });

        if (!yearlyPlanRes.ok) {
            return NextResponse.json({ error: 'Yearly Plan Creation Failed', details: await yearlyPlanRes.text() }, { status: 400 });
        }

        const yearlyPlan = await yearlyPlanRes.json();

        return NextResponse.json({
            success: true,
            message: 'Successfully created PayPal Product and Plans with Trials!',
            data: {
                productId: productId,
                monthlyPlanId: monthlyPlan.id,
                yearlyPlanId: yearlyPlan.id,
            },
            instructions: 'Copy the plan IDs and use them in your frontend PayPal buttons configuration.'
        });

    } catch (error: any) {
        console.error('Setup error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
