import { Checkout } from "@dodopayments/nextjs";

export const GET = Checkout({
    bearerToken: process.env.NEXT_PUBLIC_DODO_PAYMENTS_API_KEY || 'dummy_token_for_build',
    environment: (process.env.NEXT_PUBLIC_DODO_PAYMENTS_ENVIRONMENT as "test_mode" | "live_mode") || 'test_mode',
    returnUrl: process.env.NEXT_PUBLIC_DODO_PAYMENTS_RETURN_URL || 'http://localhost:3000/dashboard',
});

export const POST = Checkout({
    bearerToken: process.env.NEXT_PUBLIC_DODO_PAYMENTS_API_KEY || 'dummy_token_for_build',
    environment: (process.env.NEXT_PUBLIC_DODO_PAYMENTS_ENVIRONMENT as "test_mode" | "live_mode") || 'test_mode',
    returnUrl: process.env.NEXT_PUBLIC_DODO_PAYMENTS_RETURN_URL || 'http://localhost:3000/dashboard',
});
