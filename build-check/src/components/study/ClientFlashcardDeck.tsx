'use client';

import { useState } from 'react';
import Flashcard from './Flashcard';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ClientFlashcardDeck({ cards }: { cards: Array<{ front: string; back: string }> }) {
    const [currentIndex, setCurrentIndex] = useState(0);

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % cards.length);
    };

    const handlePrev = () => {
        setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
    };

    if (cards.length === 0) {
        return <div className="text-center text-muted-foreground">No flashcards available.</div>;
    }

    return (
        <div className="space-y-8">
            <Flashcard
                key={currentIndex} // Force re-render on change to reset flip state
                frontContent={cards[currentIndex].front}
                backContent={cards[currentIndex].back}
            />

            <div className="flex items-center justify-center gap-4">
                <Button variant="outline" onClick={handlePrev} disabled={cards.length <= 1}>
                    <ChevronLeft className="w-4 h-4 mr-2 text-white" /> Previous
                </Button>
                <span className="text-sm font-medium text-muted-foreground">
                    {currentIndex + 1} / {cards.length}
                </span>
                <Button variant="outline" onClick={handleNext} disabled={cards.length <= 1}>
                    Next <ChevronRight className="w-4 h-4 ml-2 text-white" />
                </Button>
            </div>
        </div>
    );
}
