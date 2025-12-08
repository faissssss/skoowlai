"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThemeToggle } from '@/components/ui/theme-toggle';
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
import { User, CreditCard, Settings as SettingsIcon, Bell, Palette, LogOut, Bug, Lightbulb, MessageSquare } from 'lucide-react';
import { useUser, useClerk } from '@clerk/nextjs';
import BugReportModal from '@/components/BugReportModal';
import FeedbackModal from '@/components/FeedbackModal';

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
        if (hash && ['account', 'billing', 'preferences'].includes(hash)) {
            setActiveTab(hash);
        }
    }, []);

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        window.history.replaceState(null, '', `#${value}`);
    };

    const handleLogout = () => {
        signOut(() => router.push('/'));
    };

    // Get user info from Clerk
    const userName = user?.fullName || user?.firstName || 'User';
    const userEmail = user?.primaryEmailAddress?.emailAddress || '';

    return (
        <div className="p-6 md:p-12 max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your account and preferences</p>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
                    <TabsTrigger value="account">Account</TabsTrigger>
                    <TabsTrigger value="billing">Billing</TabsTrigger>
                    <TabsTrigger value="preferences">Preferences</TabsTrigger>
                </TabsList>

                <TabsContent value="account" className="mt-6 space-y-6">
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

                    {/* Logout Card */}
                    <Card className="border-red-200 dark:border-red-900/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                                <LogOut className="w-5 h-5" />
                                Sign Out
                            </CardTitle>
                            <CardDescription>Sign out of your account on this device.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" className="gap-2">
                                        <LogOut className="w-4 h-4" />
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
                </TabsContent>

                <TabsContent value="billing" className="mt-6 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Subscription Plan</CardTitle>
                            <CardDescription>Manage your billing and subscription.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800 flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-green-900 dark:text-green-300">Free Plan</p>
                                    <p className="text-sm text-green-700 dark:text-green-400">Unlimited access to all features</p>
                                </div>
                                <span className="px-3 py-1 bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 text-xs rounded-full font-medium">Active</span>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="preferences" className="mt-6 space-y-6">
                    {/* Theme Settings */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Palette className="w-5 h-5" />
                                Appearance
                            </CardTitle>
                            <CardDescription>Choose your preferred theme for the app.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ThemeToggle />
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
                </TabsContent>
            </Tabs>

            {/* Bug Report Modal */}
            <BugReportModal isOpen={isBugReportOpen} onClose={() => setIsBugReportOpen(false)} />

            {/* Feedback Modal */}
            <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        </div>
    );
}

