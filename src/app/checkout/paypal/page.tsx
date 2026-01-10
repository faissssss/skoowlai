'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { useUser } from '@clerk/nextjs';
import PayPalSubscriptionButton from '@/components/PayPalSubscriptionButton';
import { Loader2, CheckCircle, XCircle, ArrowLeft, Shield, Sparkles } from 'lucide-react';
import Link from 'next/link';

function PayPalCheckoutContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { user, isLoaded } = useUser();
    const [status, setStatus] = useState<'loading' | 'ready' | 'success' | 'error'>('loading');
    const [errorMessage, setErrorMessage] = useState('');

    const plan = searchParams.get('plan') as 'monthly' | 'yearly' | null;

    const planId = plan === 'yearly'
        ? process.env.NEXT_PUBLIC_PAYPAL_YEARLY_PLAN_ID
        : process.env.NEXT_PUBLIC_PAYPAL_MONTHLY_PLAN_ID;

    const planPrice = plan === 'yearly' ? '$39.99/year' : '$4.99/month';
    const planLabel = plan === 'yearly' ? 'Yearly' : 'Monthly';

    useEffect(() => {
        if (isLoaded) {
            if (!user) {
                router.push('/sign-in?redirect_url=/checkout/paypal?plan=' + plan);
            } else if (!plan || !planId) {
                setErrorMessage('Invalid plan selected');
                setStatus('error');
            } else {
                setStatus('ready');
            }
        }
    }, [isLoaded, user, plan, planId, router]);

    const handleSuccess = async (subscriptionId: string) => {
        try {
            const response = await fetch('/api/paypal/subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscriptionId,
                    plan,
                    email: user?.emailAddresses?.[0]?.emailAddress,
                }),
            });

            if (response.ok) {
                setStatus('success');
                setTimeout(() => {
                    router.push('/dashboard?payment=success');
                }, 2000);
            } else {
                throw new Error('Failed to save subscription');
            }
        } catch (error) {
            console.error('Error saving subscription:', error);
            setErrorMessage('Payment processed but failed to activate subscription. Please contact support with your PayPal receipt.');
            setStatus('error');
        }
    };

    const handleError = (error: Error) => {
        setErrorMessage(error.message || 'Payment failed');
        setStatus('error');
    };

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-4" />
                    <p className="text-slate-400">Loading checkout...</p>
                </div>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center max-w-md p-8">
                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-10 h-10 text-green-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Payment Successful!</h1>
                    <p className="text-slate-400 mb-6">
                        Your subscription is now active. Redirecting to dashboard...
                    </p>
                    <Loader2 className="w-5 h-5 animate-spin text-purple-500 mx-auto" />
                </div>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center max-w-md p-8">
                    <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <XCircle className="w-10 h-10 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Payment Failed</h1>
                    <p className="text-slate-400 mb-6">{errorMessage}</p>
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-lg">
                {/* Back Button */}
                <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Dashboard
                </Link>

                {/* Main Card */}
                <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-b border-slate-800 p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                                <Sparkles className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-white">Pro</h1>
                                <p className="text-sm text-slate-400">{planLabel} subscription</p>
                            </div>
                        </div>
                        <div className="mt-4">
                            <span className="text-3xl font-bold text-white">{planPrice}</span>
                            {plan === 'yearly' && (
                                <span className="ml-2 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-full">
                                    Save 33%
                                </span>
                            )}
                        </div>
                    </div>

                    {/* PayPal Button Section */}
                    <div className="p-6">
                        <p className="text-sm text-slate-400 mb-4 text-center">
                            Choose your payment method below
                        </p>

                        {planId && (
                            <div className="bg-white rounded-xl p-4">
                                <PayPalSubscriptionButton
                                    planId={planId}
                                    onSuccess={handleSuccess}
                                    onError={handleError}
                                    onCancel={() => router.push('/dashboard')}
                                />
                            </div>
                        )}

                        {/* Security Badge */}
                        <div className="flex items-center justify-center gap-2 mt-6 text-slate-500">
                            <Shield className="w-4 h-4" />
                            <span className="text-xs">Secured by PayPal</span>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-slate-800 p-4 bg-slate-950/50">
                        <p className="text-center text-[11px] text-slate-500">
                            By subscribing, you agree to our Terms of Service and Privacy Policy.
                            <br />Cancel anytime from your PayPal account.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function PayPalCheckoutPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        }>
            <PayPalCheckoutContent />
        </Suspense>
    );
}
