'use client';

import { useState } from 'react';
import QuizCard from './QuizCard';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

interface Quiz {
    id: string;
    question: string;
    options: string[];
    answer: string;
    hint?: string;
    type?: string;
}

export default function ClientQuiz({ quizzes }: { quizzes: Quiz[] }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFinished, setIsFinished] = useState(false);

    const handleNext = () => {
        if (currentIndex < quizzes.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            setIsFinished(true);
        }
    };

    const handleRestart = () => {
        setCurrentIndex(0);
        setIsFinished(false);
    };

    if (quizzes.length === 0) {
        return <div className="text-center text-muted-foreground">No quiz questions available.</div>;
    }

    if (isFinished) {
        return (
            <div className="text-center py-20 bg-card rounded-2xl border border-border">
                <h3 className="text-2xl font-bold text-foreground mb-4">Quiz Completed!</h3>
                <p className="text-muted-foreground mb-8">Great job reviewing the material.</p>
                <Button onClick={handleRestart} className="bg-purple-600 hover:bg-purple-700 text-white">
                    <RotateCcw className="w-4 h-4 mr-2" /> Restart Quiz
                </Button>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-4 flex justify-between text-sm text-muted-foreground">
                <span>Question {currentIndex + 1} of {quizzes.length}</span>
            </div>
            <QuizCard
                key={currentIndex}
                question={quizzes[currentIndex].question}
                options={quizzes[currentIndex].options}
                answer={quizzes[currentIndex].answer}
                onNext={handleNext}
            />
        </div>
    );
}
