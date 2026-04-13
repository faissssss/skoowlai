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

    const handleFlip = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsLifted(true);
        setIsFlipped(!isFlipped);
    };

    useEffect(() => {
        if (isLifted) {
            const timer = setTimeout(() => setIsLifted(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isLifted]);

    const springTransition = {
        type: 'spring' as const,
        stiffness: 260,
        damping: 20,
    };

    // Truncate text for better retention (max ~100 chars for front, ~300 for back)
    const truncate = (text: string, maxLength: number) => {
        if (text.length <= maxLength) return text;
        return text.slice(0, maxLength).trim() + '...';
    };

    const displayFront = truncate(frontContent, 120);
    const displayBack = truncate(backContent, 350);

    return (
        <div className="perspective-[1000px] w-full h-72 sm:h-80 cursor-pointer text-left">
            <motion.div
                className="w-full h-full relative"
                style={{ transformStyle: 'preserve-3d' }}
                animate={{
                    rotateY: isFlipped ? 180 : 0,
                    scale: isLifted ? 1.02 : 1,
                }}
                initial={false}
                transition={springTransition}
                onClick={handleFlip}
            >
                {/* Front Face */}
                <div
                    className="absolute w-full h-full bg-card rounded-2xl shadow-xl border border-border flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none overflow-hidden"
                    style={{ backfaceVisibility: 'hidden' }}
                >
                    <span className="text-[10px] sm:text-xs font-semibold text-primary uppercase tracking-wider mb-2 sm:mb-4">
                        Term
                    </span>
                    <h3 className="text-base sm:text-xl md:text-2xl font-bold text-foreground leading-snug line-clamp-4 overflow-hidden">
                        {displayFront}
                    </h3>
                    <div className="absolute bottom-3 sm:bottom-4 text-muted-foreground text-xs sm:text-sm flex items-center gap-1">
                        <RotateCw className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                        <span className="text-white">Tap to flip • Swipe to navigate</span>
                    </div>
                </div>

                {/* Back Face */}
                <div
                    className="absolute w-full h-full bg-card rounded-2xl shadow-xl border border-primary/20 flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none overflow-hidden"
                    style={{
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)'
                    }}
                >
                    <span className="text-[10px] sm:text-xs font-semibold text-primary uppercase tracking-wider mb-2 sm:mb-4">
                        Definition
                    </span>
                    <p className="text-sm sm:text-lg md:text-xl text-foreground leading-relaxed line-clamp-6 overflow-hidden">
                        {displayBack}
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
