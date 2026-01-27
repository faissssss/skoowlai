import { NextRequest, NextResponse } from "next/server";
import DodoPayments from "dodopayments";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

const envRaw = (process.env.DODO_PAYMENTS_ENVIRONMENT || "live_mode").trim();
const environment: "test_mode" | "live_mode" = envRaw === "test_mode" ? "test_mode" : "live_mode";
const apiKey = process.env.DODO_PAYMENTS_API_KEY || "";
const defaultReturn = process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard` : "https://skoowlai.com/dashboard";
const returnUrl = process.env.DODO_PAYMENTS_RETURN_URL || defaultReturn;

if (!apiKey) {
  console.warn("[CheckoutSession] DODO_PAYMENTS_API_KEY is missing; session creation will fail.");
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    // Overlay/JSON flags not used in hosted flow
    const productId =
      url.searchParams.get("productId") ||
      process.env.NEXT_PUBLIC_DODO_YEARLY_NO_TRIAL_PRODUCT_ID ||
      process.env.NEXT_PUBLIC_DODO_MONTHLY_NO_TRIAL_PRODUCT_ID ||
      "";

    if (!productId) {
      return NextResponse.json({ error: "Missing productId" }, { status: 400 });
    }

    const quantityStr = url.searchParams.get("quantity");
    const quantity = quantityStr ? Math.max(1, parseInt(quantityStr, 10)) : 1;

    // Use Dodo defaults; do not override currency or country via query

    // No checkout hardening overrides; keep default UI/format

    const client = new DodoPayments({ bearerToken: apiKey, environment });

    let customerBlock: { email?: string } | undefined;
    const { userId } = await auth();
    if (userId) {
      const user = await db.user.findUnique({
        where: { clerkId: userId },
        select: { email: true },
      });
      if (user?.email) {
        customerBlock = { email: user.email };
      }
    }

    // Default body: rely on Dodo's default checkout UI and formats
    const baseBody: any = {
      product_cart: [{ product_id: productId, quantity }],
      return_url: returnUrl,
    };

    if (customerBlock) baseBody.customer = customerBlock;

    const requestBody = baseBody;

    // Attempt session creation with chosen strategy
    const createSession = async (body: any) => {
      return await (client as any).checkoutSessions.create(body);
    };

    let session: any;
    try {
      session = await createSession(requestBody);
    } catch (err: any) {
      const msg = String(err?.message || err);
      console.warn("[CheckoutSession] Session creation failed:", msg);
      throw err;
    }

    const checkoutUrl: string | null = session?.checkout_url || null;
    const sessionId: string | null = session?.session_id || session?.sessionId || null;
    console.log(`[CheckoutSession] Created session ${sessionId ?? "unknown"} (${environment})`);

    if (checkoutUrl) {
      return NextResponse.redirect(checkoutUrl, 302);
    }
    return NextResponse.json(session || { session_id: sessionId }, { status: 200 });
  } catch (error) {
    console.error("[CheckoutSession] Failed to create session:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}