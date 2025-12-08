'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useGlobalLoader } from '@/contexts/LoaderContext';
import Image from 'next/image';

export default function LoadingScreen() {
    const { isLoading, message } = useGlobalLoader();

    return (
        <AnimatePresence>
            {isLoading && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
                >
                    {/* Glassmorphism backdrop */}
                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" />

                    {/* Content */}
                    <div className="relative z-10 flex flex-col items-center gap-8">
                        {/* Logo with breathing/pulse animation */}
                        <motion.div
                            animate={{
                                scale: [1, 1.05, 1],
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut",
                            }}
                            className="relative"
                        >
                            {/* Glow effect */}
                            <motion.div
                                animate={{
                                    opacity: [0.5, 0.8, 0.5],
                                    scale: [1, 1.1, 1],
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                }}
                                className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur-2xl"
                            />

                            {/* Logo */}
                            <div className="relative w-24 h-24 rounded-2xl overflow-hidden shadow-2xl">
                                <Image
                                    src="/skoowl-logo.png"
                                    alt="Skoowl AI"
                                    fill
                                    className="object-contain p-2"
                                    priority
                                />
                            </div>
                        </motion.div>

                        {/* App name */}
                        <div className="text-center">
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                                skoowl ai
                            </h1>
                        </div>

                        {/* Indeterminate progress bar */}
                        <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <motion.div
                                animate={{
                                    x: ["-100%", "200%"],
                                }}
                                transition={{
                                    duration: 1.5,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                }}
                                className="w-1/2 h-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent rounded-full"
                            />
                        </div>

                        {/* Dynamic status message with smooth transition */}
                        <AnimatePresence mode="wait">
                            <motion.p
                                key={message}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                transition={{ duration: 0.2 }}
                                className="text-sm text-slate-400 text-center max-w-xs"
                            >
                                {message}
                            </motion.p>
                        </AnimatePresence>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

