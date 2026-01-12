'use client';

import { useState } from 'react';
import { X, Check, Ghost, GraduationCap, Sparkles, Zap, Loader2, CreditCard, Smartphone, Wallet } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@clerk/nextjs';
import Image from 'next/image';

interface PricingModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// Free plan features
const freeFeatures = [
    { text: '3 study decks/day', included: true },
    { text: '5 flashcards/day', included: true },
    { text: '5 quizzes/day', included: true },
    { text: '5 mind maps/day', included: true },
    { text: '20 AI chat messages/day', included: true },
    { text: 'Smart notes generation', included: true },
    { text: 'Shared decks & collaboration', included: true },
    { text: 'Custom counts & unlimited', included: false },
];

// Pro plan features
const proFeatures = [
    { text: 'Unlimited study decks', included: true, highlight: true },
    { text: 'Unlimited flashcards', included: true, highlight: true },
    { text: 'Unlimited quizzes', included: true, highlight: true },
    { text: 'Unlimited mind maps', included: true, highlight: true },
    { text: 'Custom flashcard & quiz count', included: true, highlight: true },
    { text: '100 AI chat messages/day', included: true },
    { text: 'Smart notes generation', included: true },
    { text: 'Shared decks & collaboration', included: true },
];

// Pricing configuration
const pricing = {
    monthly: { price: 4.99, period: 'month' },
    yearly: { price: 39.99, period: 'year', monthlyEquivalent: 3.33 },
};

