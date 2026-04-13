import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { sendPaymentFailedEmail } from "@/lib/email";
import { sendEmailWithIdempotency, generateEmailIdempotencyKey } from "@/lib/emailIdempotency";
import { checkCsrfOrigin } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  try {
    const csrfError = checkCsrfOrigin(req);
    if (csrfError) return csrfError;

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as any));
    const reason: string | undefined = typeof body?.reason === "string" ? body.reason.slice(0, 500) : undefined;
    const planFromBody: "monthly" | "yearly" | undefined =
      body?.plan === "yearly" ? "yearly" : body?.plan === "monthly" ? "monthly" : undefined;

    const user = await db.user.findFirst({
      where: { clerkId: userId },
      select: { email: true, subscriptionPlan: true },
    });

    if (!user?.email) {
      return NextResponse.json({ ok: false, message: "No email found for user" }, { status: 200 });
    }

    const plan: "monthly" | "yearly" = planFromBody || (user.subscriptionPlan === "yearly" ? "yearly" : "monthly");

    const dateKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const idemKey = generateEmailIdempotencyKey("payment_failed", `ui_${userId}_${dateKey}`);

    await sendEmailWithIdempotency(idemKey, "payment_failed", user.email, () =>
      sendPaymentFailedEmail({
        email: user.email!,
        name: undefined,
        plan,
        reason,
      })
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[PaymentFailureNotify] error:", e);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
