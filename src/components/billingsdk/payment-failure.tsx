"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CircleX, Loader2 } from "lucide-react";

type Props = {
  title?: string;
  subtitle?: string;
  message?: string;
  reasons?: string[];
  isRetrying?: boolean;
  retryButtonText?: string;
  secondaryButtonText?: string;
  tertiaryButtonText?: string;
  onRetry?: () => void | Promise<void>;
  onSecondary?: () => void;
  onTertiary?: () => void;
  className?: string;
};

const DEFAULT_REASONS = [
  "Insufficient funds in your account",
  "Incorrect card details or expired card",
  "Card declined by your bank",
  "Network connection issues",
];

export function PaymentFailure({
  title = "Payment Failed",
  subtitle = "We couldn't process your payment.",
  message,
  reasons = DEFAULT_REASONS,
  isRetrying = false,
  retryButtonText = "Try Again",
  secondaryButtonText = "Home",
  tertiaryButtonText = "Support",
  onRetry,
  onSecondary,
  onTertiary,
  className,
}: Props) {
  return (
    <Card
      className={`w-full max-w-xl border-destructive/30 shadow-md ${className || ""}`}
    >
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-destructive/10 p-2">
            <CircleX className="h-6 w-6 text-destructive" aria-hidden />
          </div>
          <div>
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>{subtitle}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {message ? (
          <p className="text-sm text-muted-foreground">{message}</p>
        ) : null}

        {reasons?.length ? (
          <div>
            <h3 className="mb-2 text-sm font-medium text-foreground/80">
              Possible reasons
            </h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <Separator />

        <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            onClick={onTertiary}
            type="button"
            className="sm:ml-2"
          >
            {tertiaryButtonText}
          </Button>
          <Button
            variant="outline"
            onClick={onSecondary}
            type="button"
            className="sm:ml-2"
          >
            {secondaryButtonText}
          </Button>
          <Button
            onClick={onRetry}
            type="button"
            disabled={isRetrying || !onRetry}
            className="sm:ml-2"
          >
            {isRetrying ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Retrying…
              </span>
            ) : (
              retryButtonText
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}