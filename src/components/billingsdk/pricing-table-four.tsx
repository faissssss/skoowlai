"use client";

import { useMemo, useState } from "react";
import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BillingInterval, Plan } from "@/lib/billingsdk-config";

type BillingToggleLabels = {
  monthly: string;
  yearly: string;
};

export function PricingTableFour(props: {
  plans: Plan[];
  title: string;
  subtitle?: string;
  description?: string;
  onPlanSelect: (planId: string, interval: BillingInterval) => void;
  className?: string;
  showBillingToggle?: boolean;
  billingToggleLabels?: BillingToggleLabels;
  theme?: "minimal" | "classic";
  size?: "small" | "medium" | "large";
  /** Optional UI state */
  loadingPlanId?: string | null;
  activePlanId?: string;
}) {
  const {
    plans,
    title,
    subtitle,
    description,
    onPlanSelect,
    className,
    showBillingToggle = true,
    billingToggleLabels = { monthly: "Monthly", yearly: "Yearly" },
    theme = "minimal",
    size = "medium",
    loadingPlanId,
    activePlanId,
  } = props;

  const [interval, setInterval] = useState<BillingInterval>("yearly");

  const pro = useMemo(() => plans.find((p) => p.id === "pro") ?? plans[1], [plans]);
  const free = useMemo(() => plans.find((p) => p.id === "free") ?? plans[0], [plans]);

  const container = theme === "minimal"
    ? "bg-slate-900/70 border-slate-700/50"
    : "bg-slate-900 border-slate-700/70";

  const titleSize =
    size === "large" ? "text-2xl" : size === "small" ? "text-base" : "text-lg";

  return (
    <div className={className}>
      <div className="text-center px-4 pt-4 pb-2">
        {subtitle ? (
          <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">
            {subtitle}
          </div>
        ) : null}
        <h2 className={`${titleSize} font-bold text-white flex items-center justify-center gap-2`}>
          <Crown className="w-4 h-4 text-yellow-400" />
          {title}
        </h2>
        {description ? (
          <p className="text-slate-400 text-[11px] sm:text-xs mt-1">{description}</p>
        ) : null}
      </div>

      {showBillingToggle ? (
        <div className="flex items-center justify-center gap-2 px-4 pt-2">
          <span className={`text-sm ${interval === "monthly" ? "text-white" : "text-slate-400"}`}>
            {billingToggleLabels.monthly}
          </span>
          <button
            type="button"
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              interval === "yearly" ? "bg-violet-600" : "bg-slate-700"
            }`}
            onClick={() => setInterval((v) => (v === "yearly" ? "monthly" : "yearly"))}
            aria-label="Toggle billing interval"
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                interval === "yearly" ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </button>
          <span className={`text-sm ${interval === "yearly" ? "text-white" : "text-slate-400"}`}>
            {billingToggleLabels.yearly}
          </span>
        </div>
      ) : null}

      <div className="p-4 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Free */}
        <div className={`rounded-2xl border ${container} p-5`}>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-white">{free.name}</h3>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold text-white">{free.priceMonthly}</span>
            </div>
            <p className="text-xs text-slate-400">{free.description}</p>
          </div>

          <ul className="mt-5 space-y-3">
            {free.features.map((f) => (
              <li key={f.text} className="flex items-start gap-2 text-sm text-slate-200">
                <span className="mt-[2px] text-yellow-400">✓</span>
                <span>{f.text}</span>
              </li>
            ))}
          </ul>

          <Button
            className="mt-6 w-full bg-violet-600 hover:bg-violet-700 text-white"
            disabled={!!loadingPlanId}
            onClick={() => onPlanSelect(free.id, interval)}
          >
            Switch to this plan
          </Button>
        </div>

        {/* Pro */}
        <div className={`rounded-2xl border ${container} p-5 relative overflow-hidden`}>
          {activePlanId === pro.id || pro.badge ? (
            <div className="absolute right-5 top-5">
              <span className="rounded-full bg-violet-600/90 px-3 py-1 text-xs font-medium text-white">
                {activePlanId === pro.id ? "Active" : pro.badge}
              </span>
            </div>
          ) : null}

          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-white">{pro.name}</h3>

            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold text-white">
                {interval === "yearly" ? pro.priceYearlyPerMonth : pro.priceMonthly}
              </span>
              <span className="text-sm text-slate-400 mb-1">/month</span>
            </div>

            <p className="text-xs text-slate-400">
              {interval === "yearly" ? (
                <span>
                  Billed annually{" "}
                  <span className="text-slate-500">( {pro.yearlyTotal} / year · 33% off )</span>
                </span>
              ) : (
                <span>Billed monthly</span>
              )}
            </p>
          </div>

          <ul className="mt-5 space-y-3">
            {pro.features.map((f) => (
              <li key={f.text} className="flex items-start gap-2 text-sm text-slate-200">
                <span className="mt-[2px] text-yellow-400">✓</span>
                <span>{f.text}</span>
              </li>
            ))}
          </ul>

          <Button
            className="mt-6 w-full bg-violet-600 hover:bg-violet-700 text-white"
            disabled={!!loadingPlanId}
            onClick={() => onPlanSelect(pro.id, interval)}
          >
            {loadingPlanId === pro.id ? "Redirecting..." : "Resubscribe"}
          </Button>
        </div>
      </div>
    </div>
  );
}

