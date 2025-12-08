'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

interface TimerContextType {
    // Timer state
    isRunning: boolean;
    isPaused: boolean;
    remainingSeconds: number;
    totalSeconds: number;
    justCompleted: boolean; // True only when timer naturally ends

    // Actions
    startTimer: (minutes: number) => void;
    pauseTimer: () => void;
    resumeTimer: () => void;
    stopTimer: () => void;
    clearCompleted: () => void;

    // Computed
    progress: number;
    formattedTime: string;
}

const TimerContext = createContext<TimerContextType | null>(null);

export function TimerProvider({ children }: { children: React.ReactNode }) {
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [remainingSeconds, setRemainingSeconds] = useState(0);
    const [totalSeconds, setTotalSeconds] = useState(0);
    const [justCompleted, setJustCompleted] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    // Play notification sound using Web Audio API
    const playNotificationSound = useCallback(() => {
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            }
            const ctx = audioContextRef.current;

            // Create a pleasant notification sound
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
            oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
            oscillator.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.2); // D6

            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.5);
        } catch (e) {
            console.log('Audio not supported');
        }
    }, []);

    // Timer countdown logic
    useEffect(() => {
        if (isRunning && !isPaused && remainingSeconds > 0) {
            intervalRef.current = setInterval(() => {
                setRemainingSeconds(prev => {
                    if (prev <= 1) {
                        // Timer complete - set justCompleted flag
                        setIsRunning(false);
                        setIsPaused(false);
                        setJustCompleted(true);
                        // Play completion sound
                        playNotificationSound();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isRunning, isPaused, remainingSeconds, playNotificationSound]);

    const startTimer = useCallback((minutes: number) => {
        const seconds = minutes * 60;
        setTotalSeconds(seconds);
        setRemainingSeconds(seconds);
        setIsRunning(true);
        setIsPaused(false);
        setJustCompleted(false);
    }, []);

    const pauseTimer = useCallback(() => {
        setIsPaused(true);
    }, []);

    const resumeTimer = useCallback(() => {
        setIsPaused(false);
    }, []);

    const stopTimer = useCallback(() => {
        setIsRunning(false);
        setIsPaused(false);
        setRemainingSeconds(0);
        setTotalSeconds(0);
        setJustCompleted(false);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
    }, []);

    const clearCompleted = useCallback(() => {
        setJustCompleted(false);
        setTotalSeconds(0);
    }, []);

    // Computed values
    const progress = totalSeconds > 0 ? (totalSeconds - remainingSeconds) / totalSeconds : 0;

    const formattedTime = (() => {
        const mins = Math.floor(remainingSeconds / 60);
        const secs = remainingSeconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    })();

    return (
        <TimerContext.Provider value={{
            isRunning,
            isPaused,
            remainingSeconds,
            totalSeconds,
            justCompleted,
            startTimer,
            pauseTimer,
            resumeTimer,
            stopTimer,
            clearCompleted,
            progress,
            formattedTime,
        }}>
            {children}
        </TimerContext.Provider>
    );
}

export function useTimer() {
    const context = useContext(TimerContext);
    if (!context) {
        throw new Error('useTimer must be used within a TimerProvider');
    }
    return context;
}
