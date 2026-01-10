'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Crown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import PricingModal from './PricingModal';

interface UsageLimitModalProps {
    isOpen: boolean;
    onClose: () => void;
    feature: string;
    limit: number;
    used: number;
}

export default function UsageLimitModal({ isOpen, onClose, feature, limit, used }: UsageLimitModalProps) {
    const [showPricing, setShowPricing] = useState(false);

    const handleUpgrade = () => {
        onClose();
        setShowPricing(true);
    };

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
                            onClick={onClose}
                        />

                        {/* Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="fixed inset-0 z-[200] flex items-center justify-center p-4 pointer-events-none"
                        >
                            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto">
                                {/* Header */}
                                <div className="p-6 text-center">
                                    <div className="mx-auto w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4">
                                        <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                                        Daily Limit Reached
                                    </h2>
                                    <p className="text-slate-600 dark:text-slate-400">
                                        You've used all <span className="font-semibold text-amber-600">{limit}</span> of your daily {feature} generations.
                                    </p>
                                </div>

                                {/* Progress bar */}
                                <div className="px-6 pb-4">
                                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-amber-500 rounded-full" style={{ width: '100%' }} />
                                    </div>
                                    <p className="text-center text-sm text-slate-500 mt-2">{used}/{limit} used today</p>
                                </div>

                                {/* Actions */}
                                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 space-y-3">
                                    <Button
                                        onClick={handleUpgrade}
                                        className="w-full h-12 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-medium rounded-xl"
                                    >
                                        <Crown className="w-5 h-5 mr-2" />
                                        Upgrade to Pro
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={onClose}
                                        className="w-full text-slate-500"
                                    >
                                        Maybe Later
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
            <PricingModal isOpen={showPricing} onClose={() => setShowPricing(false)} />
        </>
    );
}
