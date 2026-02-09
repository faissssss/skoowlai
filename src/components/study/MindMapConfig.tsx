'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, Network, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGlobalLoader } from '@/contexts/LoaderContext';
import { useErrorModal } from '@/components/ErrorModal';

interface MindMapConfigProps {
    deckId: string;
    isOpen: boolean;
    onClose: () => void;
    onGenerated: () => void;
}

// Layout type with visual SVG preview
const layoutOptions = [
    {
        value: 'mindmap',
        label: 'Mind Map',
        description: 'Radial branching',
        icon: (
            <svg viewBox="0 0 60 40" className="w-full h-full">
                <circle cx="30" cy="20" r="6" className="fill-current" />
                <line x1="30" y1="20" x2="12" y2="8" className="stroke-current" strokeWidth="1.5" />
                <line x1="30" y1="20" x2="12" y2="32" className="stroke-current" strokeWidth="1.5" />
                <line x1="30" y1="20" x2="48" y2="8" className="stroke-current" strokeWidth="1.5" />
                <line x1="30" y1="20" x2="48" y2="32" className="stroke-current" strokeWidth="1.5" />
                <circle cx="12" cy="8" r="4" className="fill-current opacity-60" />
                <circle cx="12" cy="32" r="4" className="fill-current opacity-60" />
                <circle cx="48" cy="8" r="4" className="fill-current opacity-60" />
                <circle cx="48" cy="32" r="4" className="fill-current opacity-60" />
            </svg>
        ),
    },
    {
        value: 'tree',
        label: 'Tree Diagram',
        description: 'Top-down hierarchy',
        icon: (
            <svg viewBox="0 0 60 40" className="w-full h-full">
                <rect x="24" y="2" width="12" height="6" rx="1" className="fill-current" />
                <line x1="30" y1="8" x2="30" y2="14" className="stroke-current" strokeWidth="1.5" />
                <line x1="15" y1="14" x2="45" y2="14" className="stroke-current" strokeWidth="1.5" />
                <line x1="15" y1="14" x2="15" y2="18" className="stroke-current" strokeWidth="1.5" />
                <line x1="30" y1="14" x2="30" y2="18" className="stroke-current" strokeWidth="1.5" />
                <line x1="45" y1="14" x2="45" y2="18" className="stroke-current" strokeWidth="1.5" />
                <rect x="9" y="18" width="12" height="6" rx="1" className="fill-current opacity-70" />
                <rect x="24" y="18" width="12" height="6" rx="1" className="fill-current opacity-70" />
                <rect x="39" y="18" width="12" height="6" rx="1" className="fill-current opacity-70" />
                <line x1="15" y1="24" x2="15" y2="28" className="stroke-current" strokeWidth="1.5" />
                <rect x="9" y="28" width="12" height="5" rx="1" className="fill-current opacity-40" />
                <rect x="24" y="28" width="12" height="5" rx="1" className="fill-current opacity-40" />
            </svg>
        ),
    },
    {
        value: 'logic',
        label: 'Logic Chart',
        description: 'Flow connections',
        icon: (
            <svg viewBox="0 0 60 40" className="w-full h-full">
                <rect x="4" y="16" width="14" height="8" rx="1" className="fill-current" />
                <line x1="18" y1="20" x2="24" y2="20" className="stroke-current" strokeWidth="1.5" />
                <polygon points="24,16 34,20 24,24" className="fill-current opacity-70" />
                <line x1="34" y1="20" x2="40" y2="20" className="stroke-current" strokeWidth="1.5" />
                <rect x="40" y="16" width="14" height="8" rx="1" className="fill-current opacity-60" />
                <line x1="30" y1="8" x2="30" y2="16" className="stroke-current" strokeWidth="1.5" strokeDasharray="2" />
                <line x1="30" y1="24" x2="30" y2="32" className="stroke-current" strokeWidth="1.5" strokeDasharray="2" />
            </svg>
        ),
    },
    {
        value: 'timeline',
        label: 'Timeline',
        description: 'Sequential flow',
        icon: (
            <svg viewBox="0 0 60 40" className="w-full h-full">
                <line x1="5" y1="20" x2="55" y2="20" className="stroke-current" strokeWidth="1.5" />
                <circle cx="12" cy="20" r="4" className="fill-current" />
                <circle cx="30" cy="20" r="4" className="fill-current opacity-70" />
                <circle cx="48" cy="20" r="4" className="fill-current opacity-50" />
                <line x1="12" y1="16" x2="12" y2="8" className="stroke-current" strokeWidth="1.5" />
                <line x1="30" y1="24" x2="30" y2="32" className="stroke-current" strokeWidth="1.5" />
                <line x1="48" y1="16" x2="48" y2="8" className="stroke-current" strokeWidth="1.5" />
                <rect x="6" y="4" width="12" height="4" rx="1" className="fill-current opacity-60" />
                <rect x="24" y="32" width="12" height="4" rx="1" className="fill-current opacity-60" />
                <rect x="42" y="4" width="12" height="4" rx="1" className="fill-current opacity-60" />
            </svg>
        ),
    },
    {
        value: 'fishbone',
        label: 'Fishbone',
        description: 'Cause & effect',
        icon: (
            <svg viewBox="0 0 60 40" className="w-full h-full">
                <line x1="5" y1="20" x2="50" y2="20" className="stroke-current" strokeWidth="1.5" />
                <polygon points="50,20 55,16 55,24" className="fill-current" />
                <line x1="15" y1="20" x2="10" y2="8" className="stroke-current" strokeWidth="1.5" />
                <line x1="15" y1="20" x2="10" y2="32" className="stroke-current" strokeWidth="1.5" />
                <line x1="30" y1="20" x2="25" y2="8" className="stroke-current" strokeWidth="1.5" />
                <line x1="30" y1="20" x2="25" y2="32" className="stroke-current" strokeWidth="1.5" />
                <line x1="45" y1="20" x2="40" y2="10" className="stroke-current" strokeWidth="1.5" />
                <line x1="45" y1="20" x2="40" y2="30" className="stroke-current" strokeWidth="1.5" />
                <circle cx="10" cy="8" r="3" className="fill-current opacity-60" />
                <circle cx="10" cy="32" r="3" className="fill-current opacity-60" />
                <circle cx="25" cy="8" r="3" className="fill-current opacity-50" />
                <circle cx="25" cy="32" r="3" className="fill-current opacity-50" />
            </svg>
        ),
    },
    {
        value: 'grid',
        label: 'Grid',
        description: 'Matrix layout',
        icon: (
            <svg viewBox="0 0 60 40" className="w-full h-full">
                <rect x="6" y="4" width="14" height="10" rx="2" className="fill-current" />
                <rect x="23" y="4" width="14" height="10" rx="2" className="fill-current opacity-80" />
                <rect x="40" y="4" width="14" height="10" rx="2" className="fill-current opacity-60" />
                <rect x="6" y="17" width="14" height="10" rx="2" className="fill-current opacity-70" />
                <rect x="23" y="17" width="14" height="10" rx="2" className="fill-current opacity-50" />
                <rect x="40" y="17" width="14" height="10" rx="2" className="fill-current opacity-40" />
                <rect x="6" y="30" width="14" height="8" rx="2" className="fill-current opacity-50" />
                <rect x="23" y="30" width="14" height="8" rx="2" className="fill-current opacity-30" />
            </svg>
        ),
    },
];

