'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, FileText, List, BookOpen, Layout, GraduationCap, Lightbulb, Briefcase, Zap, FileCheck, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    NoteConfig,
    DEFAULT_NOTE_CONFIG,
    NoteDepth,
    NoteStyle,
    NoteTone,
    DEPTH_OPTIONS,
    STYLE_OPTIONS,
    TONE_OPTIONS
} from '@/lib/noteConfig/types';

interface NoteConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (config: NoteConfig) => void;
    isLoading?: boolean;
}

// Icons for each option
const STYLE_ICONS = {
    bullet_points: List,
    cornell: Layout,
    cheatsheet: Zap,
    outline: ClipboardList,
};

const TONE_ICONS = {
    academic: GraduationCap,
    simplify_eli5: Lightbulb,
    professional: Briefcase,
};

const DEPTH_ICONS = {
    brief: FileCheck,
    standard: FileText,
    detailed: BookOpen,
};

export default function NoteConfigModal({
    isOpen,
    onClose,
    onGenerate,
    isLoading = false
}: NoteConfigModalProps) {
    const [config, setConfig] = useState<NoteConfig>(DEFAULT_NOTE_CONFIG);

    const handleGenerate = () => {
        onGenerate(config);
    };

    const updateConfig = <K extends keyof NoteConfig>(key: K, value: NoteConfig[K]) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop - z-[100] to cover shadcn dialogs */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100]"
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
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                                        <Sparkles className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Generate Notes</h2>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Customize your note preferences</p>
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
                                {/* Note Style */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                                        Note Style
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {STYLE_OPTIONS.map((option) => {
                                            const Icon = STYLE_ICONS[option.value];
                                            const isSelected = config.style === option.value;
                                            return (
                                                <button
                                                    key={option.value}
                                                    onClick={() => updateConfig('style', option.value)}
                                                    className={`
                                                        flex items-center gap-3 p-3 rounded-xl text-left transition-all
                                                        ${isSelected
                                                            ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                        }
                                                    `}
                                                >
                                                    <Icon className="w-5 h-5 shrink-0" />
                                                    <div>
                                                        <div className="font-medium text-sm">{option.label}</div>
                                                        <div className="text-xs opacity-70">{option.description}</div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Tone */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                                        Writing Tone
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {TONE_OPTIONS.map((option) => {
                                            const Icon = TONE_ICONS[option.value];
                                            const isSelected = config.tone === option.value;
                                            return (
                                                <button
                                                    key={option.value}
                                                    onClick={() => updateConfig('tone', option.value)}
                                                    className={`
                                                        flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all
                                                        ${isSelected
                                                            ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                        }
                                                    `}
                                                >
                                                    <Icon className="w-4 h-4" />
                                                    <span className="font-medium text-sm">{option.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Depth */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                                        Detail Level
                                    </label>
                                    <div className="flex gap-2">
                                        {DEPTH_OPTIONS.map((option) => {
                                            const Icon = DEPTH_ICONS[option.value];
                                            const isSelected = config.depth === option.value;
                                            return (
                                                <button
                                                    key={option.value}
                                                    onClick={() => updateConfig('depth', option.value)}
                                                    className={`
                                                        flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all
                                                        ${isSelected
                                                            ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                        }
                                                    `}
                                                >
                                                    <Icon className="w-5 h-5" />
                                                    <span className="font-medium text-sm">{option.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                                <Button
                                    onClick={handleGenerate}
                                    disabled={isLoading}
                                    className="w-full h-12 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-medium text-base rounded-xl shadow-lg shadow-violet-500/25 transition-all"
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-5 h-5 mr-2" />
                                            Generate Notes
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
