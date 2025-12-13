'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RotateCw } from 'lucide-react';

interface FlashcardProps {
    frontContent: string;
    backContent: string;
}

export default function Flashcard({ frontContent, backContent }: FlashcardProps) {
    const [isFlipped, setIsFlipped] = useState(false);
    const [isLifted, setIsLifted] = useState(false);

    const handleFlip = () => {
        // Trigger lift effect
        setIsLifted(true);
        setIsFlipped(!isFlipped);
    };

    // Reset lift after flip animation completes
    useEffect(() => {
        if (isLifted) {
            const timer = setTimeout(() => setIsLifted(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isLifted]);

    // Spring physics for snappy ~0.3s flip
    const springTransition = {
        type: 'spring' as const,
        stiffness: 260,
        damping: 20,
    };

    return (
        <div
            className="[perspective:1000px] w-full h-80 cursor-pointer"
            onClick={handleFlip}
        >
            <motion.div
                className="w-full h-full relative [transform-style:preserve-3d]"
                animate={{
                    rotateY: isFlipped ? 180 : 0,
                    scale: isLifted ? 1.05 : 1,
                }}
                initial={false}
                transition={springTransition}
            >
                {/* Front Face */}
                <div className="absolute w-full h-full [backface-visibility:hidden] bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center p-8 text-center">
                    <span className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-4">
                        Term
                    </span>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {frontContent}
                    </h3>
                    <div className="absolute bottom-4 text-slate-400 dark:text-slate-500 text-sm flex items-center gap-1">
                        <RotateCw className="w-4 h-4" />
                        <span>Click to flip</span>
                    </div>
                </div>

                {/* Back Face - Pre-rotated 180deg so text isn't mirrored */}
                <div
                    className="absolute w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/40 dark:to-purple-900/30 rounded-2xl shadow-xl border border-indigo-100 dark:border-indigo-800 flex flex-col items-center justify-center p-8 text-center"
                >
                    <span className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-4">
                        Definition
                    </span>
                    <p className="text-xl text-slate-800 dark:text-slate-200 leading-relaxed">
                        {backContent}
                    </p>
                </div>
            </motion.div>
        </div>
    );
}

