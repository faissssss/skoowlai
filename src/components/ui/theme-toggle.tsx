"use client";

import { useTheme } from "next-themes";
import { useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeOptionProps {
    value: string;
    label: string;
    icon: React.ReactNode;
    selected: boolean;
    onClick: () => void;
}

function ThemeOption({ label, icon, selected, onClick }: ThemeOptionProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 min-w-[100px]",
                selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-border/80 bg-background"
            )}
        >
            <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                selected
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
            )}>
                {icon}
            </div>
            <span className={cn(
                "text-sm font-medium",
                selected ? "text-primary" : "text-foreground"
            )}>
                {label}
            </span>
        </button>
    );
}

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted] = useState(() => typeof window !== 'undefined');

    if (!mounted) {
        return (
            <div className="flex gap-3">
                <div className="w-[100px] h-[88px] rounded-xl border-2 border-border animate-pulse bg-muted" />
                <div className="w-[100px] h-[88px] rounded-xl border-2 border-border animate-pulse bg-muted" />
                <div className="w-[100px] h-[88px] rounded-xl border-2 border-border animate-pulse bg-muted" />
            </div>
        );
    }

    return (
        <div className="flex gap-3 flex-wrap">
            <ThemeOption
                value="light"
                label="Light"
                icon={<Sun className="w-5 h-5" />}
                selected={theme === "light"}
                onClick={() => setTheme("light")}
            />
            <ThemeOption
                value="dark"
                label="Dark"
                icon={<Moon className="w-5 h-5" />}
                selected={theme === "dark"}
                onClick={() => setTheme("dark")}
            />
            <ThemeOption
                value="system"
                label="System"
                icon={<Monitor className="w-5 h-5" />}
                selected={theme === "system"}
                onClick={() => setTheme("system")}
            />
        </div>
    );
}
