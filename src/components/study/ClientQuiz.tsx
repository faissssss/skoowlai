'use client';

import { useState } from 'react';
import QuizCard from './QuizCard';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

export default function ClientQuiz({ quizzes }: { quizzes: any[] }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0); // Not really tracking score yet, just flow
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
        return <div className="text-center text-slate-500">No quiz questions available.</div>;
    }

    if (isFinished) {
        return (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
                <h3 className="text-2xl font-bold text-slate-900 mb-4">Quiz Completed!</h3>
                <p className="text-slate-500 mb-8">Great job reviewing the material.</p>
                <Button onClick={handleRestart} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    <RotateCcw className="w-4 h-4 mr-2" /> Restart Quiz
                </Button>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-4 flex justify-between text-sm text-slate-500">
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
