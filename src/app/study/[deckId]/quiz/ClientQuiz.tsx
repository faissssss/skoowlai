'use client';

import { useState, useEffect, useRef } from 'react';
import QuizCard from '@/components/study/QuizCard';
import QuizConfig from '@/components/study/QuizConfig';
import { Button } from '@/components/ui/button';
import {
    RotateCcw, Loader2, RefreshCw, Clock, AlertTriangle, Trophy,
    CheckCircle, XCircle, ClipboardCheck, Edit3, PlayCircle, Save,
    X, Plus, Trash2, List, Eye, EyeOff
} from 'lucide-react';
import { saveAllQuizzes } from '../actions';
import { toast } from 'sonner';
import { AnimatedDockButton } from '@/components/ui/animated-dock-button';

interface Quiz {
    id: string;
    question: string;
    options: string[];
    answer: string;
    hint?: string;
    type?: string;
    isNew?: boolean;
    isDeleted?: boolean;
}

interface QuizResult {
    question: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
}

type ViewMode = 'VIEW' | 'EDIT' | 'PLAY';

export default function ClientQuiz({
    deckId,
    initialQuizzes
}: {
    deckId: string;
    initialQuizzes: Quiz[];
}) {
    const [quizzes, setQuizzes] = useState<Quiz[]>(initialQuizzes);
    const [editingQuizzes, setEditingQuizzes] = useState<Quiz[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFinished, setIsFinished] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showConfig, setShowConfig] = useState(initialQuizzes.length === 0);
    const [viewMode, setViewMode] = useState<ViewMode>('VIEW');
    const [revealedAnswers, setRevealedAnswers] = useState<Set<number>>(new Set());

    // Score tracking
    const [score, setScore] = useState(0);
    const [results, setResults] = useState<QuizResult[]>([]);
    const [showReview, setShowReview] = useState(false);

    // Timer state
    const [timer, setTimer] = useState<string>('none');
    const [timeRemaining, setTimeRemaining] = useState<number>(0);
    const [timerActive, setTimerActive] = useState(false);
    const [timeExpired, setTimeExpired] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Timer effect
    useEffect(() => {
        if (timerActive && timeRemaining > 0) {
            timerRef.current = setInterval(() => {
                setTimeRemaining((prev) => {
                    if (prev <= 1) {
                        setTimerActive(false);
                        setTimeExpired(true);
                        setIsFinished(true);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timerActive]);

    useEffect(() => {
        if (isFinished && timerRef.current) {
            clearInterval(timerRef.current);
            setTimerActive(false);
        }
    }, [isFinished]);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleNext = (isCorrect: boolean) => {
        const currentQuiz = quizzes[currentIndex];
        setResults(prev => [...prev, {
            question: currentQuiz.question,
            userAnswer: '',
            correctAnswer: currentQuiz.answer,
            isCorrect
        }]);

        if (isCorrect) {
            setScore(prev => prev + 1);
        }

        if (currentIndex < quizzes.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            setIsFinished(true);
            setTimerActive(false);
        }
    };

    const handleRestart = () => {
        setCurrentIndex(0);
        setIsFinished(false);
        setScore(0);
        setResults([]);
        setShowReview(false);
        setTimeExpired(false);

        if (timer !== 'none') {
            setTimeRemaining(parseInt(timer) * 60);
            setTimerActive(true);
        }
    };

    const fetchQuizzes = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/quiz?deckId=${deckId}`);
            const data = await res.json();
            if (data.quizzes && data.quizzes.length > 0) {
                setQuizzes(data.quizzes);
                setCurrentIndex(0);
                setScore(0);
                setResults([]);
                setIsFinished(false);
                setShowReview(false);
                setTimeExpired(false);
                setShowConfig(false);
            }
        } catch (error) {
            console.error('Failed to fetch quizzes:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleGenerated = (timerSetting: string, _count: number) => {
        setTimer(timerSetting);
        setScore(0);
        setResults([]);
        setTimeExpired(false);
        if (timerSetting !== 'none') {
            setTimeRemaining(parseInt(timerSetting) * 60);
            setTimerActive(true);
        }
        fetchQuizzes();
    };

    const handleRegenerate = () => {
        setTimerActive(false);
        setShowConfig(true);
    };

    const getScoreColor = () => {
        const percentage = (score / quizzes.length) * 100;
        if (percentage >= 90) return 'text-yellow-500';
        if (percentage >= 70) return 'text-yellow-600';
        if (percentage >= 50) return 'text-orange-500';
        if (percentage >= 30) return 'text-orange-600';
        return 'text-red-600';
    };

    const getScoreMessage = () => {
        const percentage = (score / quizzes.length) * 100;
        if (percentage === 100) return 'Perfect! 🎉';
        if (percentage >= 80) return 'Great job! 🌟';
        if (percentage >= 60) return 'Good effort! 👍';
        if (percentage >= 40) return 'Keep practicing! 💪';
        return 'Review the material and try again! 📚';
    };

    // ============ MODE HANDLERS ============

    const handleStartEdit = () => {
        setEditingQuizzes(quizzes.map(q => ({ ...q })));
        setRevealedAnswers(new Set());
        setViewMode('EDIT');
    };

    const handleStartPlay = () => {
        // CRITICAL: Immediately close Edit mode when switching to Play
        setViewMode('PLAY');
        setCurrentIndex(0);
        setScore(0);
        setResults([]);
        setIsFinished(false);
        setShowReview(false);
        if (timer !== 'none') {
            setTimeRemaining(parseInt(timer) * 60);
            setTimerActive(true);
        }
    };

    const handleBackToView = () => {
        setViewMode('VIEW');
        setEditingQuizzes([]);
        setTimerActive(false);
    };

    const handleCancelEdit = () => {
        setEditingQuizzes([]);
        setViewMode('VIEW');
    };

    const handleSaveEdit = async () => {
        setIsSaving(true);
        try {
            const result = await saveAllQuizzes(deckId, editingQuizzes);
            if (result.success) {
                await fetchQuizzes();
                setViewMode('VIEW');
                setEditingQuizzes([]);
                toast.success('Quiz questions saved successfully!');
            } else {
                toast.error('Failed to save quiz questions');
            }
        } catch (error) {
            console.error('Failed to save:', error);
            toast.error('Failed to save quiz questions');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleRevealAnswer = (index: number) => {
        setRevealedAnswers(prev => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    // ============ EDIT MODE HANDLERS ============

    const handleUpdateQuiz = (index: number, field: keyof Quiz, value: string | string[]) => {
        setEditingQuizzes(prev => prev.map((quiz, i) =>
            i === index ? { ...quiz, [field]: value } : quiz
        ));
    };

    const handleUpdateOption = (quizIndex: number, optionIndex: number, value: string) => {
        setEditingQuizzes(prev => prev.map((quiz, i) => {
            if (i !== quizIndex) return quiz;
            const newOptions = [...quiz.options];
            newOptions[optionIndex] = value;
            return { ...quiz, options: newOptions };
        }));
    };

    const handleAddOption = (quizIndex: number) => {
        setEditingQuizzes(prev => prev.map((quiz, i) => {
            if (i !== quizIndex) return quiz;
            return { ...quiz, options: [...quiz.options, ''] };
        }));
    };

    const handleRemoveOption = (quizIndex: number, optionIndex: number) => {
        setEditingQuizzes(prev => prev.map((quiz, i) => {
            if (i !== quizIndex) return quiz;
            const newOptions = quiz.options.filter((_, oi) => oi !== optionIndex);
            return { ...quiz, options: newOptions };
        }));
    };

    const handleAddQuiz = () => {
        setEditingQuizzes(prev => [
            ...prev,
            {
                id: `new-${Date.now()}`,
                question: '',
                options: ['', '', '', ''],
                answer: '',
                hint: '',
                isNew: true
            }
        ]);
    };

    const handleDeleteQuiz = (index: number) => {
        setEditingQuizzes(prev => prev.map((quiz, i) =>
            i === index ? { ...quiz, isDeleted: true } : quiz
        ));
    };

    // ============ RENDER ============

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-emerald mb-4" />
                <p className="text-muted-foreground">Loading quiz...</p>
            </div>
        );
    }

    // Config modal (overlay on existing content)
    const configModal = (
        <QuizConfig
            deckId={deckId}
            isOpen={showConfig}
            onClose={() => setShowConfig(false)}
            onGenerated={handleGenerated}
        />
    );

    if (quizzes.length === 0) {
        return (
            <>
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-16 h-16 bg-yellow-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <ClipboardCheck className="w-8 h-8 text-yellow-500" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground mb-2">No Quiz Yet</h2>
                    <p className="text-muted-foreground mb-4">Generate a quiz from your notes</p>
                    <Button onClick={() => setShowConfig(true)} className="bg-purple-600 hover:bg-purple-700 text-white">
                        <ClipboardCheck className="w-4 h-4 mr-2" /> Create Quiz
                    </Button>
                </div>
                {configModal}
            </>
        );
    }

    // ============ VIEW MODE ============
    if (viewMode === 'VIEW') {
        return (
            <>
                {configModal}
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-linear-to-br from-yellow-500 to-amber-500 rounded-xl flex items-center justify-center">
                                <ClipboardCheck className="w-5 h-5 text-white" strokeWidth={1.5} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-foreground">Quiz</h2>
                                <p className="text-sm text-muted-foreground">
                                    {quizzes.length} questions • Test your knowledge
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <AnimatedDockButton>
                                <Button
                                    variant="outline"
                                    onClick={handleStartEdit}
                                    className="gap-2 border-border hover:border-primary/50 hover:text-primary active:border-primary transition-colors"
                                >
                                    <Edit3 className="w-4 h-4" strokeWidth={1.5} /> Edit
                                </Button>
                            </AnimatedDockButton>
                            <AnimatedDockButton>
                                <Button
                                    onClick={handleStartPlay}
                                    className="gap-2 bg-linear-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white shadow-lg shadow-purple-600/25 border border-transparent hover:border-purple-500 transition-colors"
                                >
                                    <PlayCircle className="w-4 h-4" strokeWidth={1.5} /> Play
                                </Button>
                            </AnimatedDockButton>
                        </div>
                    </div>

                    {/* Question List Preview */}
                    <div className="space-y-3">
                        {quizzes.slice(0, 5).map((quiz, index) => (
                            <div
                                key={quiz.id}
                                className="p-4 bg-card rounded-xl border border-border"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-foreground">{quiz.question}</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {quiz.options.length} options
                                            {quiz.hint && <span className="ml-2 text-amber">💡 Has hint</span>}
                                        </p>
                                    </div>
                                    <span className="text-xs text-muted-foreground ml-4">#{index + 1}</span>
                                </div>
                            </div>
                        ))}
                        {quizzes.length > 5 && (
                            <p className="text-center text-sm text-muted-foreground">
                                +{quizzes.length - 5} more questions
                            </p>
                        )}
                    </div>

                    <div className="flex justify-center">
                        <Button
                            variant="ghost"
                            onClick={handleRegenerate}
                            className="text-muted-foreground hover:text-emerald transition-colors"
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Regenerate with different settings
                        </Button>
                    </div>
                </div>
            </>
        );
    }

    // ============ EDIT MODE ============
    if (viewMode === 'EDIT') {
        const activeQuizzes = editingQuizzes.filter(q => !q.isDeleted);

        return (
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-linear-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                            <Edit3 className="w-5 h-5 text-primary-foreground" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-foreground">Edit Quiz</h2>
                            <p className="text-sm text-muted-foreground">
                                {activeQuizzes.length} questions
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <AnimatedDockButton>
                            <Button
                                variant="outline"
                                onClick={handleCancelEdit}
                                disabled={isSaving}
                                className="border-border hover:border-primary/50 hover:text-primary active:border-primary transition-colors"
                            >
                                <X className="w-4 h-4 mr-2" /> Cancel
                            </Button>
                        </AnimatedDockButton>
                        <AnimatedDockButton>
                            <Button
                                onClick={handleSaveEdit}
                                disabled={isSaving}
                                className="gap-2 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-primary-foreground border border-transparent hover:border-emerald/50 active:border-emerald/30 transition-colors"
                            >
                                {isSaving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                Save
                            </Button>
                        </AnimatedDockButton>
                    </div>
                </div>

                {/* Editable Quizzes */}
                <div className="space-y-6">
                    {editingQuizzes.map((quiz, qIndex) => {
                        if (quiz.isDeleted) return null;
                        const isRevealed = revealedAnswers.has(qIndex);

                        return (
                            <div
                                key={quiz.id}
                                className="p-5 bg-card rounded-xl border border-border space-y-4"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-muted-foreground">Question #{qIndex + 1}</span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteQuiz(qIndex)}
                                        className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>

                                {/* Question */}
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Question</label>
                                    <textarea
                                        value={quiz.question}
                                        onChange={(e) => handleUpdateQuiz(qIndex, 'question', e.target.value)}
                                        rows={2}
                                        className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 resize-none"
                                        placeholder="Enter question..."
                                    />
                                </div>

                                {/* Options */}
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-2">Options</label>
                                    <div className="space-y-2">
                                        {quiz.options.map((option, oIndex) => (
                                            <div key={oIndex} className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={option}
                                                    onChange={(e) => handleUpdateOption(qIndex, oIndex, e.target.value)}
                                                    className="flex-1 px-4 py-2 rounded-lg bg-muted border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                                                    placeholder={`Option ${oIndex + 1}`}
                                                />
                                                {quiz.options.length > 2 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleRemoveOption(qIndex, oIndex)}
                                                        className="text-muted-foreground hover:text-destructive"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleAddOption(qIndex)}
                                            className="text-muted-foreground hover:text-primary"
                                        >
                                            <Plus className="w-4 h-4 mr-1" /> Add Option
                                        </Button>
                                    </div>
                                </div>

                                {/* Correct Answer (Embedded - Read Only) */}
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-sm font-medium text-foreground">Correct Answer</label>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleRevealAnswer(qIndex)}
                                            className="text-muted-foreground hover:text-primary"
                                        >
                                            {isRevealed ? (
                                                <><EyeOff className="w-4 h-4 mr-1" /> Hide</>
                                            ) : (
                                                <><Eye className="w-4 h-4 mr-1" /> Reveal</>
                                            )}
                                        </Button>
                                    </div>
                                    {isRevealed ? (
                                        <div className="px-4 py-3 rounded-lg bg-emerald/10 border-2 border-emerald/40 text-emerald font-medium flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4 text-emerald shrink-0" />
                                            <span>{quiz.answer || 'No answer set'}</span>
                                        </div>
                                    ) : (
                                        <div className="px-4 py-2 rounded-lg bg-muted border border-border text-muted-foreground italic">
                                            Hidden - click Reveal to view
                                        </div>
                                    )}
                                </div>

                                {/* Hint */}
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">
                                        Hint <span className="text-muted-foreground">(Optional)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={quiz.hint || ''}
                                        onChange={(e) => handleUpdateQuiz(qIndex, 'hint', e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg bg-amber/10 border border-amber/30 text-amber placeholder-amber/50 focus:outline-none focus:ring-2 focus:ring-amber/50 focus:border-amber/50"
                                        placeholder="💡 Think about the laws of thermodynamics..."
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Add Question Button */}
                <Button
                    variant="outline"
                    onClick={handleAddQuiz}
                    className="w-full gap-2 border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
                >
                    <Plus className="w-4 h-4" /> Add New Question
                </Button>
            </div>
        );
    }

    // ============ PLAY MODE ============
    // Finished state
    if (isFinished) {
        if (showReview) {
            return (
                <div className="max-w-2xl mx-auto">
                    <div className="bg-card rounded-2xl border border-border p-8 mb-6">
                        <h3 className="text-xl font-bold text-foreground mb-6">Quiz Review</h3>
                        <div className="space-y-4">
                            {results.map((result, index) => (
                                <div
                                    key={index}
                                    className={`p-4 rounded-xl border-2 ${result.isCorrect
                                        ? 'border-yellow-500/30 bg-yellow-500/10'
                                        : 'border-red-500/30 bg-red-500/10'
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        {result.isCorrect ? (
                                            <CheckCircle className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
                                        ) : (
                                            <XCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                                        )}
                                        <div className="flex-1">
                                            <p className="font-medium text-foreground mb-1">
                                                Q{index + 1}: {result.question}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                Correct answer: <span className="font-semibold text-yellow-500">{result.correctAnswer}</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-center gap-4">
                        <Button onClick={() => setShowReview(false)} variant="outline">
                            Back to Results
                        </Button>
                        <Button onClick={handleRestart} className="bg-purple-600 hover:bg-purple-700 text-white">
                            <RotateCcw className="w-4 h-4 mr-2" /> Try Again
                        </Button>
                        <Button onClick={handleBackToView} variant="outline">
                            <List className="w-4 h-4 mr-2" /> View All
                        </Button>
                    </div>
                </div>
            );
        }

        return (
            <>
                {configModal}
                <div className="text-center py-12 bg-card rounded-2xl border border-border max-w-lg mx-auto">
                    {timeExpired ? (
                        <>
                            <div className="w-20 h-20 bg-amber/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                <AlertTriangle className="w-10 h-10 text-amber" />
                            </div>
                            <h3 className="text-2xl font-bold text-foreground mb-2">Time&apos;s Up!</h3>
                            <p className="text-muted-foreground mb-6">You answered {results.length} of {quizzes.length} questions</p>
                        </>
                    ) : (
                        <>
                            <div className="w-20 h-20 bg-emerald/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Trophy className="w-10 h-10 text-emerald" />
                            </div>
                            <h3 className="text-2xl font-bold text-foreground mb-2">Quiz Completed!</h3>
                        </>
                    )}

                    <div className="mb-6">
                        <div className={`text-5xl font-bold ${getScoreColor()} mb-2`}>
                            {score}/{quizzes.length}
                        </div>
                        <p className="text-lg text-muted-foreground">
                            {Math.round((score / quizzes.length) * 100)}% correct
                        </p>
                        <p className="text-muted-foreground mt-2">{getScoreMessage()}</p>
                    </div>

                    <div className="flex flex-col gap-3 px-8">
                        <Button onClick={() => setShowReview(true)} variant="outline" className="w-full">
                            Review Answers
                        </Button>
                        <Button onClick={handleRestart} variant="outline" className="w-full border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-white">
                            <RotateCcw className="w-4 h-4 mr-2" /> Restart Quiz
                        </Button>
                        <Button variant="outline" onClick={handleBackToView} className="w-full">
                            <List className="w-4 h-4 mr-2" /> View All Questions
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={handleRegenerate}
                            className="w-full text-muted-foreground hover:text-emerald"
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Regenerate with different settings
                        </Button>
                    </div>
                </div>
            </>
        );
    }

    // Active Quiz
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-linear-to-br from-yellow-500 to-amber-500 rounded-xl flex items-center justify-center">
                        <ClipboardCheck className="w-5 h-5 text-white" strokeWidth={1.5} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground">Quiz</h2>
                        <p className="text-sm text-muted-foreground">
                            Test your knowledge
                        </p>
                    </div>
                </div>
                <AnimatedDockButton>
                    <Button
                        variant="outline"
                        onClick={handleBackToView}
                        className="gap-2 border-border hover:border-primary/50 hover:text-primary active:border-primary transition-colors"
                    >
                        <List className="w-4 h-4" /> View All
                    </Button>
                </AnimatedDockButton>
            </div>

            {/* Timer Display */}
            {timer !== 'none' && timerActive && (
                <div className="mb-6 flex justify-center">
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-mono text-lg font-bold ${timeRemaining <= 60
                        ? 'bg-destructive/20 text-destructive animate-pulse'
                        : 'bg-muted text-foreground'
                        }`}>
                        <Clock className="w-5 h-5" />
                        {formatTime(timeRemaining)}
                    </div>
                </div>
            )}

            <div className="mb-4 flex justify-between items-center text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Question {currentIndex + 1}</span>
                <span>Score: {score}/{currentIndex}</span>
            </div>

            <QuizCard
                key={currentIndex}
                question={quizzes[currentIndex].question}
                options={quizzes[currentIndex].options}
                answer={quizzes[currentIndex].answer}
                hint={quizzes[currentIndex].hint}
                questionType={quizzes[currentIndex].type}
                onNext={handleNext}
                currentIndex={currentIndex}
                totalCount={quizzes.length}
            />


        </div>
    );
}
