import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { CustomerPortal } from "@dodopayments/nextjs";
import { resolveCustomerIdFromSubscription } from "@/lib/dodo";

/**
 * Dodo Payments Customer Portal Route (Next.js App Router)
 *
 * Behavior:
 * - If `customer_id` query param is present, forwards directly to the official handler.
 * - If missing, resolves the current user's customerId from DB.
 *   - If DB is missing, attempts to resolve via Dodo API using subscriptionId, persists it, then redirects.
 */
const customerPortalHandler = CustomerPortal({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY || "",
  environment:
    (process.env.DODO_PAYMENTS_ENVIRONMENT as "test_mode" | "live_mode") ||
    "live_mode",
});

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const customerIdFromQuery = sp.get("customer_id");

    // If already provided, delegate to Dodo handler
    if (customerIdFromQuery) {
      return customerPortalHandler(req);
    }

    // Resolve from authenticated user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user subscription identifiers
    const user = await db.user.findUnique({
      where: { clerkId: userId },
      select: { customerId: true, subscriptionId: true },
    });

    let resolvedCustomerId = user?.customerId ?? null;

    // Fallback: Resolve via Dodo API if we have a subscriptionId but no customerId yet
    if (!resolvedCustomerId && user?.subscriptionId) {
      const cid = await resolveCustomerIdFromSubscription(user.subscriptionId);
      if (cid) {
        resolvedCustomerId = cid;
        // Persist for future requests
        await db.user.update({
          where: { clerkId: userId },
          data: { customerId: cid },
        });
      } else {
        console.warn(
          "[CustomerPortal] Unable to resolve customer_id from subscription",
          user.subscriptionId
        );
      }
    }

    if (!resolvedCustomerId) {
      return NextResponse.json(
        { error: "Missing customer_id for current user" },
        { status: 400 }
      );
    }

    // Redirect to same route with ?customer_id=... so the adapter can process it
    const url = new URL(req.nextUrl);
    url.searchParams.set("customer_id", resolvedCustomerId);
    return NextResponse.redirect(url.toString(), { status: 302 });
  } catch (err) {
    console.error("[CustomerPortal] Error:", err);
    return NextResponse.json(
      { error: "Failed to open customer portal" },
      { status: 500 }
    );
  }
}

