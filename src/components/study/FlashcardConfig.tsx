'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChoiceChipGroup } from '@/components/ui/choice-chip';
import { Loader2, Sparkles, BookOpen, MessageSquare, Wrench, FileText, List, X, Layers, Tag, Database, Shuffle, GalleryHorizontal } from 'lucide-react';
import { useGlobalLoader } from '@/contexts/LoaderContext';
import PricingModal from '@/components/PricingModal';
import { useErrorModal } from '@/components/ErrorModal';

interface FlashcardConfigProps {
    deckId: string;
    isOpen: boolean;
    onClose: () => void;
    onGenerated: () => void;
    isSubscriber?: boolean;
}

export default function FlashcardConfig({ deckId, isOpen, onClose, onGenerated, isSubscriber = false }: FlashcardConfigProps) {
    const [focus, setFocus] = useState('mix');
    const [format, setFormat] = useState('classic');
    const [detail, setDetail] = useState('standard');
    const [count, setCount] = useState('10');
    const [customCount, setCustomCount] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [showPricing, setShowPricing] = useState(false);
    const { startLoading, stopLoading } = useGlobalLoader();
    const { showError } = useErrorModal();

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
            } else if (response.status === 429) {
                const data = await response.json().catch(() => ({}));
                showError(
                    'Daily limit reached',
                    data.details || 'You have reached your daily limit. Please try again tomorrow.',
                    'limit'
                );
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
        { value: 'terms', label: 'Terms', icon: <Tag className="w-4 h-4" /> },
        { value: 'concepts', label: 'Concepts', icon: <Sparkles className="w-4 h-4" /> },
        { value: 'data', label: 'Data', icon: <Database className="w-4 h-4" /> },
        { value: 'mix', label: 'Mix', icon: <Shuffle className="w-4 h-4" /> },
    ];

    const formatOptions = [
        { value: 'classic', label: 'Classic', icon: <GalleryHorizontal className="w-4 h-4" /> },
        { value: 'qa', label: 'Q & A', icon: <MessageSquare className="w-4 h-4" /> },
        { value: 'practical', label: 'Practical', icon: <Wrench className="w-4 h-4" /> },
    ];

    const detailOptions = [
        { value: 'brief', label: 'Brief' },
        { value: 'standard', label: 'Standard' },
        { value: 'detailed', label: 'Detailed' },
    ];

    // All users see all options, but Custom requires subscription
    const countOptions = [
        { value: '10', label: '10' },
        { value: '15', label: '15' },
        { value: '20', label: '20' },
        { value: 'custom', label: 'Custom', disabled: !isSubscriber, requiresUpgrade: !isSubscriber },
    ];

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop with blur */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-100 bg-black/50 backdrop-blur-sm"
                            onClick={onClose}
                        />

                        {/* Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="fixed inset-0 z-100 flex items-center justify-center p-4 pointer-events-none"
                        >
                            <div className="w-full max-w-[90vw] sm:max-w-xl bg-card rounded-2xl shadow-2xl overflow-hidden pointer-events-auto max-h-[90vh] sm:max-h-none flex flex-col">
                                {/* Header */}
                                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border flex items-center justify-between shrink-0">
                                    <div className="flex items-center gap-2 sm:gap-3">
                                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-linear-to-br from-(--brand-primary) to-(--brand-secondary) flex items-center justify-center">
                                            <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-base sm:text-lg font-semibold text-foreground">Create Flashcards</h2>
                                            <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Configure your flashcard preferences</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Content - scrollable on mobile */}
                                <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
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
                                            onUpgradeRequired={() => setShowPricing(true)}
                                        />
                                        {count === 'custom' && (
                                            <div className="mt-2 flex justify-center">
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    max="50"
                                                    value={customCount}
                                                    onChange={(e) => setCustomCount(e.target.value)}
                                                    placeholder="Enter number (1-50)"
                                                    className="w-40 text-center bg-background border-border"
                                                    disabled={isGenerating}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-border bg-muted/50 shrink-0">
                                    <Button
                                        onClick={handleCreate}
                                        disabled={isGenerating || (count === 'custom' && (!customCount || parseInt(customCount) < 1))}
                                        className="w-full h-11 bg-linear-to-r from-(--brand-primary) to-blue-600 hover:from-(--brand-primary)/90 hover:to-blue-700 text-white font-medium rounded-xl shadow-lg shadow-(--brand-primary)/25 transition-all"
                                    >
                                        {isGenerating ? (
                                            <>
                                                <Loader2 className="w-5 h-5 mr-2 animate-spin text-white" />
                                                <span className="text-white">Generating...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Layers className="w-5 h-5 mr-2 text-white" />
                                                <span className="text-white">Generate Flashcards</span>
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
            <PricingModal isOpen={showPricing} onClose={() => setShowPricing(false)} />
        </>
    );
}
