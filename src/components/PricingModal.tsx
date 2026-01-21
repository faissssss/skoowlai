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
            if (!productId || productId.startsWith('pdt_') === false) {
                // Basic sanity check; real IDs begin with pdt_
                console.error('Invalid or missing productId:', productId);
                alert('Product is not configured. Please contact support.');
                return;
            }

            setLoadingPlan(productId);

            const url = new URL('/api/checkout', window.location.origin);
            url.searchParams.set('productId', productId);

            // Dodo Checkout handler returns JSON { checkout_url }
            const res = await fetch(url.toString(), { method: 'GET' });
            if (!res.ok) {
                const bodyText = await res.text().catch(() => 'Unknown error');
                console.error('Failed to start checkout:', bodyText);
                alert(`Failed to start checkout: ${bodyText || 'Please try again.'}`);
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
    // Prefer your Student plan IDs; fallback to generic vars for compatibility.
    // These must be Dodo product IDs like `pdt_...`
    const monthlyProductId =
        process.env.NEXT_PUBLIC_DODO_STUDENT_MONTHLY_PRODUCT_ID
        || process.env.NEXT_PUBLIC_DODO_MONTHLY_PRODUCT_ID
        || '';
    const yearlyProductId =
        process.env.NEXT_PUBLIC_DODO_STUDENT_YEARLY_PRODUCT_ID
        || process.env.NEXT_PUBLIC_DODO_YEARLY_PRODUCT_ID
        || '';

    const modalContent = (
        <div
            className="fixed inset-0 z-9999 overflow-y-auto"
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
                    className="relative w-full max-w-[95vw] sm:max-w-2xl bg-slate-900 rounded-xl shadow-2xl border border-slate-700/50 overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 transition-colors"
                    >
                        <X className="w-4 h-4 text-slate-400" />
                    </button>

                    <PricingTableFour
                        plans={plans}
                        title="Choose Your Plan"
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
                            const productId = interval === 'yearly' ? yearlyProductId : monthlyProductId;
                            if (!productId) {
                                alert('Product ID not configured. Please set NEXT_PUBLIC_DODO_STUDENT_MONTHLY_PRODUCT_ID and NEXT_PUBLIC_DODO_STUDENT_YEARLY_PRODUCT_ID in .env');
                                return;
                            }
                            startCheckout(productId);
                        }}
                    />

                    {/* Footer - Minimal */}
                    <div className="px-4 pb-3 text-center">
                        <p className="text-[10px] text-slate-500">
                            Cancel anytime · No hidden fees · Secure checkout
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(modalContent, document.body);
}
