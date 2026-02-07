'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useUser, useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
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
    const { user } = useUser();
    const { isSignedIn } = useAuth();
    const router = useRouter();

    // Subscription state for UI logic
    const [subscriptionData, setSubscriptionData] = useState<{
        isActive: boolean;
        plan: 'monthly' | 'yearly' | null;
        trialEligible: boolean;
    }>({ isActive: false, plan: null, trialEligible: true });

    // Fetch subscription data when modal opens
    useEffect(() => {
        if (isOpen) {
            // Ensure DB is in sync with provider before reading
            fetch('/api/subscription/sync', { method: 'POST' }).catch(() => { /* non-blocking */ });

            fetch('/api/subscription')
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                    if (data) {
                        // Trial eligible if user hasn't used trial AND is not currently active
                        const isTrialEligible = !data.trialUsedAt && data.status !== 'active' && data.status !== 'trialing';
                        setSubscriptionData({
                            isActive: data.isActive,
                            plan: data.plan,
                            trialEligible: isTrialEligible,
                        });
                    }
                })
                .catch(console.error);
        }
    }, [isOpen]);

    // Configure via env vars (client safe)
    // These must be Dodo product IDs like `pdt_...`
    const monthlyProductId = process.env.NEXT_PUBLIC_DODO_MONTHLY_PRODUCT_ID || '';
    const yearlyProductId = process.env.NEXT_PUBLIC_DODO_YEARLY_PRODUCT_ID || '';
    
    // Debug: log if product IDs are missing
    useEffect(() => {
        if (!monthlyProductId || !yearlyProductId) {
            console.error('Missing Dodo product IDs:', { monthlyProductId, yearlyProductId });
        }
    }, [monthlyProductId, yearlyProductId]);

    if (!isOpen) return null;

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const startCheckout = async (productId: string, planParam?: 'monthly' | 'yearly') => {
        try {
            // Validate productId is configured
            if (!monthlyProductId || !yearlyProductId) {
                console.error('Product IDs not configured:', { monthlyProductId, yearlyProductId });
                alert('Checkout is not properly configured. Please contact support.');
                return;
            }

            // Use the correct product ID based on interval
            const actualProductId = planParam === 'yearly' ? yearlyProductId : monthlyProductId;
            
            if (!actualProductId || !actualProductId.startsWith('pdt_')) {
                console.error('Invalid product ID:', actualProductId);
                alert('Invalid product configuration. Please contact support.');
                return;
            }

            // Redirect unauthenticated users to sign-up first
            if (!isSignedIn) {
                sessionStorage.setItem('pending-checkout', JSON.stringify({
                    productId: actualProductId,
                    plan: planParam,
                }));
                router.push('/sign-up?redirect_url=/dashboard?billing=1');
                onClose();
                return;
            }

            setLoadingPlan(productId);

            const url = new URL('/api/checkout', window.location.origin);
            url.searchParams.set('productId', actualProductId);

            // Attach identity hints so Dodo links back to this user
            // 1) Prefer existing customer_id to avoid duplications
            try {
                const subRes = await fetch('/api/subscription');
                if (subRes.ok) {
                    const s = await subRes.json();
                    if (s?.customerId) {
                        url.searchParams.set('customer_id', String(s.customerId));
                    }
                }
            } catch (e) {
                console.warn('Unable to prefetch subscription for customer_id', e);
            }
            // 2) Provide email and clerkId as metadata for webhook matching
            const email = user?.primaryEmailAddress?.emailAddress;
            if (email) url.searchParams.set('email', email);
            const clerkId = user?.id;
            if (clerkId) url.searchParams.set('metadata_clerkId', clerkId);

            // Dodo Checkout handler returns JSON { checkout_url }
            const res = await fetch(url.toString(), { method: 'GET' });
            
            // Check for non-OK response
            if (!res.ok) {
                const errorText = await res.text().catch(() => 'Unknown error');
                console.error('Checkout API error:', res.status, errorText);
                
                // If it's a 500 error, the API key or product ID might be misconfigured
                if (res.status === 500) {
                    alert('Checkout service is temporarily unavailable. Please try again later or contact support.');
                    setLoadingPlan(null);
                    return;
                }
                
                const failure = new URL('/checkout/failure', window.location.origin);
                failure.searchParams.set('productId', actualProductId);
                if (planParam) failure.searchParams.set('plan', planParam);
                failure.searchParams.set('m', (errorText || 'Request failed').slice(0, 200));
                failure.searchParams.set('block', '1');
                window.location.href = failure.toString();
                return;
            }

            const data = await res.json();
            
            if (data.checkout_url && typeof data.checkout_url === 'string') {
                window.location.href = data.checkout_url;
            } else if (data.url && typeof data.url === 'string') {
                // Fallback for different response format
                window.location.href = data.url;
            } else {
                console.error('No checkout URL in response:', data);
                const failure = new URL('/checkout/failure', window.location.origin);
                failure.searchParams.set('productId', actualProductId);
                if (planParam) failure.searchParams.set('plan', planParam);
                failure.searchParams.set('m', 'Checkout link not available');
                failure.searchParams.set('block', '1');
                window.location.href = failure.toString();
                return;
            }
        } catch (error) {
            console.error('Error starting checkout:', error);
            const failure = new URL('/checkout/failure', window.location.origin);
            failure.searchParams.set('productId', productId);
            if (planParam) failure.searchParams.set('plan', planParam);
            failure.searchParams.set('m', 'Failed to start checkout');
            failure.searchParams.set('block', '1');
            window.location.href = failure.toString();
            return;
        } finally {
            setLoadingPlan(null);
        }
    };

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
                    className="relative w-full max-w-[95vw] sm:max-w-2xl bg-card rounded-xl shadow-2xl border border-border overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-secondary/80 hover:bg-secondary transition-colors"
                    >
                        <X className="w-4 h-4 text-muted-foreground" />
                    </button>

                    <PricingTableFour
                        plans={plans}
                        title="Upgrade Plan"
                        subtitle="Manage your billing and subscription"
                        theme="minimal"
                        size="medium"
                        showBillingToggle={true}
                        billingToggleLabels={{
                            monthly: "Monthly",
                            yearly: "Yearly",
                        }}
                        loadingPlanId={loadingPlan}
                        showTrialBadge={subscriptionData.trialEligible}
                        currentPlanInterval={subscriptionData.isActive ? subscriptionData.plan : null}
                        onPlanSelect={(planId, interval) => {
                            if (planId === 'free') {
                                onClose();
                                return;
                            }
                            const selectedProductId = interval === 'yearly' ? yearlyProductId : monthlyProductId;
                            if (!selectedProductId) {
                                alert('Checkout is not configured. Please contact support.');
                                console.error('Missing product ID for interval:', interval);
                                return;
                            }
                            if (!selectedProductId.startsWith('pdt_')) {
                                alert('Invalid product configuration. Please contact support.');
                                console.error('Invalid product ID format:', selectedProductId);
                                return;
                            }
                            startCheckout(selectedProductId, interval);
                        }}
                    />

                    {/* Footer - Minimal */}
                    <div className="px-4 pb-3 text-center">
                        <p className="text-[10px] text-muted-foreground">
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
