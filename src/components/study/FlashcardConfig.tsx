'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChoiceChipGroup } from '@/components/ui/choice-chip';
import { Loader2, Sparkles, BookOpen, MessageSquare, Wrench, FileText, List, Hash } from 'lucide-react';
import { useGlobalLoader } from '@/contexts/LoaderContext';

interface FlashcardConfigProps {
    deckId: string;
    onGenerated: () => void;
}

export default function FlashcardConfig({ deckId, onGenerated }: FlashcardConfigProps) {
    const [focus, setFocus] = useState('mix');
    const [format, setFormat] = useState('classic');
    const [detail, setDetail] = useState('standard');
    const [count, setCount] = useState('10');
    const [customCount, setCustomCount] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const { startLoading, stopLoading } = useGlobalLoader();

    const handleCreate = async () => {
        setIsGenerating(true);
        startLoading('Creating your Flashcards...');
        const finalCount = count === 'custom' ? parseInt(customCount) || 10 : parseInt(count);

        try {
            const response = await fetch('/api/flashcards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deckId, focus, format, detail, count: finalCount }),
            });

            if (response.ok) {
                onGenerated();
            } else {
                const data = await response.json();
                console.error('Failed to generate flashcards:', data.error);
                alert('Failed to generate flashcards. Please try again.');
            }
        } catch (error) {
            console.error('Error generating flashcards:', error);
            alert('Failed to generate flashcards. Please try again.');
        } finally {
            setIsGenerating(false);
            stopLoading();
        }
    };

    const focusOptions = [
        { value: 'terms', label: 'Terms', icon: <BookOpen className="w-4 h-4" /> },
        { value: 'concepts', label: 'Concepts', icon: <Sparkles className="w-4 h-4" /> },
        { value: 'data', label: 'Data', icon: <FileText className="w-4 h-4" /> },
        { value: 'mix', label: 'Mix', icon: <List className="w-4 h-4" /> },
    ];

    const formatOptions = [
        { value: 'classic', label: 'Classic', icon: <BookOpen className="w-4 h-4" /> },
        { value: 'qa', label: 'Q & A', icon: <MessageSquare className="w-4 h-4" /> },
        { value: 'practical', label: 'Practical', icon: <Wrench className="w-4 h-4" /> },
    ];

    const detailOptions = [
        { value: 'brief', label: 'Brief' },
        { value: 'standard', label: 'Standard' },
        { value: 'detailed', label: 'Detailed' },
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
                    <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Sparkles className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Create Flashcards</h2>
                    <p className="text-slate-500 dark:text-slate-400">Configure your flashcard generation preferences</p>
                </div>

                <div className="space-y-8">
                    <div className="text-center">
                        <ChoiceChipGroup
                            label="Focus"
                            options={focusOptions}
                            value={focus}
                            onChange={setFocus}
                            disabled={isGenerating}
                            centered
                        />
                    </div>

                    <div className="text-center">
                        <ChoiceChipGroup
                            label="Format"
                            options={formatOptions}
                            value={format}
                            onChange={setFormat}
                            disabled={isGenerating}
                            centered
                        />
                    </div>

                    <div className="text-center">
                        <ChoiceChipGroup
                            label="Detail Level"
                            options={detailOptions}
                            value={detail}
                            onChange={setDetail}
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
                                <Sparkles className="w-5 h-5 mr-2" />
                                Generate Flashcards
                            </>
                        )}
                    </Button>
                    <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-4">
                        AI will analyze your notes and create interactive flashcards
                    </p>
                </div>
            </div>
        </div>
    );
}
