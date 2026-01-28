'use client';

import { FolderOpen, X, FileText, Youtube, Mic } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MorphingCardStack, CardData } from '@/components/ui/morphing-card-stack';
import { useRouter } from 'next/navigation';
import DeckActionsMenu from '@/components/dashboard/DeckActionsMenu';

interface Deck {
    id: string;
    title: string;
    sourceType: string | null;
    createdAt: Date;
}

interface Workspace {
    id: string;
    name: string;
    description?: string | null;
    color: string;
    decks: Deck[];
    _count: {
        decks: number;
    };
}

interface WorkspaceDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    workspace: Workspace | null;
    workspaces: any[];
    onWorkspaceChange: () => void;
}

const getSourceInfo = (sourceType: string | null) => {
    switch (sourceType) {
        case 'youtube':
            return {
                icon: Youtube,
                label: 'YouTube',
                bgColor: 'bg-red-100 dark:bg-red-900/30',
                textColor: 'text-red-600 dark:text-red-400'
            };
        case 'audio':
            return {
                icon: Mic,
                label: 'Audio',
                bgColor: 'bg-purple-100 dark:bg-purple-900/30',
                textColor: 'text-purple-600 dark:text-purple-400'
            };
        default:
            return {
                icon: FileText,
                label: 'Document',
                bgColor: 'bg-blue-100 dark:bg-blue-900/30',
                textColor: 'text-blue-600 dark:text-blue-400'
            };
    }
};

export default function WorkspaceDetailModal({
    isOpen,
    onClose,
    workspace,
    workspaces,
    onWorkspaceChange
}: WorkspaceDetailModalProps) {
    const router = useRouter();

    if (!workspace) return null;

    // Helper to get deck icon as a React node
    const getDeckIcon = (sourceType: string | null) => {
        const info = getSourceInfo(sourceType);
        const Icon = info.icon;
        return <Icon className={cn("w-5 h-5", info.textColor)} />;
    };

    // Helper to get deck color
    const getDeckColor = (sourceType: string | null) => {
        switch (sourceType) {
            case 'youtube': return '#FEF2F2';
            case 'audio': return '#FAF5FF';
            default: return '#EEF2FF';
        }
    };

    // Map workspace decks to CardData for MorphingCardStack
    const cards: CardData[] = workspace.decks.map(deck => ({
        id: deck.id,
        title: deck.title,
        description: new Date(deck.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        icon: getDeckIcon(deck.sourceType),
        color: getDeckColor(deck.sourceType),
        actions: (
            <DeckActionsMenu
                deckId={deck.id}
                currentWorkspaceId={workspace.id}
                workspaces={workspaces}
                onWorkspaceChange={onWorkspaceChange}
            />
        )
    }));

    const handleCardClick = (card: CardData) => {
        onClose();
        router.push(`/study/${card.id}`);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={onClose}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.2 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[100vh] overflow-hidden border border-slate-200 dark:border-slate-800"
                    >
                        {/* Header - Compact */}
                        <div
                            className="px-5 py-4 border-b border-slate-200 dark:border-slate-800"
                            style={{ background: `linear-gradient(135deg, ${workspace.color}15, transparent)` }}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-10 h-10 rounded-lg flex items-center justify-center shadow-md"
                                        style={{ backgroundColor: workspace.color }}
                                    >
                                        <FolderOpen className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                                            {workspace.name}
                                        </h2>
                                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                            {workspace.description && (
                                                <span className="truncate max-w-[200px]">{workspace.description}</span>
                                            )}
                                            {workspace.description && <span>•</span>}
                                            <span>{workspace._count.decks} {workspace._count.decks === 1 ? 'deck' : 'decks'}</span>
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onClose}
                                    className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Content - Morphing Card Stack */}
                        <div
                            className="p-6 overflow-y-auto overflow-x-hidden max-h-[calc(100vh-160px)] flex flex-col items-center justify-start pt-4"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            {workspace.decks.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <FolderOpen className="w-8 h-8 text-slate-400" />
                                    </div>
                                    <p className="text-slate-500 dark:text-slate-400 font-medium">No study decks yet</p>
                                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                                        Add decks using the ⋯ menu on any study set
                                    </p>
                                </div>
                            ) : (
                                <MorphingCardStack
                                    cards={cards}
                                    defaultLayout="stack"
                                    onCardClick={handleCardClick}
                                    className="w-full"
                                />
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
