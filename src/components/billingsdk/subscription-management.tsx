"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, CreditCard } from "lucide-react";
import { CurrentPlan } from "@/lib/billingsdk-config";
import { cn } from "@/lib/utils";
import {
  CancelSubscriptionDialog,
  type CancelSubscriptionDialogProps,
} from "@/components/billingsdk/cancel-subscription-dialog";
import {
  UpdatePlanDialog,
  type UpdatePlanDialogProps,
} from "@/components/billingsdk/update-plan-dialog";

export interface SubscriptionManagementProps {
  className?: string;
  currentPlan: CurrentPlan;
  cancelSubscription: CancelSubscriptionDialogProps;
  updatePlan: UpdatePlanDialogProps;
}

export function SubscriptionManagement({
  className,
  currentPlan,
  cancelSubscription,
  updatePlan,
}: SubscriptionManagementProps) {
  return (
    <div className={cn("w-full text-left", className)}>
      <Card className="shadow-lg border-border bg-card text-card-foreground">
        <CardHeader className="px-4 pb-4 sm:px-6 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:gap-3 sm:text-xl text-foreground">
            <div className="bg-primary/10 ring-primary/20 rounded-lg p-1.5 ring-1 sm:p-2">
              <CreditCard className="text-primary h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            Current Subscription
          </CardTitle>
          <CardDescription className="text-sm sm:text-base text-muted-foreground">
            Manage your billing and subscription settings
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 px-4 sm:space-y-8 sm:px-6">
          {/* Current Plan Details with highlighted styling */}
          <div className="relative overflow-hidden rounded-xl border border-border bg-accent/40 p-3 sm:p-4">
            <div className="relative">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
                <div className="w-full">
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold sm:text-xl text-foreground">
                        {currentPlan.plan.title} Plan
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          currentPlan.status === "active"
                            ? "default"
                            : "outline"
                        }
                        className="text-xs font-medium shadow-sm sm:text-sm"
                      >
                        {currentPlan.type === `monthly`
                          ? `${currentPlan.plan.currency}${currentPlan.plan.monthlyPrice}/month`
                          : currentPlan.type === `yearly`
                            ? `${currentPlan.plan.currency}${currentPlan.plan.yearlyPrice}/year`
                            : `${currentPlan.price}`}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs shadow-sm backdrop-blur-sm sm:text-sm",
                          currentPlan.status === "trialing"
                            ? "border-amber-600/50 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : currentPlan.status === "active"
                              ? "border-emerald-600/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : currentPlan.status === "cancelled"
                                ? "border-red-600/50 bg-red-500/10 text-red-600 dark:text-red-400"
                                : "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300"
                        )}
                      >
                        {currentPlan.status === "trialing" ? "trial" : currentPlan.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="relative">
                    <p className="text-muted-foreground relative z-10 text-xs sm:text-sm">
                      {currentPlan.plan.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator className="via-border my-4 bg-gradient-to-r from-transparent to-transparent sm:my-6" />

          <div className="space-y-3 sm:space-y-4">
            <h4 className="flex items-center gap-2 text-base font-medium sm:text-lg text-foreground">
              <div className="bg-muted ring-border/50 rounded-md p-1 ring-1 sm:p-1.5">
                <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              </div>
              Billing Information
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6">
              <div className="group rounded-lg border border-border bg-card hover:bg-accent/50 p-2.5 transition-all duration-200 sm:p-3">
                <span className="text-muted-foreground mb-1 block text-xs sm:text-sm">
                  {currentPlan.status === "trialing"
                    ? "Trial ends"
                    : currentPlan.status === "cancelled"
                      ? "Access ends"
                      : currentPlan.status === "active"
                        ? "Next billing date"
                        : "Billing status"}
                </span>
                <div className="text-foreground group-hover:text-primary text-sm font-medium transition-colors duration-200 sm:text-base">
                  {currentPlan.status === "free" ? "No upcoming billing" : currentPlan.nextBillingDate}
                </div>
              </div>
              <div className="group rounded-lg border border-border bg-card hover:bg-accent/50 p-2.5 transition-all duration-200 sm:p-3">
                <span className="text-muted-foreground mb-1 block text-xs sm:text-sm">
                  Payment method
                </span>
                <div className="text-foreground group-hover:text-primary text-sm font-medium transition-colors duration-200 sm:text-base">
                  {(currentPlan.status === "free" || currentPlan.status === "trialing") ? "None" : currentPlan.paymentMethod}
                </div>
              </div>
            </div>
          </div>

          <Separator className="via-border my-4 bg-gradient-to-r from-transparent to-transparent sm:my-6" />

          <div className="flex flex-col gap-3 sm:flex-row">
            <UpdatePlanDialog
              className="mx-0 shadow-lg transition-all duration-200 hover:shadow-xl"
              {...updatePlan}
            />

            {(currentPlan.status === "active" || currentPlan.status === "trialing") && (
              <CancelSubscriptionDialog
                className="mx-0 shadow-lg transition-all duration-200 hover:shadow-xl"
                {...cancelSubscription}
              />
            )}
          </div>

          <div className="pt-4 sm:pt-6">
            <h4 className="mb-3 text-base font-medium sm:mb-4 sm:text-lg text-foreground">
              Current Plan Features
            </h4>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {currentPlan.plan.features.map((feature, index) => (
                <div
                  key={index}
                  className="group border-border bg-card hover:border-violet-500/30 hover:bg-violet-600/5 flex items-center gap-2 rounded-lg border p-2 transition-all duration-200 sm:p-2"
                >
                  <div className="bg-violet-500 group-hover:bg-violet-500 h-1 w-1 flex-shrink-0 rounded-full transition-all duration-200 group-hover:scale-125 sm:h-1.5 sm:w-1.5"></div>
                  <span className="text-muted-foreground group-hover:text-foreground text-xs transition-colors duration-200 sm:text-sm">
                    {feature.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
