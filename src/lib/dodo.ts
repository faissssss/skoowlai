import DodoPayments from "dodopayments";

const apiKey = process.env.DODO_PAYMENTS_API_KEY || "";
// Normalize env (handles accidental trailing spaces in .env)
const envRaw = (process.env.DODO_PAYMENTS_ENVIRONMENT || "live_mode").trim();
const environment: "test_mode" | "live_mode" =
  envRaw === "test_mode" ? "test_mode" : "live_mode";

if (!apiKey) {
  // Log once on module load; runtime calls should still be resilient.
  console.warn(
    "[Dodo] DODO_PAYMENTS_API_KEY is not configured. Billing SDK calls will fail."
  );
}

/**
 * Minimal types to avoid 'any' while interfacing with the SDK.
 */
type SubscriptionLite = {
  customer?: { customer_id?: string | null } | null;
  customer_id?: string | null;
  customerId?: string | null;
};

type SubscriptionsApiLite = {
  retrieve?: (id: string) => Promise<unknown>;
  cancel?: (id: string) => Promise<unknown>;
  cancelSubscription?: (id: string) => Promise<unknown>;
};

type DodoClientLite = {
  subscriptions?: SubscriptionsApiLite;
};

/**
 * Officially configured Dodo client (treat as loosely typed to avoid build breaks
 * when SDK minor versions adjust method names). We only use read-only helpers here.
 */
export const dodoClient: DodoClientLite = (new DodoPayments({
  bearerToken: apiKey,
  environment,
}) as unknown) as DodoClientLite;

/**
 * Cancel a subscription via SDK (best-effort).
 * Tries common method names and returns false if unsupported.
 */
export async function cancelDodoSubscriptionViaSdk(
  subscriptionId: string
): Promise<boolean> {
  try {
    if (!apiKey || !subscriptionId) return false;

    if (dodoClient?.subscriptions?.cancel) {
      await dodoClient.subscriptions.cancel(subscriptionId);
      return true;
    }
    if (dodoClient?.subscriptions?.cancelSubscription) {
      await dodoClient.subscriptions.cancelSubscription(subscriptionId);
      return true;
    }

    console.warn(
      "[Dodo] Cancel method not available on SDK. Falling back to portal or webhook flow."
    );
    return false;
  } catch (error) {
    console.error("[Dodo] Failed to cancel subscription via SDK:", error);
    return false;
  }
}

/**
 * Resolve the customer_id from a Dodo subscription id using the SDK.
 * Returns null if not found.
 */
export async function resolveCustomerIdFromSubscription(
  subscriptionId: string
): Promise<string | null> {
  try {
    if (!subscriptionId) return null;

    // Use unknown and narrow to the minimal fields we need (avoid 'any')
    const subUnknown: unknown = await dodoClient?.subscriptions?.retrieve?.(
      subscriptionId
    );


    const sub = subUnknown as SubscriptionLite | null;
    const cid =
      sub?.customer?.customer_id ?? sub?.customer_id ?? sub?.customerId ?? null;

    return typeof cid === "string" && cid.length > 0 ? cid : null;
  } catch (error) {
    console.warn(
      "[Dodo] Failed to resolve customer_id from subscription:",
      error
    );
    return null;
  }
}

