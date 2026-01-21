import { Checkout } from "@dodopayments/nextjs";

// Normalize environment to avoid issues with trailing whitespace in .env
const envRaw = (process.env.DODO_PAYMENTS_ENVIRONMENT || "live_mode").trim();
const normalizedEnv = envRaw === "test_mode" ? "test_mode" : "live_mode";

// SECURITY: Using server-side only API key (not NEXT_PUBLIC_)
export const GET = Checkout({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY || "",
  environment: normalizedEnv,
  returnUrl:
    process.env.DODO_PAYMENTS_RETURN_URL || "https://skoowlai.com/dashboard",
});

export const POST = Checkout({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY || "",
  environment: normalizedEnv,
  returnUrl:
    process.env.DODO_PAYMENTS_RETURN_URL || "https://skoowlai.com/dashboard",
});

