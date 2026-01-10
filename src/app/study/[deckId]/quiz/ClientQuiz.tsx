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

    const handleGenerated = (timerSetting: string, count: number) => {
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
        if (percentage >= 80) return 'text-green-600';
        if (percentage >= 60) return 'text-yellow-600';
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
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600 dark:text-emerald-400 mb-4" />
                <p className="text-slate-500 dark:text-slate-400">Loading quiz...</p>
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
                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <ClipboardCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">No Quiz Yet</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-4">Generate a quiz from your notes</p>
                    <Button onClick={() => setShowConfig(true)} className="bg-violet-600 hover:bg-violet-700 text-white">
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
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                                <ClipboardCheck className="w-5 h-5 text-white" strokeWidth={1.5} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Quiz</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {quizzes.length} questions • Test your knowledge
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <AnimatedDockButton>
                                <Button
                                    variant="outline"
                                    onClick={handleStartEdit}
                                    className="gap-2 border-slate-200 dark:border-slate-700 hover:border-indigo-500/50 hover:text-indigo-500 active:border-indigo-500 transition-colors"
                                >
                                    <Edit3 className="w-4 h-4" strokeWidth={1.5} /> Edit
                                </Button>
                            </AnimatedDockButton>
                            <AnimatedDockButton>
                                <Button
                                    onClick={handleStartPlay}
                                    className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-500/25 border border-transparent hover:border-violet-400 active:border-violet-300 transition-colors"
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
                                className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-slate-900 dark:text-slate-100">{quiz.question}</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                            {quiz.options.length} options
                                            {quiz.hint && <span className="ml-2 text-amber-500">💡 Has hint</span>}
                                        </p>
                                    </div>
                                    <span className="text-xs text-slate-400 ml-4">#{index + 1}</span>
                                </div>
                            </div>
                        ))}
                        {quizzes.length > 5 && (
                            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                                +{quizzes.length - 5} more questions
                            </p>
                        )}
                    </div>

                    <div className="flex justify-center">
                        <Button
                            variant="ghost"
                            onClick={handleRegenerate}
                            className="text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400"
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
                        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                            <Edit3 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Edit Quiz</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
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
                                className="border-slate-200 dark:border-slate-700 hover:border-indigo-500/50 hover:text-indigo-500 active:border-indigo-500 transition-colors"
                            >
                                <X className="w-4 h-4 mr-2" /> Cancel
                            </Button>
                        </AnimatedDockButton>
                        <AnimatedDockButton>
                            <Button
                                onClick={handleSaveEdit}
                                disabled={isSaving}
                                className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-transparent hover:border-emerald-400 active:border-emerald-300 transition-colors"
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
                                className="p-5 bg-slate-800 rounded-xl border border-white/10 space-y-4"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-slate-400">Question #{qIndex + 1}</span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteQuiz(qIndex)}
                                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>

                                {/* Question */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Question</label>
                                    <textarea
                                        value={quiz.question}
                                        onChange={(e) => handleUpdateQuiz(qIndex, 'question', e.target.value)}
                                        rows={2}
                                        className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 resize-none"
                                        placeholder="Enter question..."
                                    />
                                </div>

                                {/* Options */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Options</label>
                                    <div className="space-y-2">
                                        {quiz.options.map((option, oIndex) => (
                                            <div key={oIndex} className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={option}
                                                    onChange={(e) => handleUpdateOption(qIndex, oIndex, e.target.value)}
                                                    className="flex-1 px-4 py-2 rounded-lg bg-slate-900 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50"
                                                    placeholder={`Option ${oIndex + 1}`}
                                                />
                                                {quiz.options.length > 2 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleRemoveOption(qIndex, oIndex)}
                                                        className="text-slate-400 hover:text-red-400"
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
                                            className="text-slate-400 hover:text-violet-400"
                                        >
                                            <Plus className="w-4 h-4 mr-1" /> Add Option
                                        </Button>
                                    </div>
                                </div>

                                {/* Correct Answer (Embedded - Read Only) */}
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-sm font-medium text-slate-300">Correct Answer</label>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleRevealAnswer(qIndex)}
                                            className="text-slate-400 hover:text-violet-400"
                                        >
                                            {isRevealed ? (
                                                <><EyeOff className="w-4 h-4 mr-1" /> Hide</>
                                            ) : (
                                                <><Eye className="w-4 h-4 mr-1" /> Reveal</>
                                            )}
                                        </Button>
                                    </div>
                                    {isRevealed ? (
                                        <div className="px-4 py-3 rounded-lg bg-green-500/10 border-2 border-green-500/40 text-green-300 font-medium flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                                            <span>{quiz.answer || 'No answer set'}</span>
                                        </div>
                                    ) : (
                                        <div className="px-4 py-2 rounded-lg bg-slate-900 border border-white/10 text-slate-500 italic">
                                            Hidden - click Reveal to view
                                        </div>
                                    )}
                                </div>

                                {/* Hint */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">
                                        Hint <span className="text-slate-500">(Optional)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={quiz.hint || ''}
                                        onChange={(e) => handleUpdateQuiz(qIndex, 'hint', e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 placeholder-amber-400/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
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
                    className="w-full gap-2 border-dashed border-white/20 text-slate-400 hover:text-white hover:border-violet-500/50"
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
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 mb-6">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6">Quiz Review</h3>
                        <div className="space-y-4">
                            {results.map((result, index) => (
                                <div
                                    key={index}
                                    className={`p-4 rounded-xl border-2 ${result.isCorrect
                                        ? 'border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/30'
                                        : 'border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/30'
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        {result.isCorrect ? (
                                            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                                        ) : (
                                            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                                        )}
                                        <div className="flex-1">
                                            <p className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                                                Q{index + 1}: {result.question}
                                            </p>
                                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                                Correct answer: <span className="font-semibold text-green-700 dark:text-green-400">{result.correctAnswer}</span>
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
                        <Button onClick={handleRestart} className="bg-emerald-600 hover:bg-emerald-700 text-white">
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
                <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-lg mx-auto">
                    {timeExpired ? (
                        <>
                            <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                                <AlertTriangle className="w-10 h-10 text-amber-600 dark:text-amber-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Time's Up!</h3>
                            <p className="text-slate-500 dark:text-slate-400 mb-6">You answered {results.length} of {quizzes.length} questions</p>
                        </>
                    ) : (
                        <>
                            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Trophy className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Quiz Completed!</h3>
                        </>
                    )}

                    <div className="mb-6">
                        <div className={`text-5xl font-bold ${getScoreColor()} mb-2`}>
                            {score}/{quizzes.length}
                        </div>
                        <p className="text-lg text-slate-600 dark:text-slate-300">
                            {Math.round((score / quizzes.length) * 100)}% correct
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 mt-2">{getScoreMessage()}</p>
                    </div>

                    <div className="flex flex-col gap-3 px-8">
                        <Button onClick={() => setShowReview(true)} variant="outline" className="w-full">
                            Review Answers
                        </Button>
                        <Button onClick={handleRestart} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                            <RotateCcw className="w-4 h-4 mr-2" /> Restart Quiz
                        </Button>
                        <Button variant="ghost" onClick={handleBackToView} className="w-full text-slate-500">
                            <List className="w-4 h-4 mr-2" /> View All Questions
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={handleRegenerate}
                            className="w-full text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400"
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
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                        <ClipboardCheck className="w-5 h-5 text-white" strokeWidth={1.5} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Quiz</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Test your knowledge
                        </p>
                    </div>
                </div>
                <AnimatedDockButton>
                    <Button
                        variant="outline"
                        onClick={handleBackToView}
                        className="gap-2 border-slate-200 dark:border-slate-700 hover:border-indigo-500/50 hover:text-indigo-500 active:border-indigo-500 transition-colors"
                    >
                        <List className="w-4 h-4" /> View All
                    </Button>
                </AnimatedDockButton>
            </div>

            {/* Timer Display */}
            {timer !== 'none' && timerActive && (
                <div className="mb-6 flex justify-center">
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-mono text-lg font-bold ${timeRemaining <= 60
                        ? 'bg-red-100 text-red-700 animate-pulse'
                        : 'bg-slate-100 text-slate-700'
                        }`}>
                        <Clock className="w-5 h-5" />
                        {formatTime(timeRemaining)}
                    </div>
                </div>
            )}

            <div className="mb-4 flex justify-between items-center text-sm text-slate-500 dark:text-slate-400">
                <span className="font-medium text-slate-900 dark:text-slate-200">Question {currentIndex + 1}</span>
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
