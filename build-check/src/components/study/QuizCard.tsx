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

// Hint component - toggleable like a card
const HintSection = ({ hint, showHint, setShowHint }: { hint?: string; showHint: boolean; setShowHint: (show: boolean) => void }) => {
    if (!hint) return null;

    return (
        <div className="mt-4">
            {!showHint ? (
                <Button
                    variant="ghost"
                    onClick={() => setShowHint(true)}
                    className="text-yellow-500 hover:text-yellow-500/80 hover:bg-yellow-500/10"
                >
                    <Lightbulb className="w-4 h-4 mr-2" />
                    Show Hint
                </Button>
            ) : (
                <div
                    className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/50 backdrop-blur-sm cursor-pointer hover:bg-yellow-500/15 transition-colors"
                    onClick={() => setShowHint(false)}
                >
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center shrink-0">
                            <Lightbulb className="w-4 h-4 text-yellow-500" strokeWidth={1.5} />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-yellow-500 mb-1">Hint</p>
                                <span className="text-xs text-yellow-500/60">Click to close</span>
                            </div>
                            <p className="text-yellow-500/70">{hint}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

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

    if (isFillIn) {
        return (
            <div className="w-full max-w-2xl mx-auto bg-card rounded-2xl shadow-sm border border-border p-8 relative overflow-hidden">
                {/* Progress Bar */}
                {totalCount && totalCount > 0 && typeof currentIndex === 'number' && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
                        <div
                            className="h-full bg-primary transition-all duration-500 ease-out"
                            style={{ width: `${((currentIndex + 1) / totalCount) * 100}%` }}
                        />
                    </div>
                )}
                <h3 className="text-xl font-bold text-foreground mb-6">{question}</h3>

                <div className="space-y-4">
                    <Input
                        value={fillInAnswer}
                        onChange={(e) => setFillInAnswer(e.target.value)}
                        placeholder="Type your answer here..."
                        className="w-full text-lg py-6 bg-background border-border"
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
                                ? "bg-yellow-500/10 dark:bg-yellow-500/20 border-2 border-yellow-500"
                                : "bg-red-500/10 dark:bg-red-500/20 border-2 border-red-500"
                        )}>
                            {isCorrect ? (
                                <>
                                    <CheckCircle className="w-6 h-6 text-yellow-500" strokeWidth={1.5} />
                                    <span className="text-yellow-500 font-medium">Correct!</span>
                                </>
                            ) : (
                                <>
                                    <XCircle className="w-6 h-6 text-red-500" strokeWidth={1.5} />
                                    <div>
                                        <span className="text-red-500 font-medium">Incorrect. </span>
                                        <span className="text-muted-foreground">The correct answer is: </span>
                                        <span className="font-bold text-foreground">{answer}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Hint Section */}
                    {!isSubmitted && <HintSection hint={hint} showHint={showHint} setShowHint={setShowHint} />}
                </div>

                <div className="mt-8 flex justify-end">
                    {!isSubmitted ? (
                        <Button
                            onClick={handleSubmit}
                            disabled={!fillInAnswer.trim()}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            Check Answer
                        </Button>
                    ) : (
                        <Button onClick={handleNext} variant="outline" className="border-purple-600/20 text-purple-600 hover:bg-purple-600/10">
                            Next Question
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    // Multiple choice / True-False question UI
    return (
        <div className="w-full max-w-2xl mx-auto bg-card rounded-2xl shadow-sm border border-border p-8 relative overflow-hidden">
            {/* Progress Bar */}
            {totalCount && totalCount > 0 && typeof currentIndex === 'number' && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
                    <div
                        className="h-full bg-primary transition-all duration-500 ease-out"
                        style={{ width: `${((currentIndex + 1) / totalCount) * 100}%` }}
                    />
                </div>
            )}
            <h3 className="text-xl font-bold text-foreground mb-6">{question}</h3>

            <div className="space-y-3">
                {options.map((option, index) => {
                    let optionStyle = "border-border hover:border-primary/50 hover:bg-muted text-foreground";

                    if (isSubmitted) {
                        if (option === answer) {
                            optionStyle = "border-yellow-500 bg-yellow-500/10 dark:bg-yellow-500/20 text-yellow-500";
                        } else if (option === selectedOption && option !== answer) {
                            optionStyle = "border-red-500 bg-red-500/10 dark:bg-red-500/20 text-red-500";
                        } else {
                            optionStyle = "border-muted text-muted-foreground";
                        }
                    } else if (selectedOption === option) {
                        optionStyle = "border-primary bg-primary/10 text-primary ring-1 ring-primary";
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
                            {isSubmitted && option === answer && <CheckCircle className="w-5 h-5 text-yellow-500" strokeWidth={1.5} />}
                            {isSubmitted && option === selectedOption && option !== answer && <XCircle className="w-5 h-5 text-red-500" strokeWidth={1.5} />}
                        </div>
                    );
                })}
            </div>

            {/* Hint Section */}
            {!isSubmitted && <HintSection hint={hint} showHint={showHint} setShowHint={setShowHint} />}

            <div className="mt-8 flex justify-end">
                {!isSubmitted ? (
                    <Button
                        onClick={handleSubmit}
                        disabled={!selectedOption}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                        Check Answer
                    </Button>
                ) : (
                    <Button onClick={handleNext} variant="outline" className="border-purple-600/20 text-purple-600 hover:bg-purple-600/10">
                        Next Question
                    </Button>
                )}
            </div>
        </div>
    );
}
