"use client";

import * as React from "react";
import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SettingsButtonProps extends ButtonProps {
    beamColor?: string;
    wrapperClassName?: string;
}

export function SettingsButton({ className, wrapperClassName, beamColor, ...props }: SettingsButtonProps) {
    return (
        <div className={cn("group relative inline-flex transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97]", wrapperClassName)}>
            <Button
                {...props}
                className={cn(
                    "transition-all",
                    className
                )}
            />
        </div>
    );
}
