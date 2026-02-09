'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform, useAnimation, PanInfo, AnimatePresence } from 'framer-motion';
import Flashcard from './Flashcard';

interface Card {
    id: string;
    front: string;
    back: string;
}

interface SwipeableCardStackProps {
    cards: Card[];
    currentIndex: number;
    onSwipeLeft: () => void;
    onSwipeRight: () => void;
}

export default function SwipeableCardStack({
    cards,
    currentIndex,
    onSwipeLeft,
    onSwipeRight
}: SwipeableCardStackProps) {
    // Only render the current card and the next few for performance and visual stacking
    // We'll show 3 cards max
    const visibleCards = cards.slice(currentIndex, currentIndex + 3);

    // If no cards left, show nothing (or handle empty state in parent)
    if (visibleCards.length === 0) return null;

    return (
        <div className="relative w-full h-80 flex justify-center items-center">
            {visibleCards.map((card, index) => {
                // Index relative to the visible stack (0 is top card)
                const isTop = index === 0;
                return (
                    <CardItem
                        key={card.id}
                        card={card}
                        index={index}
                        isTop={isTop}
                        onSwipeLeft={onSwipeLeft}
                        onSwipeRight={onSwipeRight}
                    />
                );
            }).reverse()}
            {/* Reverse so the first item (top card) is rendered last (on top of z-index) */}
        </div>
    );
}

interface CardItemProps {
    card: Card;
    index: number; // 0 = top
    isTop: boolean;
    onSwipeLeft: () => void;
    onSwipeRight: () => void;
}

function CardItem({ card, index, isTop, onSwipeLeft, onSwipeRight }: CardItemProps) {
    const x = useMotionValue(0);
    const controls = useAnimation();

    // Rotation based on x drag (tilt effect)
    const rotate = useTransform(x, [-200, 200], [-25, 25]);

    // Opacity for fade out (optional, maybe not needed for top card, but good for exit)
    const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0]);

    // Stack effects for cards behind
    const scale = 1 - index * 0.05; // 1, 0.95, 0.9
    const y = index * 15; // 0, 15, 30
    const zIndex = 100 - index;

    const handleDragEnd = async (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const threshold = 50; // Lowered threshold for easier swipe
        const velocityThreshold = 300; // Lowered velocity threshold
        const offset = info.offset.x;
        const velocity = info.velocity.x;

        const swipedLeft = offset < -threshold || velocity < -velocityThreshold;
        const swipedRight = offset > threshold || velocity > velocityThreshold;

        if (swipedLeft || swipedRight) {
            // Swipe in either direction goes to next card
            const exitX = swipedLeft ? -400 : 400;
            await controls.start({
                x: exitX,
                opacity: 0,
                transition: { duration: 0.15, ease: 'easeOut' }
            });
            onSwipeLeft(); // Always go to next card (using onSwipeLeft as the "next" action)
        } else {
            // Return to center smoothly
            controls.start({
                x: 0,
                opacity: 1,
                transition: { type: 'spring', stiffness: 400, damping: 30 }
            });
        }
    };

    return (
        <motion.div
            className="absolute w-full h-full"
            style={{
                zIndex,
                x: isTop ? x : 0,
                rotate: isTop ? rotate : 0,
                opacity: isTop ? opacity : 1 - index * 0.2 // Fade out back cards slightly
            }}
            animate={controls}
            initial={{ scale, y }}
            // Animate stack movement when top card changes (index changes)
            whileInView={{ scale, y, transition: { type: 'spring', stiffness: 300, damping: 30 } }}
            drag={isTop ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.7} // More elastic for better feel
            onDragEnd={handleDragEnd}
            whileTap={{ scale: isTop ? 1.02 : scale }}
        >
            <Flashcard
                frontContent={card.front}
                backContent={card.back}
            // We don't pass swipe handlers here anymore, as the wrapper handles it
            />
        </motion.div>
    );
}
