'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, Network, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGlobalLoader } from '@/contexts/LoaderContext';

interface MindMapConfigProps {
    deckId: string;
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

export default function MindMapConfig({ deckId, onGenerated }: MindMapConfigProps) {
    const [depth, setDepth] = useState('medium');
    const [layout, setLayout] = useState('mindmap');
    const [colorTheme, setColorTheme] = useState('indigo');
    const [isGenerating, setIsGenerating] = useState(false);
    const { startLoading, stopLoading } = useGlobalLoader();

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
                const data = await response.json();
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
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 md:p-8">
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <Network className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Generate Mind Map</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Visualize your notes as an interactive diagram
                    </p>
                </div>
            </div>

            <div className="space-y-8">
                {/* Layout Selection with Visual Previews */}
                <div className="text-center">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
                        Layout Style
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {layoutOptions.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => setLayout(option.value)}
                                disabled={isGenerating}
                                className={cn(
                                    "relative p-4 rounded-xl border-2 transition-all duration-200 text-left group",
                                    layout === option.value
                                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-800/50",
                                    isGenerating && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                {/* Selection indicator */}
                                {layout === option.value && (
                                    <div className="absolute top-2 right-2 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                                        <Check className="w-3 h-3 text-white" />
                                    </div>
                                )}

                                {/* Icon Preview */}
                                <div className={cn(
                                    "w-full h-12 mb-3 transition-colors",
                                    layout === option.value
                                        ? "text-indigo-600 dark:text-indigo-400"
                                        : "text-slate-400 dark:text-slate-500 group-hover:text-slate-500 dark:group-hover:text-slate-400"
                                )}>
                                    {option.icon}
                                </div>

                                {/* Label */}
                                <div className={cn(
                                    "font-medium text-sm",
                                    layout === option.value
                                        ? "text-indigo-700 dark:text-indigo-300"
                                        : "text-slate-700 dark:text-slate-300"
                                )}>
                                    {option.label}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {option.description}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Color Theme Selection */}
                <div className="text-center">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
                        Color Theme
                    </label>
                    <div className="flex flex-wrap gap-3 justify-center">
                        {colorThemes.map((theme) => (
                            <button
                                key={theme.value}
                                onClick={() => setColorTheme(theme.value)}
                                disabled={isGenerating}
                                className={cn(
                                    "relative flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all duration-200",
                                    colorTheme === theme.value
                                        ? "border-slate-900 dark:border-white bg-slate-100 dark:bg-slate-800"
                                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600",
                                    isGenerating && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                {/* Color dots */}
                                <div className="flex -space-x-1">
                                    {theme.colors.map((color, i) => (
                                        <div
                                            key={i}
                                            className="w-5 h-5 rounded-full border-2 border-white dark:border-slate-800"
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                                <span className={cn(
                                    "text-sm font-medium",
                                    colorTheme === theme.value
                                        ? "text-slate-900 dark:text-white"
                                        : "text-slate-600 dark:text-slate-400"
                                )}>
                                    {theme.label}
                                </span>
                                {colorTheme === theme.value && (
                                    <Check className="w-4 h-4 text-slate-900 dark:text-white" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Depth Selection */}
                <div className="text-center">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
                        Depth Level
                    </label>
                    <div className="flex flex-wrap gap-2 justify-center">
                        {depthOptions.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => setDepth(option.value)}
                                disabled={isGenerating}
                                className={cn(
                                    "px-4 py-2 rounded-lg border-2 transition-all duration-200",
                                    depth === option.value
                                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300"
                                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600",
                                    isGenerating && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                <span className="font-medium text-sm">{option.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Generate Button */}
                <Button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white h-12 text-lg font-semibold shadow-lg"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Generating...
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-5 h-5 mr-2" />
                            Generate Mind Map
                        </>
                    )}
                </Button>

                <p className="text-center text-xs text-slate-400 dark:text-slate-500">
                    AI will analyze your notes and create an interactive diagram
                </p>
            </div>
        </div>
    );
}
