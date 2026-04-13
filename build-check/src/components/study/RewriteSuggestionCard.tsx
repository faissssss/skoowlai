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
            className="bg-[#1e293b] border border-slate-700 rounded-xl p-4 mb-4 shadow-sm"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    <span className="text-xs font-medium text-primary">
                        {ACTION_LABELS[action]} Text
                    </span>
                </div>
                <button
                    onClick={onDismiss}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Original Text Preview (collapsed) */}
            <div className="mb-3 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                <span className="font-medium">Original: </span>
                <span className="italic line-clamp-1">&ldquo;{originalText}&rdquo;</span>
            </div>

            {/* Rewritten Text */}
            <div className="bg-card rounded-lg p-3 mb-3 min-h-[60px]">
                {isLoading && !rewrittenText ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Rewriting...</span>
                    </div>
                ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
                        <ReactMarkdown>{rewrittenText || ''}</ReactMarkdown>
                        {isLoading && (
                            <span className="inline-flex items-center gap-1 text-primary text-sm">
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
                        className="flex-1 bg-primary hover:bg-primary/90 text-white gap-2"
                    >
                        <Check className="w-3.5 h-3.5" />
                        Insert
                    </Button>
                    <Button
                        onClick={onRetry}
                        size="sm"
                        variant="outline"
                        className="flex-1 border-primary/30 text-primary hover:bg-primary/10 gap-2"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Retry
                    </Button>
                </div>
            )}
        </motion.div>
    );
}
