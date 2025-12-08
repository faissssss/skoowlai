'use client';

import { useState } from 'react';
import { X, Check, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PricingModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// Aligned feature comparison - same order for both plans
const comparisonFeatures = [
    { name: 'Study decks', free: '3/day', student: 'Unlimited' },
    { name: 'Smart notes', free: true, student: true },
    { name: 'Flashcard count', free: 'Default', student: 'Custom' },
    { name: 'Quiz attempts', free: '3/day', student: 'Unlimited' },
    { name: 'Quiz count', free: 'Default', student: 'Custom' },
    { name: 'Mind maps', free: '3/month', student: 'Unlimited' },
    { name: 'Audio recording', free: '5 min', student: 'Unlimited' },
    { name: 'YouTube videos', free: '3/month', student: 'Unlimited' },
    { name: 'AI chat', free: true, student: true },
    { name: 'Collaboration', free: true, student: true },
    { name: 'Priority support', free: false, student: true },
    { name: 'Early access', free: false, student: true },
];

// Helper to render feature value
const renderValue = (value: boolean | string, isPro: boolean = false) => {
    if (value === true) {
        return <Check className={cn("w-3.5 h-3.5", isPro ? "text-purple-500" : "text-green-500")} />;
    }
    if (value === false) {
        return <X className="w-3.5 h-3.5 text-slate-400" />;
    }
    return <span className={cn("text-[11px] font-medium", isPro ? "text-purple-400" : "text-slate-300")}>{value}</span>;
};

export default function PricingModal({ isOpen, onClose }: PricingModalProps) {
    const [selectedPlan, setSelectedPlan] = useState<'free' | 'student'>('free');

    if (!isOpen) return null;

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            onClick={handleBackdropClick}
        >
            {/* Backdrop with blur */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal Content - Ultra Compact */}
            <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 z-10 p-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                    <X className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                </button>

                {/* Title */}
                <div className="text-center pt-4 pb-3 px-4">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        Unlock Your Learning Potential
                    </h2>
                </div>

                {/* Ultra Compact Comparison Table */}
                <div className="px-3 pb-3">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                        {/* Table Header */}
                        <div className="grid grid-cols-3 bg-slate-50 dark:bg-slate-800/50">
                            <div className="py-1.5 px-2 border-r border-slate-200 dark:border-slate-700">
                                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Features</span>
                            </div>
                            <div
                                onClick={() => setSelectedPlan('free')}
                                className={cn(
                                    "py-1.5 px-2 text-center border-r border-slate-200 dark:border-slate-700 cursor-pointer transition-colors",
                                    selectedPlan === 'free' && "bg-indigo-50/50 dark:bg-indigo-900/20"
                                )}
                            >
                                <h3 className="text-xs font-bold text-slate-900 dark:text-white">Free</h3>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">$0</p>
                            </div>
                            <div
                                onClick={() => setSelectedPlan('student')}
                                className={cn(
                                    "py-1.5 px-2 text-center cursor-pointer transition-colors relative",
                                    selectedPlan === 'student' && "bg-purple-50/50 dark:bg-purple-900/20"
                                )}
                            >
                                <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-[8px] font-medium rounded flex items-center gap-0.5">
                                    <Zap className="w-2 h-2" />
                                    Popular
                                </div>
                                <h3 className="text-xs font-bold text-slate-900 dark:text-white">Student</h3>
                                <p className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-indigo-500">$4.99<span className="text-[10px] text-slate-400">/mo</span></p>
                            </div>
                        </div>

                        {/* Table Body - Ultra compact rows */}
                        {comparisonFeatures.map((feature, index) => (
                            <div
                                key={index}
                                className={cn(
                                    "grid grid-cols-3 border-t border-slate-200 dark:border-slate-700",
                                    index % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-800/30"
                                )}
                            >
                                <div className="py-1.5 px-2 border-r border-slate-200 dark:border-slate-700 flex items-center">
                                    <span className="text-[11px] text-slate-700 dark:text-slate-300">{feature.name}</span>
                                </div>
                                <div className="py-1.5 px-2 border-r border-slate-200 dark:border-slate-700 flex items-center justify-center">
                                    {renderValue(feature.free)}
                                </div>
                                <div className="py-1.5 px-2 flex items-center justify-center">
                                    {renderValue(feature.student, true)}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Compact CTA Buttons */}
                    <div className="grid grid-cols-2 gap-2 mt-3">
                        <button
                            onClick={onClose}
                            className="py-2 px-3 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            Stay Free
                        </button>
                        <button
                            className="py-2 px-3 rounded-lg text-xs font-medium bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 shadow-lg shadow-purple-500/25 transition-all"
                        >
                            Upgrade to Student
                        </button>
                    </div>
                </div>

                {/* Minimal Footer */}
                <div className="text-center pb-3">
                    <p className="text-[9px] text-slate-400 dark:text-slate-500">
                        Cancel anytime • No hidden fees 💜
                    </p>
                </div>
            </div>
        </div>
    );
}
