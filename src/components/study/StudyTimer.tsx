'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, X, Timer, Sparkles } from 'lucide-react';
import { useTimer } from '@/contexts/TimerContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const PRESETS = [
    { label: '15m', minutes: 15 },
    { label: '30m', minutes: 30 },
    { label: '1h', minutes: 60 },
];

// Circular progress ring component
function ProgressRing({ progress, size = 32, strokeWidth = 2.5 }: {
    progress: number;
    size?: number;
    strokeWidth?: number;
}) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - progress * circumference;

    return (
        <svg width={size} height={size} className="transform -rotate-90">
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-slate-700/30"
            />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="text-emerald-400 transition-all duration-1000"
            />
        </svg>
    );
}

export default function StudyTimer() {
    const {
        isRunning,
        isPaused,
        justCompleted,
        startTimer,
        pauseTimer,
        resumeTimer,
        stopTimer,
        clearCompleted,
        progress,
        formattedTime,
    } = useTimer();

    const [customMinutes, setCustomMinutes] = useState(25);
    const [isExpanded, setIsExpanded] = useState(false);
    const [showCompleted, setShowCompleted] = useState(false);

    // Watch for timer completion - only when justCompleted flag is set
    useEffect(() => {
        if (justCompleted) {
            setShowCompleted(true);
            toast.success('🎉 Goal Achieved!', {
                description: 'Great job staying focused! Take a well-deserved break.',
                duration: 5000,
            });
            // Clear the completed flag and reset UI after animation
            setTimeout(() => {
                setShowCompleted(false);
                clearCompleted();
            }, 3000);
        }
    }, [justCompleted, clearCompleted]);

    const handleStart = (minutes: number) => {
        startTimer(minutes);
        setIsExpanded(false);
    };

    // Completed celebration overlay
    if (showCompleted) {
        return (
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-full shadow-lg"
            >
                <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
                <span className="text-white text-sm font-medium">Goal Achieved!</span>
            </motion.div>
        );
    }

    // Timer is running - show compact timer
    if (isRunning) {
        return (
            <div className="relative">
                <motion.button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-full shadow-lg transition-all",
                        "bg-slate-900/90 dark:bg-slate-800/90 backdrop-blur-xl border",
                        isPaused ? "border-yellow-500/40" : "border-emerald-500/40"
                    )}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    {/* Progress ring */}
                    <div className="relative flex items-center justify-center">
                        <ProgressRing progress={progress} size={28} strokeWidth={2.5} />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                isPaused ? "bg-yellow-400" : "bg-emerald-400 animate-pulse"
                            )} />
                        </div>
                    </div>

                    {/* Time */}
                    <span className={cn(
                        "font-mono font-semibold text-sm tracking-wider",
                        isPaused ? "text-yellow-400" : "text-emerald-400"
                    )}>
                        {formattedTime}
                    </span>
                </motion.button>

                {/* Expanded controls */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ opacity: 0, y: -8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.95 }}
                            className="absolute top-12 left-1/2 -translate-x-1/2 z-50"
                        >
                            <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-2xl flex gap-2">
                                <button
                                    onClick={isPaused ? resumeTimer : pauseTimer}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                                        isPaused
                                            ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                                            : "bg-yellow-600 hover:bg-yellow-500 text-white"
                                    )}
                                >
                                    {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                                    {isPaused ? "Resume" : "Pause"}
                                </button>
                                <button
                                    onClick={() => { stopTimer(); setIsExpanded(false); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    <X className="w-3.5 h-3.5" />
                                    Stop
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    // Default - show timer icon, click to expand
    return (
        <div className="relative">
            <motion.button
                onClick={() => setIsExpanded(!isExpanded)}
                className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full transition-all",
                    "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700",
                    "border border-slate-200 dark:border-slate-700",
                    isExpanded && "ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900"
                )}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="Focus Timer"
            >
                <Timer className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </motion.button>

            {/* Expanded panel */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        className="absolute top-14 left-1/2 -translate-x-1/2 z-50"
                    >
                        <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl min-w-[280px]">
                            {/* Header */}
                            <div className="flex items-center gap-2 mb-4">
                                <Timer className="w-4 h-4 text-emerald-400" />
                                <span className="text-sm font-medium text-slate-300">Set Study Goal</span>
                            </div>

                            {/* Preset buttons */}
                            <div className="flex gap-2 mb-4">
                                {PRESETS.map((preset) => (
                                    <button
                                        key={preset.label}
                                        onClick={() => handleStart(preset.minutes)}
                                        className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors border border-white/5 hover:border-white/10"
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>

                            {/* Custom input */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min={1}
                                    max={180}
                                    value={customMinutes}
                                    onChange={(e) => setCustomMinutes(Math.max(1, Math.min(180, parseInt(e.target.value) || 1)))}
                                    className="w-16 px-2 py-2 bg-slate-800 border border-white/10 rounded-lg text-center text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                                />
                                <span className="text-xs text-slate-500">min</span>
                                <button
                                    onClick={() => handleStart(customMinutes)}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
                                >
                                    <Play className="w-3.5 h-3.5" />
                                    Start Focus
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Click outside to close */}
            {isExpanded && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsExpanded(false)}
                />
            )}
        </div>
    );
}
