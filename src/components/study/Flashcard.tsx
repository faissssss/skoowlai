'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, RotateCw } from 'lucide-react';

interface FlashcardProps {
    front: string;
    back: string;
}

export default function Flashcard({ front, back }: FlashcardProps) {
    const [isFlipped, setIsFlipped] = useState(false);

    const handleFlip = () => {
        setIsFlipped(!isFlipped);
    };

    return (
        <div className="perspective-1000 w-full h-80 cursor-pointer" onClick={handleFlip}>
            <motion.div
                className="w-full h-full relative preserve-3d transition-all duration-500"
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
                style={{ transformStyle: 'preserve-3d' }}
            >
                {/* Front */}
                <div className="absolute w-full h-full backface-hidden bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center p-8 text-center">
                    <span className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-4">Term</span>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{front}</h3>
                    <div className="absolute bottom-4 text-slate-400 dark:text-slate-500 text-sm flex items-center">
                        <RotateCw className="w-4 h-4 mr-1" /> Click to flip
                    </div>
                </div>

                {/* Back */}
                <div
                    className="absolute w-full h-full backface-hidden bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl shadow-lg border border-indigo-100 dark:border-indigo-800 flex flex-col items-center justify-center p-8 text-center"
                    style={{ transform: 'rotateY(180deg)' }}
                >
                    <span className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-4">Definition</span>
                    <p className="text-xl text-slate-800 dark:text-slate-200 leading-relaxed">{back}</p>
                </div>
            </motion.div>
        </div>
    );
}

