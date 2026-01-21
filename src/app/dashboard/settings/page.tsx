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
            // First, sync subscription from Clerk to ensure DB matches
            await fetch('/api/subscription/sync', {
                method: 'POST'
            });

            // Then fetch the updated subscription data
            const res = await fetch('/api/subscription');
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

    const isActive = subscription?.status === 'active' || subscription?.status === 'trialing';
    const isTrial = subscription?.status === 'trialing';
    const isCancelled = subscription?.status === 'cancelled';
    const isFree = !isActive && !isCancelled;

    // Determine the plan to display
    const currentPlanData: Plan = isActive || isCancelled ? plans[1] : plans[0]; // Pro or Free

    const endDate = subscription?.subscriptionEndsAt ? new Date(subscription.subscriptionEndsAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : 'N/A';

    // Build CurrentPlan object for SubscriptionManagement
    const currentPlan: CurrentPlanType = {
        plan: currentPlanData,
        type: (subscription?.plan as 'monthly' | 'yearly') || 'monthly',
        price: subscription?.plan === 'yearly' ? '$39.99/year' : '$4.99/month',
        nextBillingDate: endDate,
        paymentMethod: 'Credit Card', // Dodo doesn't expose this; placeholder
        status: isTrial ? 'trialing' : isCancelled ? 'cancelled' : isActive ? 'active' : 'free',
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
                    triggerText: isCancelled ? "Resubscribe" : isFree ? "Upgrade to Pro" : "Update Plan",
                    onPlanChange: () => {
                        setShowPricing(true);
                    },
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
                        // Redirect to Dodo customer portal for cancellation
                        try {
                            setOpeningPortal(true);
                            const params = new URLSearchParams();
                            if (subscription?.customerId) {
                                params.set('customer_id', String(subscription.customerId));
                            }
                            window.location.href = `/api/customer-portal?${params.toString()}`;
                        } catch (e) {
                            console.error('Failed to open customer portal', e);
                            throw new Error('Unable to open customer portal. Please try again.');
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
                <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your account and preferences</p>
            </div>

            <div className="w-full">
                {/* Custom Animated Tab Buttons with Sliding Indicator */}
                <LayoutGroup>
                    <div className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900/50 border border-slate-800 p-1 text-slate-400 lg:w-[300px] w-full relative">
                        {['account', 'billing'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => handleTabChange(tab)}
                                className={`relative inline-flex items-center justify-center flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${activeTab === tab ? 'text-white' : 'hover:text-slate-200'
                                    }`}
                            >
                                {activeTab === tab && (
                                    <motion.div
                                        layoutId="settings-tab-indicator"
                                        className="absolute inset-0 bg-violet-600 rounded-md shadow-sm shadow-violet-500/20"
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
                        <Card className="shadow-lg border border-slate-800 bg-slate-900">
                            <CardHeader className="px-4 pb-4 sm:px-6 sm:pb-6">
                                <CardTitle className="flex items-center gap-2 text-lg sm:gap-3 sm:text-xl text-slate-100">
                                    <div className="bg-primary/10 ring-primary/20 rounded-lg p-1.5 ring-1 sm:p-2">
                                        <User className="text-primary h-4 w-4 sm:h-5 sm:w-5" />
                                    </div>
                                    Profile Information
                                </CardTitle>
                                <CardDescription className="text-sm sm:text-base text-slate-400">
                                    Your account details from your sign-in provider.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6 px-4 sm:space-y-8 sm:px-6">
                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="name" className="text-slate-200">Name</Label>
                                        <Input
                                            id="name"
                                            value={isLoaded ? userName : 'Loading...'}
                                            disabled
                                            className="bg-slate-950 border-slate-800 text-slate-300 focus-visible:ring-violet-500 placeholder:text-slate-600"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email" className="text-slate-200">Email</Label>
                                        <Input
                                            id="email"
                                            value={isLoaded ? userEmail : 'Loading...'}
                                            disabled
                                            className="bg-slate-950 border-slate-800 text-slate-300 focus-visible:ring-violet-500 placeholder:text-slate-600"
                                        />
                                    </div>
                                </div>
                                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 sm:p-4">
                                    <p className="text-sm text-slate-400 flex items-center gap-2">
                                        <span className="bg-slate-800 rounded-full p-1"><Lightbulb className="w-3 h-3 text-yellow-500" /></span>
                                        To update your profile, use the account menu in the top navigation.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Help & Feedback Section */}
                        <Card className="shadow-lg border border-slate-800 bg-slate-900">
                            <CardHeader className="px-4 pb-4 sm:px-6 sm:pb-6">
                                <CardTitle className="flex items-center gap-2 text-lg sm:gap-3 sm:text-xl text-slate-100">
                                    <div className="bg-primary/10 ring-primary/20 rounded-lg p-1.5 ring-1 sm:p-2">
                                        <MessageSquare className="text-primary h-4 w-4 sm:h-5 sm:w-5" />
                                    </div>
                                    Help & Feedback
                                </CardTitle>
                                <CardDescription className="text-sm sm:text-base text-slate-400">
                                    Report issues or share your ideas with us.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="px-4 sm:px-6 pb-6">
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <SettingsButton
                                        wrapperClassName="flex-1"
                                        beamColor="#ef4444"
                                        variant="outline"
                                        className="gap-2 bg-slate-900 border-slate-700 text-slate-200 hover:bg-red-900/10 hover:text-red-400 hover:border-red-900/50"
                                        onClick={() => setIsBugReportOpen(true)}
                                    >
                                        <Bug className="w-4 h-4" />
                                        Report a Bug
                                    </SettingsButton>
                                    <SettingsButton
                                        wrapperClassName="flex-1"
                                        beamColor="#10b981"
                                        variant="outline"
                                        className="gap-2 bg-slate-900 border-slate-700 text-slate-200 hover:bg-emerald-900/10 hover:text-emerald-400 hover:border-emerald-900/50"
                                        onClick={() => setIsFeedbackOpen(true)}
                                    >
                                        <Lightbulb className="w-4 h-4" />
                                        Send Feedback
                                    </SettingsButton>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Logout Card */}
                        <Card className="shadow-lg border border-red-900/20 bg-slate-900">
                            <CardHeader className="px-4 pb-4 sm:px-6 sm:pb-6">
                                <CardTitle className="flex items-center gap-2 text-lg sm:gap-3 sm:text-xl text-slate-100">
                                    <div className="bg-red-500/10 ring-red-500/20 rounded-lg p-1.5 ring-1 sm:p-2">
                                        <LogOut className="text-red-500 h-4 w-4 sm:h-5 sm:w-5" />
                                    </div>
                                    Sign Out
                                </CardTitle>
                                <CardDescription className="text-sm sm:text-base text-slate-400">
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
                                            className="bg-red-600 hover:bg-red-700 text-white border-0"
                                        >
                                            <LogOut className="w-4 h-4 mr-2" />
                                            Log Out
                                        </SettingsButton>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="bg-slate-900 border-slate-800 text-slate-100">
                                        <AlertDialogHeader>
                                            <AlertDialogTitle className="text-slate-100">Are you sure you want to log out?</AlertDialogTitle>
                                            <AlertDialogDescription className="text-slate-400">
                                                You will be signed out of your account and redirected to the landing page.
                                                Any unsaved changes will be lost.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white">Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={handleLogout}
                                                className="bg-red-600 hover:bg-red-700 text-white"
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
