"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { User, CreditCard, LogOut, Bug, Lightbulb, MessageSquare, Check, Crown, Loader2 } from 'lucide-react';
import { useUser, useClerk } from '@clerk/nextjs';
import BugReportModal from '@/components/BugReportModal';
import FeedbackModal from '@/components/FeedbackModal';
import PricingModal from '@/components/PricingModal';
import { motion, LayoutGroup } from 'framer-motion';

// Free plan features
const freePlanFeatures = [
    '3 study decks/day',
    '5 flashcards/day',
    '5 quizzes/day',
    '5 mind maps/day',
    '20 AI chat messages/day',
    'Smart notes generation',
    'Shared decks & collaboration',
];

// Student plan features
const studentPlanFeatures = [
    'Unlimited study decks',
    'Unlimited flashcards',
    'Unlimited quizzes',
    'Unlimited mind maps',
    'Custom flashcard & quiz count',
    '100 AI chat messages/day',
    'Smart notes generation',
    'Shared decks & collaboration',
];

function SubscriptionCard() {
    const [subscription, setSubscription] = useState<{ status: string; plan: string | null; subscriptionEndsAt?: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [showPricing, setShowPricing] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        const controller = new AbortController();

        async function fetchSubscription() {
            try {
                const res = await fetch('/api/subscription', { signal: controller.signal });
                if (res.ok) {
                    const data = await res.json();
                    setSubscription(data);
                } else {
                    setError(true);
                }
            } catch (error: any) {
                if (error.name !== 'AbortError') {
                    console.error('Failed to fetch subscription:', error);
                    setError(true);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }
        fetchSubscription();

        return () => controller.abort();
    }, []);

    const handleCancelSubscription = async () => {
        setCancelling(true);
        try {
            const res = await fetch('/api/subscription/cancel', { method: 'POST' });
            if (res.ok) {
                // Refresh subscription status
                const subRes = await fetch('/api/subscription');
                if (subRes.ok) {
                    setSubscription(await subRes.json());
                }
                setShowCancelDialog(false);
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to cancel subscription');
            }
        } catch (err) {
            console.error('Error cancelling:', err);
            alert('Failed to cancel subscription. Please try again.');
        } finally {
            setCancelling(false);
        }
    };

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

    const isActive = subscription?.status === 'active';
    const isCancelled = subscription?.status === 'cancelled';
    const features = isActive || isCancelled ? studentPlanFeatures : freePlanFeatures;
    const planName = isActive ? 'Pro' : isCancelled ? 'Pro (Cancelled)' : 'Free Plan';
    const endDate = subscription?.subscriptionEndsAt ? new Date(subscription.subscriptionEndsAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : null;

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        {(isActive || isCancelled) && <Crown className="w-5 h-5 text-yellow-500" />}
                        Subscription Plan
                    </CardTitle>
                    <CardDescription>Manage your billing and subscription.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className={`p-4 rounded-lg border flex items-center justify-between ${isActive
                        ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800'
                        : isCancelled
                            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                            : 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800'
                        }`}>
                        <div>
                            <p className={`font-medium ${isActive ? 'text-violet-900 dark:text-violet-300' : isCancelled ? 'text-amber-900 dark:text-amber-300' : 'text-green-900 dark:text-green-300'}`}>
                                {planName}
                            </p>
                            <p className={`text-sm ${isActive ? 'text-violet-700 dark:text-violet-400' : isCancelled ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}`}>
                                {isActive ? `${subscription.plan === 'yearly' ? 'Yearly' : 'Monthly'} subscription`
                                    : isCancelled ? `Access until ${endDate}`
                                        : 'Basic features with daily limits'}
                            </p>
                        </div>
                        <span className={`px-3 py-1 text-xs rounded-full font-medium ${isActive
                            ? 'bg-violet-200 dark:bg-violet-800 text-violet-800 dark:text-violet-200'
                            : isCancelled
                                ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200'
                                : 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                            }`}>
                            {isActive ? 'Active' : isCancelled ? 'Cancelled' : 'Active'}
                        </span>
                    </div>

                    {/* Feature list */}
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Your benefits:</p>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {features.map((feature, i) => (
                                <li key={i} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                                    {feature}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Upgrade button for free users */}
                    {!isActive && !isCancelled && (
                        <Button
                            onClick={() => setShowPricing(true)}
                            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white"
                        >
                            <Crown className="w-4 h-4 mr-2" />
                            Upgrade to Pro
                        </Button>
                    )}

                    {/* Cancel button for active subscribers */}
                    {isActive && (
                        <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                            <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20">
                                        Cancel Subscription
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
                                        <AlertDialogDescription className="space-y-2">
                                            <p>Your Pro features will remain active until <strong>{endDate || 'the end of your billing period'}</strong>.</p>
                                            <p>After that, you'll be moved to the Free plan with limited daily usage.</p>
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel disabled={cancelling}>Keep Subscription</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleCancelSubscription}
                                            disabled={cancelling}
                                            className="bg-red-600 hover:bg-red-700 text-white"
                                        >
                                            {cancelling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                            Yes, Cancel
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    )}

                    {/* Resubscribe button for cancelled users */}
                    {isCancelled && (
                        <Button
                            onClick={() => setShowPricing(true)}
                            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white"
                        >
                            <Crown className="w-4 h-4 mr-2" />
                            Resubscribe
                        </Button>
                    )}
                </CardContent>
            </Card>
            <PricingModal isOpen={showPricing} onClose={() => setShowPricing(false)} />
        </>
    );
}


export default function SettingsPage() {
    const router = useRouter();
    const { user, isLoaded } = useUser();
    const { signOut } = useClerk();
    const [activeTab, setActiveTab] = useState("account");
    const [isBugReportOpen, setIsBugReportOpen] = useState(false);
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

    useEffect(() => {
        // Read hash on mount
        const hash = window.location.hash.replace('#', '');
        if (hash && ['account', 'billing'].includes(hash)) {
            setActiveTab(hash);
        }
    }, []);

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
                    <div className="inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground lg:w-[300px] w-full relative">
                        {['account', 'billing'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => handleTabChange(tab)}
                                className={`relative inline-flex items-center justify-center flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${activeTab === tab ? 'text-foreground' : 'hover:text-foreground/80'
                                    }`}
                            >
                                {activeTab === tab && (
                                    <motion.div
                                        layoutId="settings-tab-indicator"
                                        className="absolute inset-0 bg-background rounded-md shadow-sm"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                                    />
                                )}
                                <span className="relative z-10 capitalize">{tab}</span>
                            </button>
                        ))}
                    </div>
                </LayoutGroup>

                {activeTab === "account" && (
                    <div className="mt-6 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Profile Information</CardTitle>
                                <CardDescription>Your account details from your sign-in provider.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Name</Label>
                                    <Input id="name" value={isLoaded ? userName : 'Loading...'} disabled />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input id="email" value={isLoaded ? userEmail : 'Loading...'} disabled />
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    To update your profile, use the account menu in the top navigation.
                                </p>
                            </CardContent>
                        </Card>

                        {/* Help & Feedback Section */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5" />
                                    Help & Feedback
                                </CardTitle>
                                <CardDescription>Report issues or share your ideas with us.</CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col sm:flex-row gap-3">
                                <Button
                                    variant="outline"
                                    className="flex-1 gap-2"
                                    onClick={() => setIsBugReportOpen(true)}
                                >
                                    <Bug className="w-4 h-4" />
                                    Report a Bug
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1 gap-2"
                                    onClick={() => setIsFeedbackOpen(true)}
                                >
                                    <Lightbulb className="w-4 h-4" />
                                    Send Feedback
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Logout Card */}
                        <Card className="border-red-200 dark:border-red-900/50">
                            <CardHeader>
                                <CardTitle className="text-red-600 dark:text-red-400">
                                    Sign Out
                                </CardTitle>
                                <CardDescription>Sign out of your account on this device.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive">
                                            Log Out
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure you want to log out?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                You will be signed out of your account and redirected to the landing page.
                                                Any unsaved changes will be lost.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
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

