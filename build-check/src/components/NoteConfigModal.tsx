'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, List, BookOpen, Layout, GraduationCap, Lightbulb, Briefcase, Zap, FileCheck, ClipboardList, Sparkles, Coffee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    NoteConfig,
    DEFAULT_NOTE_CONFIG,
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
    casual: Coffee,
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
                    {/* Backdrop - transparent for click-to-close only (matches shadcn Dialog style) */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-100"
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
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-linear-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                                        <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-base sm:text-lg font-semibold text-foreground">Generate Notes</h2>
                                        <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Customize your note preferences</p>
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
                                {/* Note Style */}
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-2 text-center">
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
                                                        flex items-center gap-2 p-2.5 rounded-xl text-left transition-all
                                                        ${isSelected
                                                            ? 'bg-primary/10 text-primary border-primary border-2 shadow-none'
                                                            : 'bg-transparent border-border border-2 text-muted-foreground hover:border-primary/30'
                                                        }
                                                    `}
                                                >
                                                    <Icon className="w-4 h-4 shrink-0" />
                                                    <div>
                                                        <div className="font-medium text-sm">{option.label}</div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Tone */}
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-2 text-center">
                                        Writing Tone
                                    </label>
                                    <div className="flex flex-wrap gap-2 justify-center">
                                        {TONE_OPTIONS.map((option) => {
                                            const Icon = TONE_ICONS[option.value];
                                            const isSelected = config.tone === option.value;
                                            return (
                                                <button
                                                    key={option.value}
                                                    onClick={() => updateConfig('tone', option.value)}
                                                    className={`
                                                        flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all
                                                        ${isSelected
                                                            ? 'bg-primary/10 text-primary border-primary border-2 shadow-none'
                                                            : 'bg-transparent border-border border-2 text-muted-foreground hover:border-primary/30'
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
                                    <label className="block text-sm font-medium text-foreground mb-2 text-center">
                                        Detail Level
                                    </label>
                                    <div className="flex gap-2 justify-center">
                                        {DEPTH_OPTIONS.map((option) => {
                                            const Icon = DEPTH_ICONS[option.value];
                                            const isSelected = config.depth === option.value;
                                            return (
                                                <button
                                                    key={option.value}
                                                    onClick={() => updateConfig('depth', option.value)}
                                                    className={`
                                                        flex-1 flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all
                                                        ${isSelected
                                                            ? 'bg-primary/10 text-primary border-primary border-2 shadow-none'
                                                            : 'bg-transparent border-border border-2 text-muted-foreground hover:border-primary/30'
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
                            </div>

                            {/* Footer */}
                            <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-border bg-muted/50 shrink-0">
                                <Button
                                    onClick={handleGenerate}
                                    disabled={isLoading}
                                    className="w-full h-11 bg-linear-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-medium rounded-xl shadow-lg shadow-teal-500/25 transition-all"
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                            <span className="text-white">Generating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <FileText className="w-5 h-5 mr-2 text-white" />
                                            <span className="text-white">Generate Notes</span>
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
