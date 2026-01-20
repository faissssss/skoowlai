'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { PricingTableFour } from '@/components/billingsdk/pricing-table-four';
import { plans } from '@/lib/billingsdk-config';

interface PricingModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Pricing Modal using Dodo Payments checkout
 *
 * This shows simple monthly/yearly plans and redirects to `/api/checkout`
 * which is handled by `@dodopayments/nextjs` on the server.
 */
export default function PricingModal({ isOpen, onClose }: PricingModalProps) {
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const startCheckout = async (productId: string) => {
        try {
            setLoadingPlan(productId);

            const url = new URL('/api/checkout', window.location.origin);
            url.searchParams.set('productId', productId);

            // Dodo Checkout handler returns JSON { checkout_url }
            const res = await fetch(url.toString(), { method: 'GET' });
            if (!res.ok) {
                console.error('Failed to start checkout:', await res.text());
                alert('Failed to start checkout. Please try again.');
                return;
            }

            const data = await res.json();
            if (data.checkout_url) {
                window.location.href = data.checkout_url;
            } else {
                alert('Checkout link not available. Please try again.');
            }
        } catch (error) {
            console.error('Error starting checkout:', error);
            alert('Something went wrong. Please try again.');
        } finally {
            setLoadingPlan(null);
        }
    };

    // Configure via env vars (client safe)
    // These should be Dodo product IDs like `pdt_...`
    const monthlyProductId =
        process.env.NEXT_PUBLIC_DODO_MONTHLY_PRODUCT_ID || 'pdt_monthly';
    const yearlyProductId =
        process.env.NEXT_PUBLIC_DODO_YEARLY_PRODUCT_ID || 'pdt_yearly';

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
                        <p className="text-slate-400 text-[10px] sm:text-xs">
                            Unlock your full learning potential
                        </p>
                    </div>

                    <PricingTableFour
                        plans={plans}
                        title="Choose Your Plan"
                        subtitle="Simple Pricing"
                        description="Unlock your full learning potential"
                        theme="minimal"
                        size="medium"
                        showBillingToggle={true}
                        billingToggleLabels={{
                            monthly: "Monthly",
                            yearly: "Yearly",
                        }}
                        loadingPlanId={loadingPlan}
                        onPlanSelect={(planId, interval) => {
                            if (planId === 'free') {
                                onClose();
                                return;
                            }
                            startCheckout(interval === 'yearly' ? yearlyProductId : monthlyProductId);
                        }}
                    />

                    {/* Footer */}
                    <div className="p-3 bg-slate-950/30 text-center border-t border-slate-800">
                        <p className="text-[10px] text-slate-500 flex items-center justify-center gap-2">
                            <span>Cancel anytime</span>
                            <span>·</span>
                            <span>No hidden fees</span>
                            <span>·</span>
                            <span>Secure checkout via Dodo Payments</span>
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(modalContent, document.body);
}
