'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@clerk/nextjs';
import { IS_PRE_LAUNCH } from '@/lib/config';

const WELCOME_KEY = 'skoowl_hasSeenWelcome';

export default function PreLaunchWelcomeModal() {
    const [isOpen, setIsOpen] = useState(false);
    const { isSignedIn, isLoaded } = useAuth();

    useEffect(() => {
        // Only show if pre-launch mode is enabled
        if (!IS_PRE_LAUNCH) return;

        // Wait for auth to load
        if (!isLoaded) return;

        // Only show to signed-in users
        if (!isSignedIn) return;

        // Check if already seen this session
        const hasSeenWelcome = sessionStorage.getItem(WELCOME_KEY);
        if (!hasSeenWelcome) {
            // Small delay for smoother experience after sign-in
            const timer = setTimeout(() => {
                setIsOpen(true);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [isSignedIn, isLoaded]);

    const handleClose = () => {
        setIsOpen(false);
        sessionStorage.setItem(WELCOME_KEY, 'true');
    };

    // Don't render anything if not in pre-launch mode
    if (!IS_PRE_LAUNCH) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                >
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                    />

                    {/* Modal Card */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="relative w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
                    >
                        {/* Decorative gradient orbs */}
                        <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />
                        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl" />

                        {/* Close button */}
                        <button
                            onClick={handleClose}
                            className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors z-10"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Content */}
                        <div className="relative p-8 text-center">
                            {/* Logo */}
                            <div className="flex justify-center mb-6">
                                <div className="relative">
                                    <Image
                                        src="/skoowl-logo.png"
                                        alt="Skoowl AI"
                                        width={80}
                                        height={80}
                                        className="rounded-xl"
                                    />
                                    <div className="absolute -inset-2 bg-gradient-to-r from-purple-500/30 to-indigo-500/30 rounded-2xl blur-lg -z-10" />
                                </div>
                            </div>

                            {/* VIP Badge */}
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 rounded-full mb-4">
                                <Sparkles className="w-4 h-4 text-amber-400" />
                                <span className="text-xs font-semibold text-amber-300">VIP Early Access</span>
                            </div>

                            {/* Header */}
                            <h2 className="text-2xl font-bold text-white mb-4">
                                Welcome to skoowl ai! 🚀
                            </h2>

                            {/* Body */}
                            <p className="text-slate-300 text-sm leading-relaxed mb-6">
                                We're currently in <span className="text-purple-400 font-medium">pre-launch mode</span>.
                                That means you get <span className="text-amber-400 font-medium">VIP access for free</span> for a limited time!
                                Enjoy unlimited access to all features while we polish up the tech.
                                No credit card required.
                            </p>

                            <p className="text-slate-400 text-xs mb-6">
                                We really appreciate your feedback so we can improve this platform further.
                                Please navigate to <span className="text-slate-300">Settings → Preferences</span> to share your thoughts!
                            </p>

                            {/* Action Button */}
                            <button
                                onClick={handleClose}
                                className="w-full py-3 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
                            >
                                Start Exploring
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
