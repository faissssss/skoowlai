'use client';

import { cn } from '@/lib/utils';

interface ChoiceChipProps {
    label: string;
    selected: boolean;
    onClick: () => void;
    icon?: React.ReactNode;
    disabled?: boolean;
}

export function ChoiceChip({ label, selected, onClick, icon, disabled }: ChoiceChipProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                "border-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-900",
                selected
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-md"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30",
                disabled && "opacity-50 cursor-not-allowed"
            )}
        >
            {icon && <span className="w-4 h-4">{icon}</span>}
            {label}
        </button>
    );
}

interface ChoiceChipGroupProps {
    label: string;
    options: { value: string; label: string; icon?: React.ReactNode }[];
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    centered?: boolean;
}

export function ChoiceChipGroup({ label, options, value, onChange, disabled, centered }: ChoiceChipGroupProps) {
    return (
        <div className="space-y-3">
            <label className={`block text-sm font-semibold text-slate-800 dark:text-slate-200 ${centered ? 'text-center' : ''}`}>{label}</label>
            <div className={`flex flex-wrap gap-2 ${centered ? 'justify-center' : ''}`}>
                {options.map((option) => (
                    <ChoiceChip
                        key={option.value}
                        label={option.label}
                        selected={value === option.value}
                        onClick={() => onChange(option.value)}
                        icon={option.icon}
                        disabled={disabled}
                    />
                ))}
            </div>
        </div>
    );
}

