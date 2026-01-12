import { Checkout } from "@dodopayments/nextjs";

// SECURITY: Using server-side only API key (not NEXT_PUBLIC_)
export const GET = Checkout({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY || '',
    environment: (process.env.DODO_PAYMENTS_ENVIRONMENT as "test_mode" | "live_mode") || 'live_mode',
    returnUrl: process.env.DODO_PAYMENTS_RETURN_URL || 'https://skoowlai.com/dashboard',
});

export const POST = Checkout({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY || '',
    environment: (process.env.DODO_PAYMENTS_ENVIRONMENT as "test_mode" | "live_mode") || 'live_mode',
    returnUrl: process.env.DODO_PAYMENTS_RETURN_URL || 'https://skoowlai.com/dashboard',
});

