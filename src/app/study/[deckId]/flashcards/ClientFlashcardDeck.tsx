'use client';

import { useState, useEffect } from 'react';
import Flashcard from '@/components/study/Flashcard';
import FlashcardConfig from '@/components/study/FlashcardConfig';
import { Button } from '@/components/ui/button';
import {
    ChevronLeft, ChevronRight, Loader2, RefreshCw, CreditCard,
    Edit3, PlayCircle, Save, X, Plus, Trash2, List
} from 'lucide-react';
import { saveAllFlashcards } from '../actions';
import { toast } from 'sonner';
import { AnimatedDockButton } from '@/components/ui/animated-dock-button';

interface Card {
    id: string;
    front: string;
    back: string;
    isNew?: boolean;
    isDeleted?: boolean;
}

type ViewMode = 'VIEW' | 'EDIT' | 'PLAY';

export default function ClientFlashcardDeck({
    deckId,
    initialCards
}: {
    deckId: string;
    initialCards: Card[];
}) {
    const [cards, setCards] = useState<Card[]>(initialCards);
    const [editingCards, setEditingCards] = useState<Card[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showConfig, setShowConfig] = useState(initialCards.length === 0);
    const [viewMode, setViewMode] = useState<ViewMode>('VIEW');

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % cards.length);
    };

    const handlePrev = () => {
        setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
    };

    const fetchCards = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/flashcards?deckId=${deckId}`);
            const data = await res.json();
            if (data.cards && data.cards.length > 0) {
                setCards(data.cards);
                setCurrentIndex(0);
                setShowConfig(false);
            }
        } catch (error) {
            console.error('Failed to fetch cards:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerated = () => {
        fetchCards();
    };

    const handleRegenerate = () => {
        setShowConfig(true);
    };

    // ============ MODE HANDLERS ============

    const handleStartEdit = () => {
        setEditingCards(cards.map(c => ({ ...c })));
        setViewMode('EDIT');
    };

    const handleStartPlay = () => {
        setViewMode('PLAY');
        setCurrentIndex(0);
    };

    const handleBackToView = () => {
        setViewMode('VIEW');
        setEditingCards([]);
    };

    const handleCancelEdit = () => {
        setEditingCards([]);
        setViewMode('VIEW');
    };

    const handleSaveEdit = async () => {
        setIsSaving(true);
        try {
            const result = await saveAllFlashcards(deckId, editingCards);
            if (result.success) {
                await fetchCards();
                setViewMode('VIEW');
                setEditingCards([]);
                toast.success('Flashcards saved successfully!');
            } else {
                toast.error('Failed to save flashcards');
            }
        } catch (error) {
            console.error('Failed to save:', error);
            toast.error('Failed to save flashcards');
        } finally {
            setIsSaving(false);
        }
    };

    // ============ EDIT MODE HANDLERS ============

    const handleUpdateCard = (index: number, field: 'front' | 'back', value: string) => {
        setEditingCards(prev => prev.map((card, i) =>
            i === index ? { ...card, [field]: value } : card
        ));
    };

    const handleAddCard = () => {
        setEditingCards(prev => [
            ...prev,
            { id: `new-${Date.now()}`, front: '', back: '', isNew: true }
        ]);
    };

    const handleDeleteCard = (index: number) => {
        setEditingCards(prev => prev.map((card, i) =>
            i === index ? { ...card, isDeleted: true } : card
        ));
    };

    // ============ RENDER ============

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400 mb-4" />
                <p className="text-slate-500 dark:text-slate-400">Loading flashcards...</p>
            </div>
        );
    }

    // Config modal (overlay on existing content)
    const configModal = (
        <FlashcardConfig
            deckId={deckId}
            isOpen={showConfig}
            onClose={() => setShowConfig(false)}
            onGenerated={handleGenerated}
        />
    );

    if (cards.length === 0) {
        return (
            <>
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <CreditCard className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">No Flashcards Yet</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-4">Generate flashcards from your notes</p>
                    <Button onClick={() => setShowConfig(true)} className="bg-violet-600 hover:bg-violet-700 text-white">
                        <CreditCard className="w-4 h-4 mr-2" /> Create Flashcards
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
                <div className="space-y-4">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center shrink-0">
                                <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">Flashcards</h2>
                                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                                    {cards.length} cards • Review and memorize
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <AnimatedDockButton>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleStartEdit}
                                    className="gap-1.5 text-xs sm:text-sm border-slate-200 dark:border-slate-700 hover:border-indigo-500/50 hover:text-indigo-500 active:border-indigo-500 transition-colors"
                                >
                                    <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Edit
                                </Button>
                            </AnimatedDockButton>
                            <AnimatedDockButton>
                                <Button
                                    size="sm"
                                    onClick={handleStartPlay}
                                    className="gap-1.5 text-xs sm:text-sm bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-500/25 border border-transparent hover:border-violet-400 active:border-violet-300 transition-colors"
                                >
                                    <PlayCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Play
                                </Button>
                            </AnimatedDockButton>
                        </div>
                    </div>

                    {/* Card List Preview */}
                    <div className="space-y-2 sm:space-y-3">
                        {cards.slice(0, 5).map((card, index) => (
                            <div
                                key={card.id}
                                className="p-3 sm:p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700"
                            >
                                <div className="min-w-0">
                                    <p className="font-medium text-sm sm:text-base text-slate-900 dark:text-slate-100 line-clamp-2">{card.front}</p>
                                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 line-clamp-1 mt-1">{card.back}</p>
                                </div>
                            </div>
                        ))}
                        {cards.length > 5 && (
                            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                                +{cards.length - 5} more cards
                            </p>
                        )}
                    </div>

                    <div className="flex justify-center">
                        <Button
                            variant="ghost"
                            onClick={handleRegenerate}
                            className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
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
        const activeCards = editingCards.filter(c => !c.isDeleted);

        return (
            <div className="space-y-4">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shrink-0">
                            <Edit3 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">Edit Flashcards</h2>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                                {activeCards.length} cards
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <AnimatedDockButton>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCancelEdit}
                                disabled={isSaving}
                                className="gap-1.5 text-xs sm:text-sm border-slate-200 dark:border-slate-700 hover:border-indigo-500/50 hover:text-indigo-500 active:border-indigo-500 transition-colors"
                            >
                                <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Cancel
                            </Button>
                        </AnimatedDockButton>
                        <AnimatedDockButton>
                            <Button
                                size="sm"
                                onClick={handleSaveEdit}
                                disabled={isSaving}
                                className="gap-1.5 text-xs sm:text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-transparent hover:border-emerald-400 active:border-emerald-300 transition-colors"
                            >
                                {isSaving ? (
                                    <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                                ) : (
                                    <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                )}
                                Save
                            </Button>
                        </AnimatedDockButton>
                    </div>
                </div>

                {/* Editable Cards */}
                <div className="space-y-4">
                    {editingCards.map((card, index) => {
                        if (card.isDeleted) return null;
                        return (
                            <div
                                key={card.id}
                                className="p-4 bg-slate-800 rounded-xl border border-white/10 space-y-3"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-slate-400">Card #{index + 1}</span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteCard(index)}
                                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Front</label>
                                    <input
                                        type="text"
                                        value={card.front}
                                        onChange={(e) => handleUpdateCard(index, 'front', e.target.value)}
                                        className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50"
                                        placeholder="Question or term..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Back</label>
                                    <textarea
                                        value={card.back}
                                        onChange={(e) => handleUpdateCard(index, 'back', e.target.value)}
                                        rows={2}
                                        className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 resize-none"
                                        placeholder="Answer or definition..."
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Add Card Button */}
                <Button
                    variant="outline"
                    onClick={handleAddCard}
                    className="w-full gap-2 border-dashed border-white/20 text-slate-400 hover:text-white hover:border-violet-500/50"
                >
                    <Plus className="w-4 h-4" /> Add New Card
                </Button>
            </div>
        );
    }

    // ============ PLAY MODE ============
    return (
        <>
            {configModal}
            <div className="space-y-4">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center shrink-0">
                            <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">Flashcards</h2>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                                Review and memorize key concepts
                            </p>
                        </div>
                    </div>
                    <AnimatedDockButton>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleBackToView}
                            className="gap-1.5 text-xs sm:text-sm w-fit border-slate-200 dark:border-slate-700 hover:border-indigo-500/50 hover:text-indigo-500 active:border-indigo-500 transition-colors"
                        >
                            <List className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> View All
                        </Button>
                    </AnimatedDockButton>
                </div>

                <Flashcard
                    key={currentIndex}
                    frontContent={cards[currentIndex].front}
                    backContent={cards[currentIndex].back}
                />

                <div className="flex items-center justify-center gap-2 sm:gap-4">
                    <AnimatedDockButton>
                        <Button variant="outline" size="sm" onClick={handlePrev} disabled={cards.length <= 1} className="text-xs sm:text-sm border-slate-200 dark:border-slate-700 hover:border-indigo-500/50 hover:text-indigo-500 active:border-indigo-500 transition-colors">
                            <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Prev
                        </Button>
                    </AnimatedDockButton>
                    <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 min-w-[3rem] text-center">
                        {currentIndex + 1} / {cards.length}
                    </span>
                    <AnimatedDockButton>
                        <Button variant="outline" size="sm" onClick={handleNext} disabled={cards.length <= 1} className="text-xs sm:text-sm border-slate-200 dark:border-slate-700 hover:border-indigo-500/50 hover:text-indigo-500 active:border-indigo-500 transition-colors">
                            Next <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
                        </Button>
                    </AnimatedDockButton>
                </div>

                <div className="flex justify-center">
                    <Button
                        variant="ghost"
                        onClick={handleRegenerate}
                        className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Regenerate with different settings
                    </Button>
                </div>
            </div>
        </>
    );
}
