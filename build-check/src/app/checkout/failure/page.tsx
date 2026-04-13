"use client";

import React, { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PaymentFailure } from "../../../components/billingsdk/payment-failure";

function PaymentFailureContent() {
  const [isRetrying, setIsRetrying] = useState(false);
  const router = useRouter();
  const search = useSearchParams();

  // Prefer productId from query (?productId=...), otherwise fall back to env (monthly first).
  const productIdQuery = search?.get("productId") || "";
  const defaultMonthly =
    process.env.NEXT_PUBLIC_DODO_MONTHLY_PRODUCT_ID ||
    process.env.NEXT_PUBLIC_DODO_MONTHLY_NO_TRIAL_PRODUCT_ID ||
    process.env.NEXT_PUBLIC_DODO_YEARLY_NO_TRIAL_PRODUCT_ID ||
    process.env.NEXT_PUBLIC_DODO_YEARLY_PRODUCT_ID ||
    "";
  const productId = productIdQuery || defaultMonthly;

  // Optional message passed via ?m=...
  const failureMessage = search?.get("m") || undefined;

  // Optional plan hint (?plan=monthly|yearly)
  const planParam = (search?.get("plan") === "yearly" ? "yearly" : search?.get("plan") === "monthly" ? "monthly" : undefined) as
    | "monthly"
    | "yearly"
    | undefined;

  // Block retry if ?block=1 (used when reasons indicate hard failure)
  const block = search?.get("block") === "1";
  const canRetry = useMemo(() => !block, [block]);

  const handleRetry = async () => {
    if (!canRetry) return;
    setIsRetrying(true);
    try {
      if (productId) {
        // Kick off a fresh Hosted Checkout session for the selected product
        router.push(`/api/checkout?productId=${encodeURIComponent(productId)}`);
      } else {
        // If no product configured, return user home
        router.push("/dashboard");
      }
    } finally {
      setIsRetrying(false);
    }
  };

  // Send payment failure email once on mount (best-effort; requires auth)
  const notified = useRef(false);
  useEffect(() => {
    if (notified.current) return;
    notified.current = true;
    // Fire-and-forget; ignore errors (e.g., unauthenticated)
    fetch("/api/notifications/payment-failure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: failureMessage, plan: planParam }),
    }).catch(() => { });
  }, [failureMessage, planParam]);

  return (
    <PaymentFailure
      isRetrying={isRetrying}
      onRetry={canRetry ? handleRetry : undefined}
      onSecondary={() => router.push("/dashboard")}
      onTertiary={() => {
        if (typeof window !== "undefined") {
          window.location.href = "mailto:yourskoowlai@gmail.com";
        }
      }}
      message={failureMessage}
      reasons={[
        "Insufficient funds in your account",
        "Incorrect card details or expired card",
        "Card declined by your bank",
        "Network connection issues",
      ]}
    />
  );
}

export default function PaymentFailurePage() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <Suspense fallback={<div>Loading...</div>}>
        <PaymentFailureContent />
      </Suspense>
    </div>
  );
}