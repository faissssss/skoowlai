"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Crown, Check, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, useSpring, useMotionValue } from "framer-motion";
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
  /** Show "14-day free trial" badge - only for trial-eligible users */
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
        <h2 className="text-3xl font-bold text-foreground mb-2 tracking-tight">
          {title}
        </h2>
        {props.subtitle ? (
          <p className="text-muted-foreground text-sm max-w-lg mx-auto leading-relaxed">
            {props.subtitle}
          </p>
        ) : null}
      </div>

      {/* Toggle - Compact */}
      {showBillingToggle ? (
        <div className="flex items-center justify-center px-4 pb-6">
          <div className="grid grid-cols-2 bg-muted/80 rounded-lg p-0.5 border border-border/50 w-full max-w-[240px]">
            <button
              type="button"
              className={`relative px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all duration-200 cursor-pointer ${interval === "monthly" ? "text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              onClick={() => setInterval("monthly")}
            >
              {interval === "monthly" && (
                <motion.div
                  layoutId="billing-toggle"
                  className="absolute inset-0 bg-primary rounded-md shadow-sm"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <span className="relative z-10">{billingToggleLabels.monthly}</span>
            </button>
            <button
              type="button"
              className={`relative px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all duration-200 cursor-pointer flex items-center justify-center gap-1 ${interval === "yearly" ? "text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              onClick={() => setInterval("yearly")}
            >
              {interval === "yearly" && (
                <motion.div
                  layoutId="billing-toggle"
                  className="absolute inset-0 bg-primary rounded-md shadow-sm"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <span className="relative z-10">{billingToggleLabels.yearly}</span>
              <span className="relative z-10 text-amber-400 text-[9px] font-bold px-1 py-px rounded bg-primary/10 border border-amber-400 leading-none shadow-sm">
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
          className={`relative rounded-xl border bg-card/40 border-border p-5 group hover:border-border/80 transition-colors duration-300 flex flex-col`}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          whileHover="hover"
          custom={0}
        >
          {/* Top Content (Compact Height) */}
          <div className="flex flex-col h-[190px]">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-base font-semibold text-foreground">{free.name}</h3>
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Box className="w-4 h-4 text-(--brand-secondary)" />
              </div>
            </div>

            <div className="flex items-baseline gap-1 mb-1 text-foreground">
              <span className="text-2xl font-bold">$</span>
              <span className="text-3xl font-bold">0</span>
              <span className="text-xs text-muted-foreground font-normal">/mo</span>
            </div>

            <div className="mt-1 mb-3">
              <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                {free.description}
              </p>
              {/* Spacer matching Pro's trial badge height area */}
              <div className="mt-2 h-[22px] w-full" />
            </div>

            <div className="mt-auto">
              <Button
                variant="outline"
                className="w-full border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border/80 h-9 text-xs rounded-lg transition-all"
                onClick={() => onPlanSelect(free.id, interval)}
                disabled={!!loadingPlanId}
              >
                Start for free
              </Button>
            </div>
          </div>

          {/* Divider Alignment */}
          <div className="my-4 border-t border-border/80" />

          <ul className="space-y-3">
            {free.features.map((f) => (
              <li key={f.text} className="flex items-start gap-3 text-foreground">
                <Check className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-[11px] leading-tight">{f.text}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* PRO CARD */}
        <motion.div
          // Removed overflow-hidden to fix clipped badge
          className="relative rounded-xl bg-card border border-border p-5 group flex flex-col"
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          whileHover="hover"
          custom={1}
        >
          {/* Glow Effects - Ensure rounded-xl clips them if card doesn't */}
          <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden">
            <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-primary/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--brand-secondary) to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-(--brand-secondary) to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </div>

          {/* 'Most Popular' Badge on Border - Now visible */}
          {activePlanId === pro.id || pro.badge ? (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
              <span className="bg-[#0B0D14] text-[#5B4DFF] text-[10px] font-bold px-3 py-1 rounded-full border border-[#5B4DFF] shadow-md whitespace-nowrap">
                Most popular
              </span>
            </div>
          ) : null}

          {/* Top Content (Compact Height matching Free) */}
          <div className="flex flex-col h-[190px]">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-base font-semibold text-foreground">{pro.name}</h3>
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Crown className="w-4 h-4 text-(--brand-secondary)" />
              </div>
            </div>

            <div className="flex items-baseline gap-1 mb-1 text-foreground">
              <span className="text-2xl font-bold">$</span>
              <span className="text-3xl font-bold">
                <NumberTicker
                  value={parsePrice(
                    interval === "yearly" ? pro.priceYearlyPerMonth : pro.priceMonthly
                  )}
                />
              </span>
              <span className="text-xs text-muted-foreground font-normal">/mo</span>
            </div>

            <div className="mt-1 mb-3">
              <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                {interval === "yearly" ? "Billed annually" : "Billed monthly"}
              </p>
              <div className="mt-2 h-[22px] flex items-center">
                {showTrialBadge ? (
                  <span className="inline-block bg-primary/10 text-amber-400 text-[10px] font-medium px-2 py-0.5 rounded border border-amber-400 leading-none shadow-sm">
                    14-day free trial included
                  </span>
                ) : (
                  <span className="inline-block text-muted-foreground text-[10px]">
                    Billed {interval === "yearly" ? "$39.99/year" : "$4.99/month"}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-auto">
              <Button
                className={`w-full h-9 text-xs rounded-lg font-medium transition-all ${currentPlanInterval === interval
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : "bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
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
          <div className="my-4 border-t border-border/50" />

          <ul className="space-y-3">
            {pro.features.map((f) => (
              <li key={f.text} className="flex items-start gap-3 text-foreground">
                <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <span className="text-[11px] leading-tight">{f.text}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </div>
  );
}
