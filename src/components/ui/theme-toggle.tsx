"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeOptionProps {
    value: string;
    label: string;
    icon: React.ReactNode;
    selected: boolean;
    onClick: () => void;
}

function ThemeOption({ value, label, icon, selected, onClick }: ThemeOptionProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 min-w-[100px]",
                selected
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900"
            )}
        >
            <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                selected
                    ? "bg-indigo-100 dark:bg-indigo-800 text-indigo-600 dark:text-indigo-300"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
            )}>
                {icon}
            </div>
            <span className={cn(
                "text-sm font-medium",
                selected ? "text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-slate-300"
            )}>
                {label}
            </span>
        </button>
    );
}

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // Avoid hydration mismatch
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className="flex gap-3">
                <div className="w-[100px] h-[88px] rounded-xl border-2 border-slate-200 dark:border-slate-700 animate-pulse bg-slate-100 dark:bg-slate-800" />
                <div className="w-[100px] h-[88px] rounded-xl border-2 border-slate-200 dark:border-slate-700 animate-pulse bg-slate-100 dark:bg-slate-800" />
                <div className="w-[100px] h-[88px] rounded-xl border-2 border-slate-200 dark:border-slate-700 animate-pulse bg-slate-100 dark:bg-slate-800" />
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
