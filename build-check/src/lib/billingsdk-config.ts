export type BillingInterval = "monthly" | "yearly";

export type PlanFeature = {
  text: string;
  name: string; // For SubscriptionManagement component compatibility
};

export type Plan = {
  id: string;
  name: string;
  title: string; // Display title for SubscriptionManagement
  description: string;
  /**
   * Price display strings (UI only).
   */
  priceMonthly: string;
  priceYearlyPerMonth: string;
  yearlyTotal: string;
  // For SubscriptionManagement component
  monthlyPrice: string;
  yearlyPrice: string;
  currency: string;
  badge?: string;
  features: PlanFeature[];
  /**
   * Dodo product IDs for checkout. For free plan these can be omitted.
   */
  dodoProductIdMonthly?: string;
  dodoProductIdYearly?: string;
};

export type CurrentPlan = {
  plan: Plan;
  type: BillingInterval;
  price: string;
  nextBillingDate: string;
  paymentMethod: string;
  status: "active" | "trialing" | "cancelled" | "expired" | "free";
};

// NOTE: Dodo product IDs are provided via env in the UI layer to keep this file server-safe and portable.
export const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    title: "Free",
    description: "Always free",
    priceMonthly: "$0",
    priceYearlyPerMonth: "$0",
    yearlyTotal: "$0",
    monthlyPrice: "0",
    yearlyPrice: "0",
    currency: "$",
    features: [
      { text: "3 study decks/day", name: "3 study decks/day" },
      { text: "5 flashcards/day", name: "5 flashcards/day" },
      { text: "5 quizzes/day", name: "5 quizzes/day" },
      { text: "5 mind maps/day", name: "5 mind maps/day" },
      { text: "20 AI chat messages/day", name: "20 AI chat/day" },
      { text: "Smart notes generation", name: "Smart notes" },
      { text: "Shared decks & collaboration", name: "Collaboration" },
    ],
  },
  {
    id: "pro",
    name: "Pro Plan",
    title: "Pro",
    description: "Unlock your full learning potential",
    priceMonthly: "$4.99",
    priceYearlyPerMonth: "$3.33",
    yearlyTotal: "$39.99",
    monthlyPrice: "4.99",
    yearlyPrice: "39.99",
    currency: "$",
    badge: "Popular",
    features: [
      { text: "Unlimited study decks", name: "Unlimited decks" },
      { text: "Unlimited flashcards", name: "Unlimited flashcards" },
      { text: "Unlimited quizzes", name: "Unlimited quizzes" },
      { text: "Unlimited mind maps", name: "Unlimited mind maps" },
      { text: "Custom flashcard & quiz count", name: "Custom counts" },
      { text: "100 AI chat messages/day", name: "100 AI chat/day" },
      { text: "Smart notes generation", name: "Smart notes" },
      { text: "Shared decks & collaboration", name: "Collaboration" },
    ],
  },
];
