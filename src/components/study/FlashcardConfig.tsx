'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChoiceChipGroup } from '@/components/ui/choice-chip';
import { Loader2, Sparkles, BookOpen, MessageSquare, Wrench, FileText, List, X } from 'lucide-react';
import { useGlobalLoader } from '@/contexts/LoaderContext';

interface FlashcardConfigProps {
    deckId: string;
    isOpen: boolean;
    onClose: () => void;
    onGenerated: () => void;
}

export default function FlashcardConfig({ deckId, isOpen, onClose, onGenerated }: FlashcardConfigProps) {
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
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop with blur */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto">
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                                        <Sparkles className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Create Flashcards</h2>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Configure your flashcard preferences</p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-6">
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

                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                                <Button
                                    onClick={handleCreate}
                                    disabled={isGenerating || (count === 'custom' && (!customCount || parseInt(customCount) < 1))}
                                    className="w-full h-12 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-medium text-base rounded-xl shadow-lg shadow-violet-500/25 transition-all"
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
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
