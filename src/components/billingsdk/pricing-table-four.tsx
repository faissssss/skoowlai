"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Crown, Check, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence, useSpring, useMotionValue, useTransform } from "framer-motion";
import type { BillingInterval, Plan } from "@/lib/billingsdk-config";

type BillingToggleLabels = {
  monthly: string;
  yearly: string;
};

function NumberTicker({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { damping: 30, stiffness: 100 });
  const isInView = true;

  useEffect(() => {
    if (isInView) {
      motionValue.set(value);
    }
  }, [motionValue, isInView, value]);

  useEffect(() => {
    springValue.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = Intl.NumberFormat("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(latest);
      }
    });

    return () => springValue.clearListeners();
  }, [springValue]);

  return <span ref={ref} />;
}

const parsePrice = (priceStr: string) => {
  const num = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
  return isNaN(num) ? 0 : num;
}

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
  loadingPlanId?: string | null;
  activePlanId?: string;
  /** Show "7-day free trial" badge - only for trial-eligible users */
  showTrialBadge?: boolean;
  /** Current user's plan interval (monthly/yearly) - disables that option */
  currentPlanInterval?: BillingInterval | null;
}) {
  const {
    plans,
    title,
    onPlanSelect,
    className,
    showBillingToggle = true,
    billingToggleLabels = { monthly: "Monthly", yearly: "Yearly" },
    theme = "minimal",
    loadingPlanId,
    activePlanId,
    showTrialBadge = true,
    currentPlanInterval = null,
  } = props;

  const [interval, setInterval] = useState<BillingInterval>("monthly");

  const pro = useMemo(() => plans.find((p) => p.id === "pro") ?? plans[1], [plans]);
  const free = useMemo(() => plans.find((p) => p.id === "free") ?? plans[0], [plans]);

  const cardVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.98 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        delay: i * 0.1,
        duration: 0.3,
        ease: "easeOut" as const,
      },
    }),
    hover: {
      y: -2,
      scale: 1.01,
      transition: { duration: 0.2, ease: "easeOut" as const },
    },
  };

  return (
    <div className={className}>
      {/* Header - Project-themed Title */}
      <div className="text-center px-4 pt-2 pb-5">
        <h2 className="text-3xl font-bold text-slate-100 mb-2 tracking-tight">
          {title}
        </h2>
        {props.subtitle ? (
          <p className="text-slate-400 text-sm max-w-lg mx-auto leading-relaxed">
            {props.subtitle}
          </p>
        ) : null}
      </div>

      {/* Toggle - Compact */}
      {showBillingToggle ? (
        <div className="flex items-center justify-center px-4 pb-6">
          <div className="grid grid-cols-2 bg-slate-800/80 rounded-lg p-0.5 border border-slate-700/50 w-full max-w-[240px]">
            <button
              type="button"
              className={`relative px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all duration-200 cursor-pointer ${interval === "monthly" ? "text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              onClick={() => setInterval("monthly")}
            >
              {interval === "monthly" && (
                <motion.div
                  layoutId="billing-toggle"
                  className="absolute inset-0 bg-violet-600 rounded-md shadow-sm"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <span className="relative z-10">{billingToggleLabels.monthly}</span>
            </button>
            <button
              type="button"
              className={`relative px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all duration-200 cursor-pointer flex items-center justify-center gap-1 ${interval === "yearly" ? "text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              onClick={() => setInterval("yearly")}
            >
              {interval === "yearly" && (
                <motion.div
                  layoutId="billing-toggle"
                  className="absolute inset-0 bg-violet-600 rounded-md shadow-sm"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <span className="relative z-10">{billingToggleLabels.yearly}</span>
              <span className="relative z-10 text-[9px] font-bold px-1 py-px rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 leading-none">
                -33%
              </span>
            </button>
          </div>
        </div>
      ) : null}

      {/* Cards - Compact Grid with Aligned Sections */}
      <div className="px-4 pb-2 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl mx-auto">

        {/* FREE CARD */}
        <motion.div
          // Removed overflow-hidden to allow potential badges (though free usually has none)
          // Added 'relative' and 'z-10' to ensure stacking context if needed
          className={`relative rounded-xl border bg-slate-900/40 border-slate-800 p-5 group hover:border-slate-700 transition-colors duration-300 flex flex-col`}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          whileHover="hover"
          custom={0}
        >
          {/* Top Content (Compact Height) */}
          <div className="flex flex-col h-[190px]">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-base font-semibold text-white">{free.name}</h3>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Box className="w-4 h-4 text-blue-400" />
              </div>
            </div>

            <div className="flex items-baseline gap-1 mb-1 text-white">
              <span className="text-2xl font-bold">$</span>
              <span className="text-3xl font-bold">0</span>
              <span className="text-xs text-slate-500 font-normal">/mo</span>
            </div>

            <div className="mt-1 mb-3">
              <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                {free.description}
              </p>
              {/* Spacer matching Pro's trial badge height area */}
              <div className="mt-2 h-[22px] w-full" />
            </div>

            <div className="mt-auto">
              <Button
                variant="outline"
                className="w-full border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800 hover:text-white hover:border-slate-600 h-9 text-xs rounded-lg transition-all"
                onClick={() => onPlanSelect(free.id, interval)}
                disabled={!!loadingPlanId}
              >
                Start for free
              </Button>
            </div>
          </div>

          {/* Divider Alignment */}
          <div className="my-4 border-t border-slate-800/80" />

          <ul className="space-y-3">
            {free.features.map((f) => (
              <li key={f.text} className="flex items-start gap-3 text-slate-300">
                <Check className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                <span className="text-[11px] leading-tight">{f.text}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* PRO CARD */}
        <motion.div
          // Removed overflow-hidden to fix clipped badge
          className="relative rounded-xl bg-slate-900 border border-slate-800 p-5 group flex flex-col"
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          whileHover="hover"
          custom={1}
        >
          {/* Glow Effects - Ensure rounded-xl clips them if card doesn't */}
          <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden">
            <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-violet-500/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-violet-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-violet-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </div>

          {/* 'Most Popular' Badge on Border - Now visible */}
          {activePlanId === pro.id || pro.badge ? (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
              <span className="bg-slate-950 text-white text-[10px] font-bold px-3 py-1 rounded-full border border-slate-800 shadow-sm whitespace-nowrap">
                Most popular
              </span>
            </div>
          ) : null}

          {/* Top Content (Compact Height matching Free) */}
          <div className="flex flex-col h-[190px]">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-base font-semibold text-white">{pro.name}</h3>
              <div className="w-8 h-8 rounded-lg bg-violet-600/10 flex items-center justify-center">
                <Crown className="w-4 h-4 text-violet-400" />
              </div>
            </div>

            <div className="flex items-baseline gap-1 mb-1 text-white">
              <span className="text-2xl font-bold">$</span>
              <span className="text-3xl font-bold">
                <NumberTicker
                  value={parsePrice(
                    interval === "yearly" ? pro.priceYearlyPerMonth : pro.priceMonthly
                  )}
                />
              </span>
              <span className="text-xs text-slate-500 font-normal">/mo</span>
            </div>

            <div className="mt-1 mb-3">
              <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                {interval === "yearly" ? "Billed annually" : "Billed monthly"}
              </p>
              <div className="mt-2 h-[22px] flex items-center">
                {showTrialBadge ? (
                  <span className="inline-block bg-gradient-to-r from-emerald-400/10 to-emerald-500/10 text-emerald-400 text-[10px] font-medium px-2 py-0.5 rounded border border-emerald-500/20 leading-none">
                    7-day free trial included
                  </span>
                ) : (
                  <span className="inline-block text-slate-500 text-[10px]">
                    Billed {interval === "yearly" ? "$39.99/year" : "$4.99/month"}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-auto">
              <Button
                className={`w-full h-9 text-xs rounded-lg font-medium transition-all ${currentPlanInterval === interval
                    ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                    : "bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20"
                  }`}
                onClick={() => onPlanSelect(pro.id, interval)}
                disabled={!!loadingPlanId || currentPlanInterval === interval}
              >
                {loadingPlanId === pro.id
                  ? "Processing..."
                  : currentPlanInterval === interval
                    ? "Current Plan"
                    : currentPlanInterval
                      ? interval === "yearly" ? "Upgrade to Yearly" : "Switch to Monthly"
                      : "Upgrade Now"
                }
              </Button>
            </div>
          </div>

          {/* Divider Alignment */}
          <div className="my-4 border-t border-slate-700/50" />

          <ul className="space-y-3">
            {pro.features.map((f) => (
              <li key={f.text} className="flex items-start gap-3 text-slate-300">
                <Check className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                <span className="text-[11px] leading-tight">{f.text}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </div>
  );
}
