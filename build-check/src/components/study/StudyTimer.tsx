'use client';

import { useState, useEffect, useCallback, startTransition } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, X, Timer, Sparkles } from 'lucide-react';
import { useTimer } from '@/contexts/TimerContext';
import { cn } from '@/lib/utils';
import { AnimatedDockButton } from '@/components/ui/animated-dock-button';

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
                className="text-muted/30"
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
                className="text-yellow-400 transition-all duration-1000"
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
    const handleTimerCompletion = useCallback(() => {
        startTransition(() => {
            setShowCompleted(true);
        });
        // Clear the completed flag and reset UI after animation
        setTimeout(() => {
            startTransition(() => {
                setShowCompleted(false);
            });
            clearCompleted();
        }, 5000);
    }, [clearCompleted]);

    useEffect(() => {
        if (justCompleted) {
            handleTimerCompletion();
        }
    }, [justCompleted, handleTimerCompletion]);

    const handleStart = (minutes: number) => {
        startTimer(minutes);
        setIsExpanded(false);
    };

    // Fun celebration messages
    const celebrationMessages = [
        { title: "Champion mode!", subtitle: "You're basically a focus ninja now!" },
        { title: "Mission complete!", subtitle: "Houston, we have a genius!" },
        { title: "Superstar alert!", subtitle: "Your focus level? Over 9000!" },
        { title: "Big brain time!", subtitle: "You just leveled up your smartness!" },
        { title: "Nailed it!", subtitle: "Time for a well-deserved snack break!" },
        { title: "Victory royale!", subtitle: "You stayed focused like a boss!" },
    ];

    const [celebrationIndex] = useState(() => Math.floor(Math.random() * celebrationMessages.length));
    const [confettiParticles, setConfettiParticles] = useState<Array<{
        id: number;
        initialX: number;
        duration: number;
        delay: number;
        rotateDirection: number;
        color: string;
    }>>([]);

    // Generate confetti particles when showCompleted becomes true
    const generateConfettiParticles = useCallback(() => {
        if (typeof window === 'undefined') return [];
        return [...Array(20)].map((_, i) => ({
            id: i,
            initialX: Math.random() * window.innerWidth,
            duration: 3 + Math.random() * 2,
            delay: Math.random() * 0.5,
            rotateDirection: Math.random() > 0.5 ? 1 : -1,
            color: ["bg-yellow-400", "bg-pink-500", "bg-emerald-400", "bg-purple-500", "bg-blue-400", "bg-orange-400"][i % 6]
        }));
    }, []);

    useEffect(() => {
        if (showCompleted && confettiParticles.length === 0) {
            const particles = generateConfettiParticles();
            startTransition(() => {
                setConfettiParticles(particles);
            });
        } else if (!showCompleted) {
            startTransition(() => {
                setConfettiParticles([]);
            });
        }
    }, [showCompleted, confettiParticles.length, generateConfettiParticles]);

    // Completed celebration overlay - Full screen centered modal
    if (showCompleted) {
        // SSR protection - must be checked before accessing window
        if (typeof window === 'undefined') {
            return null;
        }
        const message = celebrationMessages[celebrationIndex];
        const modalContent = (
            <AnimatePresence>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-9999 flex items-center justify-center p-4 min-h-screen supports-min-h-screen:min-h-dvh"
                >
                    {/* Backdrop with blur */}
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

                    {/* Floating confetti particles */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        {confettiParticles.map((particle) => (
                            <motion.div
                                key={particle.id}
                                initial={{
                                    y: -20,
                                    x: particle.initialX,
                                    rotate: 0,
                                    opacity: 1
                                }}
                                animate={{
                                    y: window.innerHeight + 20,
                                    rotate: 360 * particle.rotateDirection,
                                    opacity: [1, 1, 0]
                                }}
                                transition={{
                                    duration: particle.duration,
                                    delay: particle.delay,
                                    ease: "linear"
                                }}
                                className={cn(
                                    "absolute w-3 h-3 rounded-sm",
                                    particle.color
                                )}
                            />
                        ))}
                    </div>

                    {/* Modal Card */}
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0, y: 50 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.5, opacity: 0, y: 50 }}
                        transition={{ type: "spring", damping: 15, stiffness: 300 }}
                        className="relative bg-black rounded-3xl p-6 md:p-8 shadow-2xl border border-yellow-400/30 max-w-[90vw] md:max-w-md w-full text-center"
                    >
                        {/* Glow effect */}
                        <div className="absolute inset-0 rounded-3xl bg-linear-to-r from-yellow-400/20 via-amber/20 to-yellow-500/20 blur-xl" />

                        {/* Content */}
                        <div className="relative z-10">
                            {/* Big emoji with bounce animation */}
                            <motion.div
                                animate={{
                                    scale: [1, 1.2, 1],
                                    rotate: [0, -10, 10, 0]
                                }}
                                transition={{
                                    duration: 0.6,
                                    repeat: Infinity,
                                    repeatDelay: 1
                                }}
                                className="text-5xl md:text-7xl mb-3 md:mb-4"
                            >
                                🎉
                            </motion.div>

                            {/* Title */}
                            <motion.h2
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="text-2xl md:text-3xl font-bold text-foreground mb-2"
                            >
                                {message.title}
                            </motion.h2>

                            {/* Subtitle */}
                            <motion.p
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="text-sm md:text-lg text-muted-foreground mb-5 md:mb-6"
                            >
                                {message.subtitle}
                            </motion.p>

                            {/* Sparkle decoration */}
                            <motion.div
                                className="flex justify-center gap-2 mb-5 md:mb-6"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.4 }}
                            >
                                {[...Array(5)].map((_, i) => (
                                    <motion.div
                                        key={i}
                                        animate={{
                                            scale: [1, 1.5, 1],
                                            opacity: [0.5, 1, 0.5]
                                        }}
                                        transition={{
                                            duration: 1,
                                            delay: i * 0.1,
                                            repeat: Infinity
                                        }}
                                    >
                                        <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-yellow-400" />
                                    </motion.div>
                                ))}
                            </motion.div>

                            {/* Dismiss button */}
                            <motion.button
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                                onClick={() => {
                                    setShowCompleted(false);
                                    clearCompleted();
                                }}
                                className="px-5 py-2.5 md:px-6 md:py-3 bg-linear-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-white text-sm md:text-base font-semibold rounded-xl shadow-lg shadow-yellow-400/25 transition-all hover:shadow-yellow-400/40 hover:scale-105"
                            >
                                Awesome! 🙌
                            </motion.button>

                            {/* Auto-dismiss hint */}
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.6 }}
                                className="text-[10px] md:text-xs text-muted-foreground/70 mt-3 md:mt-4"
                            >
                                Closing automatically in a few seconds...
                            </motion.p>
                        </div>
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        );

        // Check if document is available (SSR protection)
        if (typeof document !== 'undefined') {
            return createPortal(modalContent, document.body);
        }
        return null;
    }

    // Timer is running - show compact timer
    if (isRunning) {
        return (
            <div className="relative">
                <AnimatedDockButton
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-full shadow-lg",
                        "bg-card/90 backdrop-blur-xl border",
                        isPaused ? "border-yellow-400/50" : "border-yellow-400/50"
                    )}
                >
                    {/* Progress ring */}
                    <div className="relative flex items-center justify-center">
                        <ProgressRing progress={progress} size={28} strokeWidth={2.5} />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                isPaused ? "bg-yellow-400" : "bg-yellow-400 animate-pulse"
                            )} />
                        </div>
                    </div>

                    {/* Time */}
                    <span className={cn(
                        "font-mono font-semibold text-sm tracking-wider",
                        isPaused ? "text-yellow-400" : "text-yellow-400"
                    )}>
                        {formattedTime}
                    </span>
                </AnimatedDockButton>

                {/* Expanded controls */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ opacity: 0, y: -8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.95 }}
                            className="absolute top-12 left-1/2 -translate-x-1/2 z-50"
                        >
                            <div className="bg-card/95 backdrop-blur-xl border border-border rounded-xl p-3 shadow-2xl flex gap-2">
                                <AnimatedDockButton
                                    onClick={isPaused ? resumeTimer : pauseTimer}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                                        isPaused
                                            ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                                            : "bg-amber hover:bg-amber/90 text-amber-foreground"
                                    )}
                                >
                                    {isPaused ? <Play className="w-3.5 h-3.5 text-white" /> : <Pause className="w-3.5 h-3.5 text-white" />}
                                    {isPaused ? "Resume" : "Pause"}
                                </AnimatedDockButton>
                                <AnimatedDockButton
                                    onClick={() => { stopTimer(); setIsExpanded(false); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/20 hover:bg-destructive text-destructive hover:text-destructive-foreground rounded-lg text-sm font-medium transition-colors"
                                >
                                    <X className="w-3.5 h-3.5" />
                                    Stop
                                </AnimatedDockButton>
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
            <AnimatedDockButton
                onClick={() => setIsExpanded(!isExpanded)}
                className={cn(
                    "flex items-center justify-center w-9 h-9 rounded-md",
                    "bg-transparent hover:bg-accent dark:hover:bg-accent/50",
                    "border border-white/20 dark:border-border",
                    "text-muted-foreground dark:text-muted-foreground hover:text-accent-foreground",
                    "hover:border-primary/50 hover:text-primary",
                    "active:border-primary active:text-primary focus:border-primary",
                    isExpanded && "ring-2 ring-yellow-400 ring-offset-2 dark:ring-offset-background"
                )}
                title="Focus Timer"
            >
                <Timer className="w-5 h-5" />
            </AnimatedDockButton>

            {/* Expanded panel */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        className="absolute top-14 left-1/2 -translate-x-1/2 z-50"
                    >
                        <div className="bg-card/95 backdrop-blur-xl border border-border rounded-2xl p-4 shadow-2xl min-w-[280px]">
                            {/* Header */}
                            <div className="flex items-center gap-2 mb-4">
                                <Timer className="w-4 h-4 text-yellow-400" />
                                <span className="text-sm font-medium text-muted-foreground">Set Study Goal</span>
                            </div>

                            {/* Preset buttons */}
                            <div className="flex gap-2 mb-4">
                                {PRESETS.map((preset) => (
                                    <AnimatedDockButton
                                        key={preset.label}
                                        onClick={() => handleStart(preset.minutes)}
                                        className="flex-1 px-3 py-2 bg-muted hover:bg-muted/80 text-muted-foreground text-sm font-medium rounded-lg transition-colors border border-border hover:border-border/80"
                                    >
                                        {preset.label}
                                    </AnimatedDockButton>
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
                                    className="w-16 px-2 py-2 bg-muted border border-yellow-400/30 rounded-lg text-center text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-yellow-400/50"
                                />
                                <span className="text-xs text-muted-foreground/70">min</span>
                                <AnimatedDockButton
                                    onClick={() => handleStart(customMinutes)}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-yellow-400 hover:bg-yellow-500 text-white text-sm font-medium rounded-lg transition-colors"
                                >
                                    <Play className="w-3.5 h-3.5 text-white" />
                                    Start Focus
                                </AnimatedDockButton>
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
