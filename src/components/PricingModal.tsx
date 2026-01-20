'use client';

import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { PricingTable } from '@clerk/nextjs';

interface PricingModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Pricing Modal using Clerk Billing
 */
export default function PricingModal({ isOpen, onClose }: PricingModalProps) {
    if (!isOpen) return null;

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const modalContent = (
        <div
            className="fixed inset-0 z-[9999] overflow-y-auto"
            data-scroll-lock-scrollable
        >
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/70 backdrop-blur-md" aria-hidden="true" />

            {/* Container */}
            <div
                className="flex min-h-full items-center justify-center p-4"
                onClick={handleBackdropClick}
            >
                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="relative w-full max-w-[95vw] sm:max-w-3xl bg-slate-900 rounded-xl shadow-2xl border border-slate-700/50 overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-2.5 right-2.5 z-10 p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 transition-colors"
                    >
                        <X className="w-4 h-4 text-slate-400" />
                    </button>

                    {/* Header */}
                    <div className="text-center pt-4 pb-2 px-4">
                        <h2 className="text-base sm:text-lg font-bold text-white mb-0.5">
                            Choose Your Plan
                        </h2>
                        <p className="text-slate-400 text-[10px] sm:text-xs">
                            Unlock your full learning potential
                        </p>
                    </div>

                    {/* Clerk Pricing Table */}
                    <div className="p-4 pt-2">
                        <PricingTable />
                    </div>

                    {/* Footer */}
                    <div className="p-3 bg-slate-950/30 text-center border-t border-slate-800">
                        <p className="text-[10px] text-slate-500 flex items-center justify-center gap-2">
                            <span>Cancel anytime</span>
                            <span>·</span>
                            <span>No hidden fees</span>
                            <span>·</span>
                            <span>Secure payment 💜</span>
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(modalContent, document.body);
}
