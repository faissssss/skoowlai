import { NextRequest, NextResponse } from "next/server";
import { Checkout } from "@dodopayments/nextjs";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// Normalize environment to avoid issues with trailing whitespace in .env
const envRaw = (process.env.DODO_PAYMENTS_ENVIRONMENT || "live_mode").trim();
const normalizedEnv = envRaw === "test_mode" ? "test_mode" : "live_mode";

// Base Dodo handler
const dodoHandler = Checkout({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY || "",
  environment: normalizedEnv,
  returnUrl:
    process.env.DODO_PAYMENTS_RETURN_URL || "https://skoowlai.com/dashboard",
});



/**
 * Smart Checkout Handler
 * - Checks if user has already used their free trial
 * - Swaps to no-trial product if trial already used
 * - Falls back to original handler for unauthenticated users
 */
const TRIAL_TO_NO_TRIAL_MAP: Record<string, string> = {
  // Monthly: standard and student trial → monthly no-trial
  [process.env.NEXT_PUBLIC_DODO_MONTHLY_PRODUCT_ID || ""]:
    process.env.NEXT_PUBLIC_DODO_MONTHLY_NO_TRIAL_PRODUCT_ID || "",
  [process.env.NEXT_PUBLIC_DODO_STUDENT_MONTHLY_PRODUCT_ID || ""]:
    process.env.NEXT_PUBLIC_DODO_MONTHLY_NO_TRIAL_PRODUCT_ID || "",
  // Yearly: standard and student trial → yearly no-trial
  [process.env.NEXT_PUBLIC_DODO_YEARLY_PRODUCT_ID || ""]:
    process.env.NEXT_PUBLIC_DODO_YEARLY_NO_TRIAL_PRODUCT_ID || "",
  [process.env.NEXT_PUBLIC_DODO_STUDENT_YEARLY_PRODUCT_ID || ""]:
    process.env.NEXT_PUBLIC_DODO_YEARLY_NO_TRIAL_PRODUCT_ID || "",
};

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const productId = url.searchParams.get("productId");

    // If no productId, let Dodo handle the error
    if (!productId) {
      return dodoHandler(req);
    }

    // Check if user is authenticated and has used trial
    const { userId } = await auth();

    if (userId) {
      const user = await db.user.findUnique({
        where: { clerkId: userId },
        select: { trialUsedAt: true },
      });

      // If user has used trial, swap to no-trial product
      if (user?.trialUsedAt) {
        const noTrialProductId = TRIAL_TO_NO_TRIAL_MAP[productId];

        if (noTrialProductId && noTrialProductId !== productId) {
          console.log(`[Checkout] User ${userId} already used trial. Swapping ${productId} -> ${noTrialProductId}`);

          // Create new URL with swapped productId
          url.searchParams.set("productId", noTrialProductId);

          // Keep Dodo defaults for currency, country, and payment method types; do not override.

          // Create new request with modified URL
          const newReq = new NextRequest(url.toString(), {
            method: req.method,
            headers: req.headers,
          });

          return dodoHandler(newReq);
        }
      }
    }

    // Do not apply any hardening overrides; pass through to Dodo with defaults.

    // Default: pass through to Dodo handler
    return dodoHandler(req);
  } catch (error) {
    console.error("[Checkout] Error in smart checkout handler:", error);
    // On error, fall back to default behavior
    return dodoHandler(req);
  }
}

// POST handler remains unchanged
export const POST = Checkout({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY || "",
  environment: normalizedEnv,
  returnUrl:
    process.env.DODO_PAYMENTS_RETURN_URL || "https://skoowlai.com/dashboard",
});
