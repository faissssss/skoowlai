import { CustomerPortal } from "@dodopayments/nextjs";

// SECURITY: Using server-side only API key (not NEXT_PUBLIC_)
export const GET = CustomerPortal({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY || '',
    environment: (process.env.DODO_PAYMENTS_ENVIRONMENT as "test_mode" | "live_mode") || 'live_mode',
});

