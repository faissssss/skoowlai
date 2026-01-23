"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { CreditCard, Bug, Lightbulb, MessageSquare, Check, Crown, Loader2, User, LogOut } from 'lucide-react';
import { useUser, useClerk } from '@clerk/nextjs';
import BugReportModal from '@/components/BugReportModal';
import FeedbackModal from '@/components/FeedbackModal';
import PricingModal from '@/components/PricingModal';
import { motion, LayoutGroup } from 'framer-motion';

import { SubscriptionManagement } from '@/components/billingsdk/subscription-management';
import { SettingsButton } from '@/components/ui/settings-button';
import { plans, type CurrentPlan as CurrentPlanType, type Plan } from '@/lib/billingsdk-config';

function SubscriptionCard() {
    type SubscriptionDTO = {
        status: string;
        plan: string | null;
        subscriptionEndsAt?: string | null;
        customerId?: string | null;
        subscriptionId?: string | null;
        isActive?: boolean;
    };
    const [subscription, setSubscription] = useState<SubscriptionDTO | null>(null);
    const [loading, setLoading] = useState(true);
    const [showPricing, setShowPricing] = useState(false);
    const [error, setError] = useState(false);
    const [openingPortal, setOpeningPortal] = useState(false);

    const fetchSubscription = async () => {
        try {
            setLoading(true);
            // First, sync subscription to ensure DB matches provider
            await fetch('/api/subscription/sync', {
                method: 'POST',
                cache: 'no-store',
                credentials: 'include',
                headers: {
                    'pragma': 'no-cache',
                    'cache-control': 'no-cache',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            // Then fetch the updated subscription data (cache-busted)
            const res = await fetch(`/api/subscription?t=${Date.now()}`, {
                cache: 'no-store',
                credentials: 'include',
                headers: {
                    'pragma': 'no-cache',
                    'cache-control': 'no-cache',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            if (res.ok) {
                const data = await res.json();
                setSubscription(data);
            } else {
                setError(true);
            }
        } catch (error) {
            console.error('Failed to fetch subscription:', error);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSubscription();
    }, []);

    if (error) {
        return (
            <Card className="border-red-200 dark:border-red-900/50">
                <CardContent className="py-8 text-center text-red-600 dark:text-red-400">
                    <p>Failed to load subscription details.</p>
                    <Button
                        variant="link"
                        className="text-red-600 dark:text-red-400 underline"
                        onClick={() => window.location.reload()}
                    >
                        Retry
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (loading) {
        return (
            <Card>
                <CardContent className="py-8 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </CardContent>
            </Card>
        );
    }

    // Derive status from server + local fallback
    const nowMs = Date.now();
    const endsAtMs = subscription?.subscriptionEndsAt ? new Date(subscription.subscriptionEndsAt).getTime() : null;

    const isCancelled = subscription?.status === 'cancelled';
    const isTrial = subscription?.status === 'trialing';
    // Prefer server-computed isActive when available; otherwise recompute with paid-period grace
    const isActive =
        (typeof subscription?.isActive === 'boolean')
            ? subscription.isActive
            : (subscription?.status === 'active' || isTrial || (isCancelled && endsAtMs !== null && endsAtMs > nowMs));

    // Immediate end (trial cancelled now or cancelled with no remaining access)
    const isImmediateEnd = isCancelled && (endsAtMs === null || endsAtMs <= nowMs + 1000);

    // Display status badge rules:
    // - Show 'cancelled' badge whenever status is cancelled (even if access remains until period end)
    // - Else show 'trialing' during trial, 'active' when active, or 'free'
    const displayStatus: 'trialing' | 'active' | 'cancelled' | 'free' =
        isCancelled ? 'cancelled' : (isTrial ? 'trialing' : (isActive ? 'active' : 'free'));

    console.log('[Settings] Subscription data:', {
        apiStatus: subscription?.status,
        isCancelled,
        isTrial,
        isActive,
        displayStatus,
        subscriptionEndsAt: subscription?.subscriptionEndsAt
    });

    // Determine the plan card to display:
    // - Show Free when not active AND (not cancelled OR cancelled with immediate end)
    // - Keep Pro card when paid cancellation scheduled at period end (still active until end)
    const showProCard = isActive || (isCancelled && endsAtMs !== null && endsAtMs > nowMs);
    const currentPlanData: Plan = showProCard ? plans[1] : plans[0];

    // UI helper for trigger text
    const isFreeUI = !showProCard;

    const endDate = subscription?.subscriptionEndsAt ? new Date(subscription.subscriptionEndsAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : 'N/A';

    // Build CurrentPlan object for SubscriptionManagement
    const currentInterval = (subscription?.plan as 'monthly' | 'yearly') || 'monthly';
    const currentPlan: CurrentPlanType = {
        plan: currentPlanData,
        type: currentInterval,
        price: subscription?.plan === 'yearly' ? '$39.99/year' : '$4.99/month',
        nextBillingDate: endDate,
        paymentMethod: (isTrial || (isCancelled && isTrial)) ? 'None' : 'Credit Card', // Show None for trials (even converted to cancel)
        status: displayStatus,
    };


    // For Pro/Trial/Cancelled users, show the full SubscriptionManagement UI
    return (
        <>
            <SubscriptionManagement
                className="w-full"
                currentPlan={currentPlan}
                updatePlan={{
                    currentPlan: currentPlanData,
                    plans: plans,
                    triggerText: isCancelled ? "Resubscribe (no trial)" : (isFreeUI ? "Upgrade to Pro" : "Update Plan"),
                    onPlanChange: async () => {
                        try {
                            // Prefer direct session checkout for cancelled users to avoid connector/currency issues
                            if (isCancelled) {
                                const yearlyNoTrial = process.env.NEXT_PUBLIC_DODO_YEARLY_NO_TRIAL_PRODUCT_ID || "";
                                const target = yearlyNoTrial
                                  ? `/api/checkout/session?productId=${encodeURIComponent(yearlyNoTrial)}`
                                  : `/api/checkout/session`;
                                window.location.href = target;
                                return;
                            }
                        } catch (e) {
                            console.error("[Settings] Direct session redirect failed, falling back to Pricing modal", e);
                        }
                        setShowPricing(true);
                    },
                    currentInterval: currentInterval,
                }}
                cancelSubscription={{
                    title: "Cancel Subscription",
                    description: "We're sorry to see you go. Your access will continue until the end of your billing period.",
                    plan: currentPlanData,
                    warningTitle: isTrial ? "Your trial will end immediately" : "You'll lose Pro access",
                    warningText: isTrial
                        ? "If you cancel now, your trial will end and you'll be downgraded to the Free plan."
                        : `Your Pro access will continue until ${endDate}. After that, you'll be downgraded to the Free plan.`,
                    onCancel: async () => {
                        // Cancel via our API (no redirect to Dodo portal)
                        try {
                            setOpeningPortal(true);
                            const res = await fetch('/api/subscription/cancel', {
                                method: 'POST',
                                credentials: 'include',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'pragma': 'no-cache',
                                    'cache-control': 'no-cache',
                                    'X-Requested-With': 'XMLHttpRequest'
                                },
                            });
                            if (!res.ok) {
                                const text = await res.text().catch(() => 'Unknown error');
                                throw new Error(text || 'Cancellation failed');
                            }
                            // Refresh local state after server-side cancellation
                            await fetchSubscription();
                            // Redirect user back to Billing tab (anchor) after cancellation
                            window.location.href = '/dashboard/settings#billing';
                        } catch (e) {
                            console.error('Failed to cancel subscription via API', e);
                            throw new Error('Unable to cancel subscription. Please try again.');
                        } finally {
                            setOpeningPortal(false);
                        }
                    },
                    onKeepSubscription: async () => {
                        // Just close the dialog
                    },
                }}
            />
            <PricingModal
                isOpen={showPricing}
                onClose={() => {
                    setShowPricing(false);
                    fetchSubscription();
                }}
            />
        </>
    );
}


export default function SettingsPage() {
    const router = useRouter();
    const { user, isLoaded } = useUser();
    const { signOut } = useClerk();
    const [activeTab, setActiveTab] = useState<string>('account');

    // Read hash from URL after hydration to avoid SSR mismatch
    useEffect(() => {
        const hash = window.location.hash.replace('#', '');
        if (hash && ['account', 'billing'].includes(hash)) {
            setActiveTab(hash);
        }
    }, []);
    const [isBugReportOpen, setIsBugReportOpen] = useState(false);
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);


    const handleTabChange = (value: string) => {
        setActiveTab(value);
    };

    const handleLogout = () => {
        signOut(() => router.push('/'));
    };

    // Get user info from Clerk
    const userName = user?.fullName || user?.firstName || 'User';
    const userEmail = user?.primaryEmailAddress?.emailAddress || '';



    return (
        <div className="p-6 pt-16 md:p-12 max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-foreground">Settings</h1>
                <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
            </div>

            <div className="w-full">
                {/* Custom Animated Tab Buttons with Sliding Indicator */}
                <LayoutGroup>
                    <div className="inline-flex h-10 items-center justify-center rounded-lg bg-muted border border-border p-1 text-muted-foreground lg:w-[300px] w-full relative">
                        {['account', 'billing'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => handleTabChange(tab)}
                                className={`relative inline-flex items-center justify-center flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${activeTab === tab ? 'text-primary-foreground' : 'hover:text-foreground'
                                    }`}
                            >
                                {activeTab === tab && (
                                    <motion.div
                                        layoutId="settings-tab-indicator"
                                        className="absolute inset-0 bg-primary rounded-md shadow-sm"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                                    />
                                )}
                                <span className="relative z-10 capitalize">{tab}</span>
                            </button>
                        ))}
                    </div>
                </LayoutGroup>

                {activeTab === "account" && (
                    <div className="mt-6 space-y-6 w-full text-left">
                        <Card className="shadow-lg border border-border bg-card">
                            <CardHeader className="px-4 pb-4 sm:px-6 sm:pb-6">
                                <CardTitle className="flex items-center gap-2 text-lg sm:gap-3 sm:text-xl text-foreground">
                                    <div className="bg-primary/10 ring-primary/20 rounded-lg p-1.5 ring-1 sm:p-2">
                                        <User className="text-primary h-4 w-4 sm:h-5 sm:w-5" />
                                    </div>
                                    Profile Information
                                </CardTitle>
                                <CardDescription className="text-sm sm:text-base text-muted-foreground">
                                    Your account details from your sign-in provider.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6 px-4 sm:space-y-8 sm:px-6">
                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="name" className="text-foreground">Name</Label>
                                        <Input
                                            id="name"
                                            value={isLoaded ? userName : 'Loading...'}
                                            disabled
                                            className="bg-muted/50 border-input text-foreground focus-visible:ring-ring"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email" className="text-foreground">Email</Label>
                                        <Input
                                            id="email"
                                            value={isLoaded ? userEmail : 'Loading...'}
                                            disabled
                                            className="bg-muted/50 border-input text-foreground focus-visible:ring-ring"
                                        />
                                    </div>
                                </div>
                                <div className="rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
                                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                                        <span className="bg-muted rounded-full p-1"><Lightbulb className="w-3 h-3 text-yellow-500" /></span>
                                        To update your profile, use the account menu in the top navigation.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Help & Feedback Section */}
                        <Card className="shadow-lg border border-border bg-card">
                            <CardHeader className="px-4 pb-4 sm:px-6 sm:pb-6">
                                <CardTitle className="flex items-center gap-2 text-lg sm:gap-3 sm:text-xl text-foreground">
                                    <div className="bg-primary/10 ring-primary/20 rounded-lg p-1.5 ring-1 sm:p-2">
                                        <MessageSquare className="text-primary h-4 w-4 sm:h-5 sm:w-5" />
                                    </div>
                                    Help & Feedback
                                </CardTitle>
                                <CardDescription className="text-sm sm:text-base text-muted-foreground">
                                    Report issues or share your ideas with us.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="px-4 sm:px-6 pb-6">
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <SettingsButton
                                        wrapperClassName="flex-1"
                                        beamColor="#ef4444"
                                        variant="outline"
                                        className="gap-2 bg-card border-border text-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
                                        onClick={() => setIsBugReportOpen(true)}
                                    >
                                        <Bug className="w-4 h-4" />
                                        Report a Bug
                                    </SettingsButton>
                                    <SettingsButton
                                        wrapperClassName="flex-1"
                                        beamColor="#10b981"
                                        variant="outline"
                                        className="gap-2 bg-card border-border text-foreground hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/50"
                                        onClick={() => setIsFeedbackOpen(true)}
                                    >
                                        <Lightbulb className="w-4 h-4" />
                                        Send Feedback
                                    </SettingsButton>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Logout Card */}
                        <Card className="shadow-lg border border-destructive/20 bg-card">
                            <CardHeader className="px-4 pb-4 sm:px-6 sm:pb-6">
                                <CardTitle className="flex items-center gap-2 text-lg sm:gap-3 sm:text-xl text-foreground">
                                    <div className="bg-destructive/10 ring-destructive/20 rounded-lg p-1.5 ring-1 sm:p-2">
                                        <LogOut className="text-destructive h-4 w-4 sm:h-5 sm:w-5" />
                                    </div>
                                    Sign Out
                                </CardTitle>
                                <CardDescription className="text-sm sm:text-base text-muted-foreground">
                                    Sign out of your account on this device.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="px-4 sm:px-6 pb-6">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <SettingsButton
                                            variant="destructive"
                                            wrapperClassName="w-full sm:w-auto"
                                            beamColor="#ef4444"
                                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-0"
                                        >
                                            <LogOut className="w-4 h-4 mr-2" />
                                            Log Out
                                        </SettingsButton>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="bg-background border-border text-foreground">
                                        <AlertDialogHeader>
                                            <AlertDialogTitle className="text-foreground">Are you sure you want to log out?</AlertDialogTitle>
                                            <AlertDialogDescription className="text-muted-foreground">
                                                You will be signed out of your account and redirected to the landing page.
                                                Any unsaved changes will be lost.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel className="bg-background border-border text-foreground hover:bg-accent hover:text-accent-foreground">Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={handleLogout}
                                                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                            >
                                                Yes, Log Out
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {activeTab === "billing" && (
                    <div className="mt-6 space-y-6">
                        <SubscriptionCard />
                    </div>
                )}
            </div>

            {/* Bug Report Modal */}
            <BugReportModal isOpen={isBugReportOpen} onClose={() => setIsBugReportOpen(false)} />

            {/* Feedback Modal */}
            <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        </div>
    );
}
