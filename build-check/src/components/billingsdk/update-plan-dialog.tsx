"use client";

import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { SettingsButton } from "@/components/ui/settings-button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Toggle } from "@/components/ui/toggle";
import { Label } from "@/components/ui/label";
import { type Plan, type BillingInterval } from "@/lib/billingsdk-config";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState, useCallback } from "react";

export interface UpdatePlanDialogProps {
  currentPlan: Plan;
  plans: Plan[];
  triggerText: string;
  onPlanChange: (planId: string) => void;
  className?: string;
  title?: string;
  /** The user's current plan interval (monthly/yearly). Used to mark Current Plan correctly. */
  currentInterval: BillingInterval;
}

const easing = [0.4, 0, 0.2, 1] as const;

export function UpdatePlanDialog({
  currentPlan,
  plans,
  onPlanChange,
  className,
  title,
  triggerText,
  currentInterval,
}: UpdatePlanDialogProps) {
  const [isYearly, setIsYearly] = useState(currentInterval === "yearly");
  const [selectedPlan, setSelectedPlan] = useState<string | undefined>(
    undefined,
  );
  const [isOpen, setIsOpen] = useState(false);

  const getCurrentPrice = useCallback(
    (plan: Plan) => (isYearly ? `${plan.yearlyPrice}` : `${plan.monthlyPrice}`),
    [isYearly],
  );

  const handlePlanChange = useCallback((planId: string) => {
    setSelectedPlan((prev) => (prev === planId ? undefined : planId));
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setSelectedPlan(undefined);
    }
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <SettingsButton className="bg-violet-600 hover:bg-violet-700 text-white shadow-sm hover:shadow-md transition-all">
          {triggerText || "Update Plan"}
        </SettingsButton>
      </DialogTrigger>
      <DialogContent
        className={cn(
          "text-foreground flex max-h-[95vh] flex-col gap-3 sm:max-h-[90vh] sm:gap-4",
          "w-[calc(100vw-2rem)] max-w-2xl sm:w-full",
          "p-4 sm:p-6 bg-card border border-border text-foreground rounded-xl shadow-2xl",
          className,
        )}
      >
        <DialogHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pb-0">
          <DialogTitle className="text-2xl font-bold text-foreground sm:text-2xl">
            {title || "Upgrade Plan"}
          </DialogTitle>
          <div className="flex items-center gap-1.5 text-sm sm:gap-2">
            <Toggle
              size="sm"
              pressed={!isYearly}
              onPressedChange={(pressed) => setIsYearly(!pressed)}
              className="h-9 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm rounded-md bg-muted border-border text-foreground data-[state=on]:bg-primary data-[state=on]:text-white"
            >
              Monthly
            </Toggle>
            <Toggle
              size="sm"
              pressed={isYearly}
              onPressedChange={(pressed) => setIsYearly(pressed)}
              className="h-9 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm rounded-md bg-muted border-border text-foreground data-[state=on]:bg-primary data-[state=on]:text-white"
            >
              Yearly
            </Toggle>
          </div>
        </DialogHeader>
        <div
          className="[&::-webkit-scrollbar-thumb]:bg-muted hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 -mx-4 min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-track]:bg-transparent"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "hsl(var(--muted)) transparent",
          }}
        >
          {plans.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-center">
              <p className="text-muted-foreground text-sm">
                No plans available
              </p>
            </div>
          ) : (
            <RadioGroup value={selectedPlan} onValueChange={handlePlanChange}>
              <div className="space-y-2.5 pr-0.5 pb-2 sm:space-y-3">
                {plans.map((plan, index) => (
                  <motion.div
                    key={plan.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      layout: { duration: 0.3, ease: easing },
                      opacity: {
                        delay: index * 0.05,
                        duration: 0.3,
                        ease: easing,
                      },
                      y: { delay: index * 0.05, duration: 0.3, ease: easing },
                    }}
                    onClick={() => handlePlanChange(plan.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handlePlanChange(plan.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-pressed={selectedPlan === plan.id}
                    className={cn(
                      "relative cursor-pointer overflow-hidden rounded-lg border transition-all duration-200 sm:rounded-xl",
                      "focus-visible:ring-primary touch-manipulation focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                      selectedPlan === plan.id
                        ? "border-primary bg-card/70 ring-1 ring-primary/30"
                        : "border-border hover:border-border/80 bg-card/40",
                    )}
                  >
                    <motion.div layout="position" className="p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-2 sm:gap-3">
                        <div className="flex min-w-0 flex-1 gap-2 sm:gap-3">
                          <RadioGroupItem
                            value={plan.id}
                            id={plan.id}
                            className="pointer-events-none mt-0.5 shrink-0 sm:mt-1"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                              <Label
                                htmlFor={plan.id}
                                className="cursor-pointer text-sm leading-tight font-semibold sm:text-base sm:font-medium text-foreground"
                              >
                                {plan.title}
                              </Label>
                              {plan.badge && (
                                <Badge
                                  variant="secondary"
                                  className="h-5 shrink-0 px-1.5 py-0 text-[10px] sm:h-auto sm:px-2 sm:py-0.5 sm:text-xs bg-muted/60 text-foreground border border-border"
                                >
                                  {plan.badge}
                                </Badge>
                              )}
                            </div>
                            <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed sm:text-xs">
                              {plan.description}
                            </p>
                            {plan.features.length > 0 && (
                              <div className="pt-2 sm:pt-3">
                                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                  {plan.features.map(
                                    (feature, featureIndex) => (
                                      <div
                                        key={featureIndex}
                                        className="bg-muted/40 border-border flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 sm:gap-2 sm:rounded-lg"
                                      >
                                        <div className="bg-primary h-1 w-1 shrink-0 rounded-full sm:h-1.5 sm:w-1.5" />
                                        <span className="text-muted-foreground text-[10px] leading-none whitespace-nowrap sm:text-xs">
                                          {feature.name}
                                        </span>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="min-w-[60px] shrink-0 text-right sm:min-w-[80px]">
                          <div className="text-base leading-tight font-bold sm:text-xl sm:font-semibold text-foreground">
                            {parseFloat(getCurrentPrice(plan)) >= 0
                              ? `${plan.currency}${getCurrentPrice(plan)}`
                              : getCurrentPrice(plan)}
                          </div>
                          <div className="text-muted-foreground mt-0.5 text-[10px] sm:text-xs">
                            /{isYearly ? "year" : "month"}
                          </div>
                        </div>
                      </div>
                    </motion.div>

                    <AnimatePresence initial={false}>
                      {selectedPlan === plan.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{
                            height: "auto",
                            opacity: 1,
                            transition: {
                              height: { duration: 0.3, ease: easing },
                              opacity: {
                                duration: 0.25,
                                delay: 0.05,
                                ease: easing,
                              },
                            },
                          }}
                          exit={{
                            height: 0,
                            opacity: 0,
                            transition: {
                              height: { duration: 0.25, ease: easing },
                              opacity: { duration: 0.15, ease: easing },
                            },
                          }}
                          className="overflow-hidden"
                        >
                          <motion.div
                            initial={{ y: -8 }}
                            animate={{
                              y: 0,
                              transition: {
                                duration: 0.25,
                                delay: 0.05,
                                ease: easing,
                              },
                            }}
                            exit={{ y: -8 }}
                            className="px-3 pb-3 sm:px-4 sm:pb-4"
                          >
                            <Button
                              className={cn(
                                "h-10 w-full touch-manipulation text-sm font-medium sm:h-11 sm:text-base",
                                plan.id === "free"
                                  ? "border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                                  : (selectedPlan === currentPlan.id &&
                                      ((isYearly ? "yearly" : "monthly") === currentInterval)
                                        ? ""
                                        : "bg-linear-to-r from-primary to-(--brand-secondary) text-white hover:from-primary/90 hover:to-(--brand-secondary)/90 shadow-lg shadow-primary/20")
                              )}
                              disabled={
                                plan.id !== "free" &&
                                selectedPlan === currentPlan.id &&
                                ((isYearly ? "yearly" : "monthly") === currentInterval)
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                onPlanChange(plan.id);
                                handleOpenChange(false);
                              }}
                            >
                              {plan.id === "free"
                                ? "Start for free"
                                : selectedPlan === currentPlan.id
                                  ? ((isYearly ? "yearly" : "monthly") === currentInterval
                                      ? "Current Plan"
                                      : (isYearly ? "Upgrade to Yearly" : "Switch to Monthly"))
                                  : "Upgrade"}
                            </Button>
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            </RadioGroup>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
