export type BillingInterval = "monthly" | "yearly";

export type PlanFeature = {
  text: string;
};

export type Plan = {
  id: string;
  name: string;
  description: string;
  /**
   * Price display strings (UI only).
   * For Pro: monthly shows "$4.99", yearly shows "$3.33" (per month), and we also show "$39.99/yr".
   */
  priceMonthly: string;
  priceYearlyPerMonth: string;
  yearlyTotal: string;
  badge?: string;
  features: PlanFeature[];
  /**
   * Dodo product IDs for checkout. For free plan these can be omitted.
   */
  dodoProductIdMonthly?: string;
  dodoProductIdYearly?: string;
};

// NOTE: Dodo product IDs are provided via env in the UI layer to keep this file server-safe and portable.
export const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    description: "Always free",
    priceMonthly: "$0",
    priceYearlyPerMonth: "$0",
    yearlyTotal: "$0",
    features: [
      { text: "3 study decks/day" },
      { text: "5 flashcards/day" },
      { text: "5 quizzes/day" },
      { text: "5 mind maps/day" },
      { text: "20 AI chat messages/day" },
      { text: "Smart notes generation" },
      { text: "Shared decks & collaboration" },
    ],
  },
  {
    id: "pro",
    name: "Pro Plan",
    description: "Unlock your full learning potential",
    priceMonthly: "$4.99",
    priceYearlyPerMonth: "$3.33",
    yearlyTotal: "$39.99",
    badge: "Active",
    features: [
      { text: "Unlimited study decks" },
      { text: "Unlimited flashcards" },
      { text: "Unlimited quizzes" },
      { text: "Unlimited mind maps" },
      { text: "Custom flashcard & quiz count" },
      { text: "100 AI chat messages/day" },
      { text: "Smart notes generation" },
      { text: "Shared decks & collaboration" },
    ],
  },
];

