import { CustomerPortal } from "@dodopayments/nextjs";

export const GET = CustomerPortal({
    bearerToken: process.env.NEXT_PUBLIC_DODO_PAYMENTS_API_KEY || 'dummy_token_for_build',
    environment: (process.env.NEXT_PUBLIC_DODO_PAYMENTS_ENVIRONMENT as "test_mode" | "live_mode") || 'test_mode',
});
