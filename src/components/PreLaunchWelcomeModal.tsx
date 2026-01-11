'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, BookOpen, Brain, Zap } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@clerk/nextjs';

// Use localStorage so it persists permanently (only shows once ever)
// Bump version to show welcome again to existing users
const WELCOME_KEY = 'skoowl_hasSeenWelcome_v2';

export default function WelcomeModal() {
    const [isOpen, setIsOpen] = useState(false);
    const { isSignedIn, isLoaded } = useAuth();

    useEffect(() => {
        // Wait for auth to load
        if (!isLoaded) return;

        // Only show to signed-in users
        if (!isSignedIn) return;

        // Check if already seen (using localStorage - permanent storage)
        const hasSeenWelcome = localStorage.getItem(WELCOME_KEY);
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
        // Store permanently in localStorage (not sessionStorage)
        localStorage.setItem(WELCOME_KEY, 'true');
    };

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

                            {/* Header */}
                            <h2 className="text-2xl font-bold text-white mb-4">
                                Welcome to Skoowl AI!
                            </h2>

                            {/* Body */}
                            <p className="text-slate-300 text-sm leading-relaxed mb-6">
                                Your AI-powered study companion is ready! Upload documents, paste YouTube links, or record audio to instantly generate <span className="text-purple-400 font-medium">smart notes</span>,{' '}
                                <span className="text-purple-400 font-medium">flashcards</span>,{' '}
                                <span className="text-purple-400 font-medium">quizzes</span>, and{' '}
                                <span className="text-purple-400 font-medium">mind maps</span>.
                            </p>

                            {/* Quick Tips */}
                            <div className="flex justify-center gap-4 mb-6">
                                <div className="flex flex-col items-center gap-1">
                                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                                        <BookOpen className="w-5 h-5 text-purple-400" />
                                    </div>
                                    <span className="text-xs text-slate-400">Notes</span>
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                                        <Zap className="w-5 h-5 text-purple-400" />
                                    </div>
                                    <span className="text-xs text-slate-400">Flashcards</span>
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                                        <Brain className="w-5 h-5 text-purple-400" />
                                    </div>
                                    <span className="text-xs text-slate-400">Quizzes</span>
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                                        <Sparkles className="w-5 h-5 text-purple-400" />
                                    </div>
                                    <span className="text-xs text-slate-400">Mind Maps</span>
                                </div>
                            </div>

                            {/* Action Button */}
                            <button
                                onClick={handleClose}
                                className="w-full py-3 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
                            >
                                Let's Get Started! ✨
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

