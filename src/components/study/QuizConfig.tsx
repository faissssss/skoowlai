'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChoiceChipGroup } from '@/components/ui/choice-chip';
import { Loader2, Brain, Clock, CheckCircle2, HelpCircle, Edit3, Shuffle } from 'lucide-react';
import { useGlobalLoader } from '@/contexts/LoaderContext';

interface QuizConfigProps {
    deckId: string;
    onGenerated: (timer: string, count: number) => void;
}

export default function QuizConfig({ deckId, onGenerated }: QuizConfigProps) {
    const [timer, setTimer] = useState('none');
    const [type, setType] = useState('multiple-choice');
    const [difficulty, setDifficulty] = useState('basic');
    const [count, setCount] = useState('10');
    const [customCount, setCustomCount] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const { startLoading, stopLoading } = useGlobalLoader();

    const handleCreate = async () => {
        setIsGenerating(true);
        startLoading('Constructing your Quiz...');
        const finalCount = count === 'custom' ? parseInt(customCount) || 10 : parseInt(count);

        try {
            const response = await fetch('/api/quiz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deckId, timer, type, difficulty, count: finalCount }),
            });

            if (response.ok) {
                onGenerated(timer, finalCount);
            } else {
                const data = await response.json();
                console.error('Failed to generate quiz:', data.error);
                alert('Failed to generate quiz. Please try again.');
            }
        } catch (error) {
            console.error('Error generating quiz:', error);
            alert('Failed to generate quiz. Please try again.');
        } finally {
            setIsGenerating(false);
            stopLoading();
        }
    };

    const timerOptions = [
        { value: 'none', label: 'None' },
        { value: '5', label: '5 min', icon: <Clock className="w-4 h-4" /> },
        { value: '10', label: '10 min', icon: <Clock className="w-4 h-4" /> },
        { value: '15', label: '15 min', icon: <Clock className="w-4 h-4" /> },
    ];

    const typeOptions = [
        { value: 'multiple-choice', label: 'Multiple Choice', icon: <CheckCircle2 className="w-4 h-4" /> },
        { value: 'true-false', label: 'True / False', icon: <HelpCircle className="w-4 h-4" /> },
        { value: 'fill-in', label: 'Fill-in', icon: <Edit3 className="w-4 h-4" /> },
        { value: 'mixed', label: 'Mixed', icon: <Shuffle className="w-4 h-4" /> },
    ];

    const difficultyOptions = [
        { value: 'basic', label: 'Basic' },
        { value: 'intermediate', label: 'Intermediate' },
        { value: 'advanced', label: 'Advanced' },
        { value: 'expert', label: 'Expert' },
    ];

    const countOptions = [
        { value: '10', label: '10' },
        { value: '15', label: '15' },
        { value: '20', label: '20' },
        { value: 'custom', label: 'Custom' },
    ];

    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Brain className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Create Quiz</h2>
                    <p className="text-slate-500 dark:text-slate-400">Configure your quiz generation preferences</p>
                </div>

                <div className="space-y-8">
                    <div className="text-center">
                        <ChoiceChipGroup
                            label="Timer"
                            options={timerOptions}
                            value={timer}
                            onChange={setTimer}
                            disabled={isGenerating}
                            centered
                        />
                    </div>

                    <div className="text-center">
                        <ChoiceChipGroup
                            label="Question Type"
                            options={typeOptions}
                            value={type}
                            onChange={setType}
                            disabled={isGenerating}
                            centered
                        />
                    </div>

                    <div className="text-center">
                        <ChoiceChipGroup
                            label="Difficulty"
                            options={difficultyOptions}
                            value={difficulty}
                            onChange={setDifficulty}
                            disabled={isGenerating}
                            centered
                        />
                    </div>

                    <div className="text-center">
                        <ChoiceChipGroup
                            label="Count"
                            options={countOptions}
                            value={count}
                            onChange={setCount}
                            disabled={isGenerating}
                            centered
                        />
                        {count === 'custom' && (
                            <div className="mt-3 flex justify-center">
                                <Input
                                    type="number"
                                    min="1"
                                    max="50"
                                    value={customCount}
                                    onChange={(e) => setCustomCount(e.target.value)}
                                    placeholder="Enter number (1-50)"
                                    className="w-48 text-center dark:bg-slate-900 dark:border-slate-600"
                                    disabled={isGenerating}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-10">
                    <Button
                        onClick={handleCreate}
                        disabled={isGenerating || (count === 'custom' && (!customCount || parseInt(customCount) < 1))}
                        className="w-full bg-violet-600 hover:bg-violet-700 text-white py-6 text-base font-semibold rounded-xl shadow-lg shadow-violet-500/20 hover:shadow-xl hover:shadow-violet-500/30 transition-all duration-300"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Brain className="w-5 h-5 mr-2" />
                                Generate Quiz
                            </>
                        )}
                    </Button>
                    <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-4">
                        AI will analyze your notes and create an interactive quiz
                    </p>
                </div>
            </div>
        </div>
    );
}
