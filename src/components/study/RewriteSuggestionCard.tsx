'use client';

import { Button } from '@/components/ui/button';
import { Check, RefreshCw, X, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

export type RewriteAction = 'improve' | 'shorten' | 'paraphrase' | 'simplify' | 'detailed';

interface RewriteSuggestionCardProps {
    originalText: string;
    rewrittenText: string;
    action: RewriteAction;
    isLoading: boolean;
    onInsert: () => void;
    onRetry: () => void;
    onDismiss: () => void;
}

const ACTION_LABELS: Record<RewriteAction, string> = {
    improve: 'Improved',
    shorten: 'Shortened',
    paraphrase: 'Paraphrased',
    simplify: 'Simplified',
    detailed: 'Detailed',
};

export default function RewriteSuggestionCard({
    originalText,
    rewrittenText,
    action,
    isLoading,
    onInsert,
    onRetry,
    onDismiss,
}: RewriteSuggestionCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 mb-4 shadow-sm"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                    <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                        {ACTION_LABELS[action]} Text
                    </span>
                </div>
                <button
                    onClick={onDismiss}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Original Text Preview (collapsed) */}
            <div className="mb-3 text-xs text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-900/50 rounded-lg px-3 py-2">
                <span className="font-medium">Original: </span>
                <span className="italic line-clamp-1">"{originalText}"</span>
            </div>

            {/* Rewritten Text */}
            <div className="bg-white dark:bg-slate-900 rounded-lg p-3 mb-3 min-h-[60px]">
                {isLoading && !rewrittenText ? (
                    <div className="flex items-center gap-2 text-slate-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Rewriting...</span>
                    </div>
                ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none text-slate-800 dark:text-slate-200">
                        <ReactMarkdown>{rewrittenText || ''}</ReactMarkdown>
                        {isLoading && (
                            <span className="inline-flex items-center gap-1 text-indigo-500 text-sm">
                                <Loader2 className="w-3 h-3 animate-spin inline" />
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Action Buttons - Show when not loading */}
            {!isLoading && rewrittenText && (
                <div className="flex items-center gap-2">
                    <Button
                        onClick={onInsert}
                        size="sm"
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                    >
                        <Check className="w-3.5 h-3.5" />
                        Insert
                    </Button>
                    <Button
                        onClick={onRetry}
                        size="sm"
                        variant="outline"
                        className="flex-1 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 gap-2"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Retry
                    </Button>
                </div>
            )}
        </motion.div>
    );
}
