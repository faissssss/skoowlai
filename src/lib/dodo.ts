import Dodo from "dodopayments";

const apiKey = process.env.DODO_PAYMENTS_API_KEY || "";

if (!apiKey) {
  // We log once on module load; runtime calls should still be resilient.
  console.warn(
    "[Dodo] DODO_PAYMENTS_API_KEY is not configured. Billing SDK calls will fail."
  );
}

export const dodoClient = new Dodo(apiKey);

export async function cancelDodoSubscriptionViaSdk(
  subscriptionId: string
): Promise<boolean> {
  try {
    if (!apiKey) return false;

    await dodoClient.subscriptions.cancelSubscription(subscriptionId);
    return true;
  } catch (error) {
    console.error("[Dodo] Failed to cancel subscription via SDK:", error);
    return false;
  }
}