// Color theme options
const colorThemes = [
    { value: 'indigo', label: 'Indigo', colors: ['#6366f1', '#818cf8', '#a5b4fc'] },
    { value: 'emerald', label: 'Emerald', colors: ['#10b981', '#34d399', '#6ee7b7'] },
    { value: 'amber', label: 'Amber', colors: ['#f59e0b', '#fbbf24', '#fcd34d'] },
    { value: 'rose', label: 'Rose', colors: ['#f43f5e', '#fb7185', '#fda4af'] },
    { value: 'cyan', label: 'Cyan', colors: ['#06b6d4', '#22d3ee', '#67e8f9'] },
    { value: 'violet', label: 'Violet', colors: ['#8b5cf6', '#a78bfa', '#c4b5fd'] },
];

// Depth options
const depthOptions = [
    { value: 'shallow', label: 'Simple', description: 'Key concepts only' },
    { value: 'medium', label: 'Balanced', description: 'Main topics + subtopics' },
    { value: 'deep', label: 'Detailed', description: 'Comprehensive coverage' },
];

export default function MindMapConfig({ deckId, isOpen, onClose, onGenerated }: MindMapConfigProps) {
    const [depth, setDepth] = useState('medium');
    const [layout, setLayout] = useState('mindmap');
    const [colorTheme, setColorTheme] = useState('indigo');
    const [isGenerating, setIsGenerating] = useState(false);
    const { startLoading, stopLoading } = useGlobalLoader();
    const { showError } = useErrorModal();

    const handleGenerate = async () => {
        setIsGenerating(true);
        startLoading('Generating your Mind Map...');
        try {
            const response = await fetch('/api/mindmap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deckId, depth, style: layout, colorTheme }),
            });

            if (response.ok) {
                onGenerated();
            } else {
                const data = await response.json().catch(() => ({}));
                if (response.status === 429 && data.upgradeRequired) {
                    showError(
                        'Daily limit reached',
                        data.details || 'You have reached your daily limit. Please try again tomorrow.',
                        'limit'
                    );
                    return;
                }
                console.error('Failed to generate mind map:', data.error);
                alert('Failed to generate mind map. Please try again.');
            }
        } catch (error) {
            console.error('Error generating mind map:', error);
            alert('Failed to generate mind map. Please try again.');
        } finally {
            setIsGenerating(false);
            stopLoading();
        }
    };

    return (
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
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-linear-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                                        <Network className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-base sm:text-lg font-semibold text-foreground">Generate Mind Map</h2>
                                        <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Visualize your notes as a diagram</p>
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
                                {/* Layout Selection with Visual Previews */}
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-2 text-center">
                                        Layout Style
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {layoutOptions.map((option) => (
                                            <button
                                                key={option.value}
                                                onClick={() => setLayout(option.value)}
                                                disabled={isGenerating}
                                                className={cn(
                                                    "relative p-2.5 rounded-xl border-2 transition-all duration-200 text-left group",
                                                    layout === option.value
                                                        ? "border-primary bg-primary/10 text-primary"
                                                        : "border-border hover:border-primary/30 bg-transparent",
                                                    isGenerating && "opacity-50 cursor-not-allowed"
                                                )}
                                            >
                                                {/* Icon Preview */}
                                                <div className={cn(
                                                    "w-full h-6 mb-1.5 transition-colors",
                                                    layout === option.value
                                                        ? "text-primary"
                                                        : "text-muted-foreground group-hover:text-foreground"
                                                )}>
                                                    {option.icon}
                                                </div>

                                                {/* Label */}
                                                <div className="font-medium text-xs">
                                                    {option.label}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Color Theme Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-2 text-center">
                                        Color Theme
                                    </label>
                                    <div className="flex flex-wrap gap-1.5 justify-center">
                                        {colorThemes.map((theme) => (
                                            <button
                                                key={theme.value}
                                                onClick={() => setColorTheme(theme.value)}
                                                disabled={isGenerating}
                                                className={cn(
                                                    "relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-2 transition-all duration-200",
                                                    colorTheme === theme.value
                                                        ? "border-primary bg-primary/10 text-primary"
                                                        : "border-border hover:border-primary/30 bg-transparent",
                                                    isGenerating && "opacity-50 cursor-not-allowed"
                                                )}
                                            >
                                                {/* Color dots */}
                                                <div className="flex -space-x-1">
                                                    {theme.colors.map((color, i) => (
                                                        <div
                                                            key={i}
                                                            className="w-3 h-3 rounded-full border border-background"
                                                            style={{ backgroundColor: color }}
                                                        />
                                                    ))}
                                                </div>
                                                <span className="text-xs font-medium">
                                                    {theme.label}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Depth Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-2 text-center">
                                        Depth Level
                                    </label>
                                    <div className="flex flex-wrap gap-1.5 justify-center">
                                        {depthOptions.map((option) => (
                                            <button
                                                key={option.value}
                                                onClick={() => setDepth(option.value)}
                                                disabled={isGenerating}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-lg border-2 transition-all duration-200",
                                                    depth === option.value
                                                        ? "border-primary bg-primary/10 text-primary"
                                                        : "border-border text-muted-foreground hover:border-primary/30 bg-transparent",
                                                    isGenerating && "opacity-50 cursor-not-allowed"
                                                )}
                                            >
                                                <span className="font-medium text-sm">{option.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-border bg-muted/50 shrink-0">
                                <Button
                                    onClick={handleGenerate}
                                    disabled={isGenerating}
                                    className="w-full h-11 bg-linear-to-r from-pink-500 to-rose-600 hover:from-pink-500/90 hover:to-rose-700 text-white font-medium rounded-xl shadow-lg shadow-pink-500/25 transition-all"
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin text-white" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Network className="w-5 h-5 mr-2 text-white" />
                                            Generate Mind Map
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
