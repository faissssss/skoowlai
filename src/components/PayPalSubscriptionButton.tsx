'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

interface PayPalSubscriptionButtonProps {
    planId: string;
    onSuccess: (subscriptionId: string) => void;
    onError?: (error: Error) => void;
    onCancel?: () => void;
    disabled?: boolean;
}

declare global {
    interface Window {
        paypal?: any;
    }
}

export default function PayPalSubscriptionButton({
    planId,
    onSuccess,
    onError,
    onCancel,
    disabled = false,
}: PayPalSubscriptionButtonProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const buttonsRendered = useRef(false);

    useEffect(() => {
        const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

        if (!clientId) {
            setError('PayPal Client ID not configured');
            setIsLoading(false);
            return;
        }

        if (!planId) {
            setError('Plan ID not provided');
            setIsLoading(false);
            return;
        }

        const renderButtons = () => {
            if (!window.paypal || !containerRef.current || buttonsRendered.current) {
                return;
            }

            try {
                buttonsRendered.current = true;

                window.paypal.Buttons({
                    style: {
                        shape: 'rect',
                        color: 'blue',
                        layout: 'vertical',
                        label: 'subscribe',
                    },
                    createSubscription: function (_data: any, actions: any) {
                        return actions.subscription.create({
                            plan_id: planId,
                        });
                    },
                    onApprove: function (data: any) {
                        console.log('PayPal subscription approved:', data.subscriptionID);
                        onSuccess(data.subscriptionID);
                    },
                    onCancel: function () {
                        console.log('PayPal subscription cancelled');
                        onCancel?.();
                    },
                    onError: function (err: any) {
                        console.error('PayPal error:', err);
                        setError('Payment failed. Please try again.');
                        onError?.(err);
                    },
                }).render(containerRef.current).then(() => {
                    setIsLoading(false);
                }).catch((err: any) => {
                    console.error('Error rendering PayPal buttons:', err);
                    setError('Failed to load payment buttons');
                    setIsLoading(false);
                });
            } catch (err) {
                console.error('Error initializing PayPal:', err);
                setError('Failed to initialize PayPal');
                setIsLoading(false);
            }
        };

        // Check if SDK is already loaded
        if (window.paypal) {
            renderButtons();
            return;
        }

        // Check if script is already being loaded
        const existingScript = document.querySelector('script[src*="paypal.com/sdk"]');
        if (existingScript) {
            existingScript.addEventListener('load', renderButtons);
            return;
        }

        // Load PayPal SDK script
        const script = document.createElement('script');
        script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&vault=true&intent=subscription`;
        script.async = true;
        script.setAttribute('data-sdk-integration-source', 'button-factory');

        script.onload = () => {
            // Small delay to ensure PayPal is fully initialized
            setTimeout(renderButtons, 100);
        };

        script.onerror = () => {
            setError('Failed to load PayPal SDK');
            setIsLoading(false);
        };

        document.body.appendChild(script);

        return () => {
            buttonsRendered.current = false;
        };
    }, [planId, onSuccess, onError, onCancel]);

    if (error) {
        return (
            <div className="flex items-center justify-center p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
                <span className="text-sm text-red-400">{error}</span>
            </div>
        );
    }

    return (
        <div className="relative">
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-800/80 rounded-lg z-10">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    <span className="ml-2 text-sm text-slate-400">Loading PayPal...</span>
                </div>
            )}
            <div
                ref={containerRef}
                className={`min-h-[150px] ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
            />
        </div>
    );
}