export default function PricingModal({ isOpen, onClose }: PricingModalProps) {
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
    const [isLoading, setIsLoading] = useState(false);
    const [view, setView] = useState<'plan' | 'payment-method'>('plan');
    const { user } = useUser();

    if (!isOpen) return null;

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const handleProceedToPayment = () => {
        // Check if user is signed in first
        if (!user) {
            window.location.href = '/sign-in?redirect_url=' + encodeURIComponent(window.location.pathname);
            return;
        }
        setView('payment-method');
    };

    const handleCheckout = (method: 'card' | 'paypal' | 'qris') => {
        setIsLoading(true);

        // PayPal uses its own checkout flow
        if (method === 'paypal') {
            window.location.href = `/checkout/paypal?plan=${billingPeriod}`;
            return;
        }

        // Card and QRIS use Dodo Payments
        let paymentLink = billingPeriod === 'yearly'
            ? process.env.NEXT_PUBLIC_DODO_YEARLY_PAYMENT_LINK
            : process.env.NEXT_PUBLIC_DODO_MONTHLY_PAYMENT_LINK;

        const productId = billingPeriod === 'yearly'
            ? process.env.NEXT_PUBLIC_DODO_STUDENT_YEARLY_PRODUCT_ID
            : process.env.NEXT_PUBLIC_DODO_STUDENT_MONTHLY_PRODUCT_ID;

        let checkoutUrl: string;

        if (paymentLink) {
            checkoutUrl = paymentLink;
        } else if (productId) {
            // Hardcoded to live mode for now
            checkoutUrl = `https://checkout.dodopayments.com/buy/${productId}`;
        } else {
            console.error('No payment config found');
            setIsLoading(false);
            // Consider showing a toast/alert to inform the user
            // e.g., toast.error('Payment is temporarily unavailable. Please try again later.');
            return;
        }
        try {
            const url = new URL(checkoutUrl);
            if (user?.emailAddresses?.[0]?.emailAddress) {
                url.searchParams.set('customer_email', user.emailAddresses[0].emailAddress);
            }
            window.location.href = url.toString();
        } catch {
            window.location.href = checkoutUrl;
        }
    };

    const currentPrice = billingPeriod === 'yearly'
        ? pricing.yearly.monthlyEquivalent
        : pricing.monthly.price;

    // Use Portal to ensure modal is always top-level and escapes any parent transforms/overflows
    if (!isOpen) return null;

    const modalContent = (
        <div
            className="fixed inset-0 z-[9999] overflow-y-auto"
            data-scroll-lock-scrollable
        >
            {/* Backdrop with blur - Fixed position so it stays while scrolling */}
            <div className="fixed inset-0 bg-black/70 backdrop-blur-md" aria-hidden="true" />

            {/* Scrollable Container Wrapper */}
            <div
                className="flex min-h-full items-center justify-center p-4 touch-pan-y pointer-events-auto"
                onClick={handleBackdropClick}
            >
                {/* Modal Content - Let it grow naturally, no max-height */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="relative w-full max-w-[95vw] sm:max-w-2xl bg-slate-900 rounded-xl shadow-2xl border border-slate-700/50 overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {view === 'plan' ? (
                        <>
                            {/* Close Button */}
                            <button
                                onClick={onClose}
                                className="absolute top-2.5 right-2.5 z-10 p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 transition-colors"
                            >
                                <X className="w-4 h-4 text-slate-400" />
                            </button>

                            {/* Header */}
                            <div className="text-center pt-3 sm:pt-4 pb-2 sm:pb-3 px-3 sm:px-4">
                                <h2 className="text-base sm:text-lg font-bold text-white mb-0.5">
                                    Choose Your Plan
                                </h2>
                                <p className="text-slate-400 text-[10px] sm:text-xs">
                                    Unlock your full learning potential
                                </p>

                                {/* Billing Toggle */}
                                <div className="flex justify-center mt-3">
                                    <div className="relative flex bg-slate-800 rounded-full p-0.5">
                                        <motion.div
                                            className="absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] bg-purple-600 rounded-full"
                                            animate={{
                                                x: billingPeriod === 'monthly' ? 2 : 'calc(100% + 2px)',
                                            }}
                                            transition={{ type: 'tween', duration: 0.2, ease: 'easeInOut' }}
                                        />
                                        <button
                                            onClick={() => setBillingPeriod('monthly')}
                                            className={cn(
                                                "relative z-10 px-3 py-1 text-xs font-medium transition-colors w-24 text-center rounded-full",
                                                billingPeriod === 'monthly' ? "text-white" : "text-slate-400 hover:text-white"
                                            )}
                                        >
                                            Monthly
                                        </button>
                                        <button
                                            onClick={() => setBillingPeriod('yearly')}
                                            className={cn(
                                                "relative z-10 px-3 py-1 text-xs font-medium transition-colors w-24 text-center rounded-full",
                                                billingPeriod === 'yearly' ? "text-white" : "text-slate-400 hover:text-white"
                                            )}
                                        >
                                            Yearly
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Plans Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4">
                                {/* Free Plan */}
                                <motion.div
                                    className="relative p-4 rounded-lg bg-slate-800/50 border border-slate-700/50 flex flex-col cursor-pointer"
                                    whileHover={{
                                        scale: 1.02,
                                        borderColor: 'rgba(148, 163, 184, 0.5)',
                                        boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.3)'
                                    }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-1 rounded-md bg-slate-700/50">
                                            <Ghost className="w-4 h-4 text-slate-400" />
                                        </div>
                                        <h3 className="text-base font-bold text-white">Free</h3>
                                    </div>
                                    <div className="mb-3 h-[52px] flex flex-col justify-center">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-3xl font-bold text-white">$0</span>
                                            <span className="text-slate-400 text-xs">/month</span>
                                        </div>
                                        <p className="text-[10px] text-transparent mt-0.5 h-4">placeholder</p>
                                    </div>

                                    <button
                                        className="w-full py-2 px-3 rounded-lg bg-slate-700 text-slate-300 font-medium hover:bg-slate-600 transition-all mb-3 text-xs h-9"
                                    >
                                        Current Plan
                                    </button>

                                    <ul className="space-y-1.5 flex-1">
                                        {freeFeatures.map((feature, index) => (
                                            <li key={index} className="flex items-start gap-2">
                                                {feature.included ? (
                                                    <Check className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                                                ) : (
                                                    <X className="w-3.5 h-3.5 text-slate-600 flex-shrink-0 mt-0.5" />
                                                )}
                                                <span className={cn("text-xs", feature.included ? "text-slate-300" : "text-slate-500")}>
                                                    {feature.text}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </motion.div>

                                {/* Pro Plan */}
                                <motion.div
                                    className="relative p-4 rounded-lg bg-slate-800/80 border-2 border-purple-500/50 shadow-lg shadow-purple-500/10 flex flex-col cursor-pointer"
                                    whileHover={{
                                        scale: 1.02,
                                        borderColor: 'rgba(168, 85, 247, 0.8)',
                                        boxShadow: '0 20px 50px -10px rgba(168, 85, 247, 0.25)'
                                    }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                    onClick={handleProceedToPayment}
                                >
                                    <div className="absolute -top-2 right-3">
                                        <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-600 text-white text-[10px] font-bold rounded-full shadow-lg">
                                            <Sparkles className="w-2.5 h-2.5" />
                                            Most Popular
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-1 rounded-md bg-purple-600/20 border border-purple-500/30">
                                            <GraduationCap className="w-4 h-4 text-purple-400" />
                                        </div>
                                        <h3 className="text-base font-bold text-white">Pro</h3>
                                    </div>

                                    <div className="mb-3 h-[52px] flex flex-col justify-center">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-3xl font-bold text-white">$0</span>
                                            <span className="text-slate-400 text-xs">today</span>
                                            {billingPeriod === 'yearly' && (
                                                <span className="px-2 py-0.5 bg-gradient-to-r from-emerald-500 to-green-500 text-white text-[10px] font-bold rounded-full">
                                                    🎉 33% OFF
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-0.5 h-4">
                                            Then ${currentPrice.toFixed(2)}/mo
                                            {billingPeriod === 'yearly' && ` ($${pricing.yearly.price}/year)`}
                                        </p>
                                    </div>

                                    <button
                                        onClick={handleProceedToPayment}
                                        className="w-full py-2 px-3 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 transition-all shadow-lg shadow-purple-600/25 mb-3 text-xs h-9 flex items-center justify-center gap-2"
                                    >
                                        Try Pro Free • 7-Day Trial
                                    </button>

                                    <ul className="space-y-1.5 flex-1">
                                        {proFeatures.map((feature, index) => (
                                            <li key={index} className="flex items-start gap-2">
                                                {feature.highlight ? (
                                                    <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                                                ) : (
                                                    <Check className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
                                                )}
                                                <span className={cn(
                                                    "text-xs",
                                                    feature.highlight ? "text-white font-medium" : "text-slate-300"
                                                )}>
                                                    {feature.text}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </motion.div>
                            </div>

                            {/* Footer */}
                            <div className="p-3 bg-slate-950/30 text-center border-t border-slate-800">
                                <p className="text-[10px] text-slate-500 flex items-center justify-center gap-2">
                                    <span>Cancel anytime</span>
                                    <span>·</span>
                                    <span>No hidden fees</span>
                                    <span>·</span>
                                    <span className="flex items-center gap-1">
                                        Secure payment 💜
                                    </span>
                                </p>
                            </div>
                        </>
                    ) : (
                        /* Payment Method Selection View */
                        <div className="p-4 sm:p-6">
                            <button
                                onClick={() => setView('plan')}
                                className="absolute top-3 sm:top-4 left-3 sm:left-4 text-slate-400 hover:text-white flex items-center gap-1 text-xs transition-colors"
                            >
                                ← Back
                            </button>

                            <div className="text-center mb-4 sm:mb-6 mt-2">
                                <h2 className="text-base sm:text-lg font-bold text-white">Select Payment Method</h2>
                                <p className="text-slate-400 text-[10px] sm:text-xs mt-1">
                                    Trusted by students worldwide
                                </p>
                            </div>

                            <div className="space-y-2 sm:space-y-3 max-w-sm mx-auto">
                                {/* Credit Card Button */}
                                <button
                                    onClick={() => handleCheckout('card')}
                                    disabled={isLoading}
                                    className="w-full p-4 rounded-xl bg-slate-800 border border-slate-700 hover:border-purple-500 hover:bg-slate-750 transition-all group relative overflow-hidden"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-8 rounded bg-white/10 flex items-center justify-center">
                                            <CreditCard className="w-6 h-6 text-purple-400" />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <div className="text-sm font-semibold text-white">Pay with Card</div>
                                            <div className="text-xs text-slate-400">Visa, Mastercard, Amex</div>
                                        </div>
                                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-purple-500" /> : <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" />}
                                    </div>
                                </button>

                                {/* PayPal Button */}
                                <button
                                    onClick={() => handleCheckout('paypal')}
                                    disabled={isLoading}
                                    className="w-full p-4 rounded-xl bg-slate-800 border border-slate-700 hover:border-[#0070ba] hover:bg-slate-750 transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-8 rounded bg-white/10 flex items-center justify-center">
                                            {/* PayPal Logo */}
                                            <Image src="/paypal-logo.png" alt="PayPal" width={24} height={24} className="h-6 w-6 object-contain" />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <div className="text-sm font-semibold text-white">Pay with PayPal</div>
                                            <div className="text-xs text-slate-400">Fast & secure checkout</div>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(modalContent, document.body);
}
