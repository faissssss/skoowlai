'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle, XCircle, Lightbulb } from 'lucide-react';

interface QuizCardProps {
    question: string;
    options: string[];
    answer: string;
    hint?: string;
    questionType?: string;
    onNext?: (isCorrect: boolean) => void;
    currentIndex?: number;
    totalCount?: number;
}

export default function QuizCard({ question, options, answer, hint, questionType, onNext, currentIndex, totalCount }: QuizCardProps) {
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [fillInAnswer, setFillInAnswer] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [showHint, setShowHint] = useState(false);

    // Detect if it's a fill-in question (no options or empty options array)
    const isFillIn = !options || options.length === 0 || questionType === 'fill-in';

    const handleSelect = (option: string) => {
        if (isSubmitted) return;
        setSelectedOption(option);
    };

    const handleSubmit = () => {
        if (isFillIn) {
            if (!fillInAnswer.trim()) return;
        } else {
            if (!selectedOption) return;
        }
        setIsSubmitted(true);
    };

    const handleNext = () => {
        const isCorrect = isFillIn
            ? fillInAnswer.trim().toLowerCase() === answer.toLowerCase()
            : selectedOption === answer;
        onNext?.(isCorrect);
    };

    const isCorrect = isFillIn
        ? fillInAnswer.trim().toLowerCase() === answer.toLowerCase()
        : selectedOption === answer;

    // Hint component - toggleable like a card
    const HintSection = () => {
        if (!hint) return null;

        return (
            <div className="mt-4">
                {!showHint ? (
                    <Button
                        variant="ghost"
                        onClick={() => setShowHint(true)}
                        className="text-amber-500 hover:text-amber-400 hover:bg-amber-500/10"
                    >
                        <Lightbulb className="w-4 h-4 mr-2" strokeWidth={1.5} />
                        Need a Hint?
                    </Button>
                ) : (
                    <div
                        onClick={() => setShowHint(false)}
                        className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/50 backdrop-blur-sm cursor-pointer hover:bg-yellow-500/15 transition-colors"
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                                <Lightbulb className="w-4 h-4 text-yellow-400" strokeWidth={1.5} />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-yellow-300 mb-1">Hint</p>
                                    <span className="text-xs text-yellow-400/60">Click to close</span>
                                </div>
                                <p className="text-yellow-200">{hint}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    if (isFillIn) {
        return (
            <div className="w-full max-w-2xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 relative overflow-hidden">
                {/* Progress Bar */}
                {totalCount && totalCount > 0 && typeof currentIndex === 'number' && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-700">
                        <div
                            className="h-full bg-indigo-500 transition-all duration-500 ease-out"
                            style={{ width: `${((currentIndex + 1) / totalCount) * 100}%` }}
                        />
                    </div>
                )}
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6">{question}</h3>

                <div className="space-y-4">
                    <Input
                        value={fillInAnswer}
                        onChange={(e) => setFillInAnswer(e.target.value)}
                        placeholder="Type your answer here..."
                        className="w-full text-lg py-6 dark:bg-slate-900 dark:border-slate-600"
                        disabled={isSubmitted}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !isSubmitted) {
                                handleSubmit();
                            }
                        }}
                    />

                    {isSubmitted && (
                        <div className={cn(
                            "p-4 rounded-xl flex items-center gap-3",
                            isCorrect
                                ? "bg-green-50 dark:bg-green-900/30 border-2 border-green-500"
                                : "bg-red-50 dark:bg-red-900/30 border-2 border-red-500"
                        )}>
                            {isCorrect ? (
                                <>
                                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" strokeWidth={1.5} />
                                    <span className="text-green-700 dark:text-green-300 font-medium">Correct!</span>
                                </>
                            ) : (
                                <>
                                    <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" strokeWidth={1.5} />
                                    <div>
                                        <span className="text-red-700 dark:text-red-300 font-medium">Incorrect. </span>
                                        <span className="text-slate-600 dark:text-slate-400">The correct answer is: </span>
                                        <span className="font-bold text-slate-900 dark:text-slate-100">{answer}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Hint Section */}
                    {!isSubmitted && <HintSection />}
                </div>

                <div className="mt-8 flex justify-end">
                    {!isSubmitted ? (
                        <Button
                            onClick={handleSubmit}
                            disabled={!fillInAnswer.trim()}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            Check Answer
                        </Button>
                    ) : (
                        <Button onClick={handleNext} variant="outline" className="border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30">
                            Next Question
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    // Multiple choice / True-False question UI
    return (
        <div className="w-full max-w-2xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 relative overflow-hidden">
            {/* Progress Bar */}
            {totalCount && totalCount > 0 && typeof currentIndex === 'number' && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-700">
                    <div
                        className="h-full bg-indigo-500 transition-all duration-500 ease-out"
                        style={{ width: `${((currentIndex + 1) / totalCount) * 100}%` }}
                    />
                </div>
            )}
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6">{question}</h3>

            <div className="space-y-3">
                {options.map((option, index) => {
                    let optionStyle = "border-slate-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100";

                    if (isSubmitted) {
                        if (option === answer) {
                            optionStyle = "border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300";
                        } else if (option === selectedOption && option !== answer) {
                            optionStyle = "border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300";
                        } else {
                            optionStyle = "border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500";
                        }
                    } else if (selectedOption === option) {
                        optionStyle = "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-600";
                    }

                    return (
                        <div
                            key={index}
                            onClick={() => handleSelect(option)}
                            className={cn(
                                "p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 flex items-center justify-between",
                                optionStyle
                            )}
                        >
                            <span className="font-medium">{option}</span>
                            {isSubmitted && option === answer && <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" strokeWidth={1.5} />}
                            {isSubmitted && option === selectedOption && option !== answer && <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" strokeWidth={1.5} />}
                        </div>
                    );
                })}
            </div>

            {/* Hint Section */}
            {!isSubmitted && <HintSection />}

            <div className="mt-8 flex justify-end">
                {!isSubmitted ? (
                    <Button
                        onClick={handleSubmit}
                        disabled={!selectedOption}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        Check Answer
                    </Button>
                ) : (
                    <Button onClick={handleNext} variant="outline" className="border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30">
                        Next Question
                    </Button>
                )}
            </div>
        </div>
    );
}
