"use client";

import { cn } from "@/lib/utils";

interface AnimatedGradientTextProps {
    children: React.ReactNode;
    className?: string;
    colorFrom?: string;
    colorTo?: string;
}

export function AnimatedGradientText({
    children,
    className,
    colorFrom = "#a855f7",
    colorTo = "#ec4899",
}: AnimatedGradientTextProps) {
    return (
        <span
            className={cn("inline-block pb-1", className)}
            style={{
                background: `linear-gradient(90deg, ${colorFrom}, ${colorTo})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
            }}
        >
            {children}
        </span>
    );
}
