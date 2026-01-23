"use client";

import * as React from "react";
import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SettingsButtonProps extends ButtonProps {
    beamColor?: string;
    wrapperClassName?: string;
}

export const SettingsButton = React.forwardRef<HTMLButtonElement, SettingsButtonProps>(
    ({ className, wrapperClassName, beamColor, ...props }, ref) => {
        return (
            <div className={cn("group relative inline-flex transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97]", wrapperClassName)}>
                <Button
                    ref={ref}
                    {...props}
                    className={cn(
                        "transition-all",
                        className
                    )}
                />
            </div>
        );
    }
);
SettingsButton.displayName = "SettingsButton";
