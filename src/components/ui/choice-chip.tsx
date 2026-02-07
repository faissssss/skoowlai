'use client';

import { cn } from '@/lib/utils';
import { Lock } from 'lucide-react';

interface ChoiceChipProps {
    label: string;
    selected: boolean;
    onClick: () => void;
    icon?: React.ReactNode;
    disabled?: boolean;
    locked?: boolean;
}

export function ChoiceChip({ label, selected, onClick, icon, disabled, locked }: ChoiceChipProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled && !locked}
            className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200",
                "border-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary",
                selected
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-transparent border-border text-muted-foreground hover:border-primary/30",
                disabled && !locked && "opacity-50 cursor-not-allowed",
                locked && "opacity-70 cursor-pointer border-dashed"
            )}
        >
            {icon && <span className="w-3.5 h-3.5">{icon}</span>}
            {label}
            {locked && <Lock className="w-2.5 h-2.5 ml-0.5" />}
        </button>
    );
}

interface ChoiceChipGroupProps {
    label: string;
    options: { value: string; label: string; icon?: React.ReactNode; disabled?: boolean; requiresUpgrade?: boolean }[];
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    centered?: boolean;
    onUpgradeRequired?: () => void;
}

export function ChoiceChipGroup({ label, options, value, onChange, disabled, centered, onUpgradeRequired }: ChoiceChipGroupProps) {
    const handleClick = (option: { value: string; disabled?: boolean; requiresUpgrade?: boolean }) => {
        if (option.requiresUpgrade && onUpgradeRequired) {
            onUpgradeRequired();
            return;
        }
        if (!option.disabled) {
            onChange(option.value);
        }
    };

    return (
        <div className="space-y-2">
            <label className={`block text-sm font-medium text-foreground ${centered ? 'text-center' : ''}`}>{label}</label>
            <div className={`flex flex-wrap gap-1.5 ${centered ? 'justify-center' : ''}`}>
                {options.map((option) => (
                    <ChoiceChip
                        key={option.value}
                        label={option.label}
                        selected={value === option.value}
                        onClick={() => handleClick(option)}
                        icon={option.icon}
                        disabled={disabled || option.disabled}
                        locked={option.requiresUpgrade}
                    />
                ))}
            </div>
        </div>
    );
}


