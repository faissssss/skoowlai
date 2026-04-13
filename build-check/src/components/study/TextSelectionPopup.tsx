'use client';

import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Bot, Wand2, ChevronDown, Sparkles, Scissors, RefreshCw, FileText, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Editor } from '@tiptap/core';

export type RewriteAction = 'improve' | 'shorten' | 'paraphrase' | 'simplify' | 'detailed';

interface TextSelectionPopupProps {
    onAskAI: (selectedText: string) => void;
    onRewrite?: (selectedText: string, action: RewriteAction, range: { from: number; to: number }) => void;
    editorRef?: React.RefObject<Editor | null>;
}

const REWRITE_OPTIONS: { action: RewriteAction; label: string; icon: React.ElementType }[] = [
    { action: 'improve', label: 'Improve', icon: Sparkles },
    { action: 'shorten', label: 'Shorten', icon: Scissors },
    { action: 'paraphrase', label: 'Paraphrase', icon: RefreshCw },
    { action: 'simplify', label: 'Simplify', icon: FileText },
    { action: 'detailed', label: 'Make it detailed', icon: BookOpen },
];

export default function TextSelectionPopup({ onAskAI, onRewrite, editorRef }: TextSelectionPopupProps) {
    const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);
    const [showRewriteMenu, setShowRewriteMenu] = useState(false);
    const [editorRange, setEditorRange] = useState<{ from: number; to: number } | null>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleSelectionChange = () => {
            const selectedText = window.getSelection()?.toString().trim();

            if (selectedText && selectedText.length > 0) {
                const range = window.getSelection()?.getRangeAt(0);
                const rect = range?.getBoundingClientRect();

                if (rect) {
                    setSelection({
                        text: selectedText,
                        x: rect.left + rect.width / 2,
                        y: rect.top - 60 // Position above the selection
                    });

                    // Get TipTap editor range if available
                    if (editorRef?.current) {
                        const editor = editorRef.current;
                        const { from, to } = editor.state.selection;
                        setEditorRange({ from, to });
                    }
                }
            } else {
                setSelection(null);
                setShowRewriteMenu(false);
                setEditorRange(null);
            }
        };

        // Listen for selection changes
        document.addEventListener('mouseup', handleSelectionChange);
        document.addEventListener('keyup', handleSelectionChange);

        return () => {
            document.removeEventListener('mouseup', handleSelectionChange);
            document.removeEventListener('keyup', handleSelectionChange);
        };
    }, [editorRef]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
                setShowRewriteMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAskClick = () => {
        if (selection) {
            onAskAI(selection.text);
            setSelection(null);
            setShowRewriteMenu(false);
            window.getSelection()?.removeAllRanges();
        }
    };

    const handleRewriteClick = (action: RewriteAction) => {
        if (selection && onRewrite && editorRange) {
            onRewrite(selection.text, action, editorRange);
            setSelection(null);
            setShowRewriteMenu(false);
            window.getSelection()?.removeAllRanges();
        }
    };

    return (
        <AnimatePresence>
            {selection && (
                <motion.div
                    ref={popupRef}
                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: 10 }}
                    transition={{ duration: 0.15 }}
                    style={{
                        position: 'fixed',
                        left: selection.x,
                        top: selection.y,
                        transform: 'translateX(-50%)',
                        zIndex: 9999
                    }}
                    className="pointer-events-auto"
                >
                    <div className="flex items-center gap-1 bg-popover rounded-full shadow-xl p-1 border border-border">
                        {/* Ask AI Button */}
                        <Button
                            onClick={handleAskClick}
                            size="sm"
                            className="bg-primary hover:bg-primary/90 text-white flex items-center gap-2 px-4 py-2 rounded-full h-9"
                        >
                            <Bot className="w-4 h-4 text-white" />
                            Ask Skoowl AI
                        </Button>

                        {/* Rewrite Button with Dropdown */}
                        {onRewrite && editorRef && (
                            <div className="relative">
                                <Button
                                    onClick={() => setShowRewriteMenu(!showRewriteMenu)}
                                    size="sm"
                                    variant="ghost"
                                    className="text-foreground hover:bg-muted flex items-center gap-1.5 px-3 py-2 rounded-full h-9"
                                >
                                    <Wand2 className="w-4 h-4" />
                                    Rewrite
                                    <ChevronDown className={`w-3 h-3 transition-transform ${showRewriteMenu ? 'rotate-180' : ''}`} />
                                </Button>

                                {/* Dropdown Menu */}
                                <AnimatePresence>
                                    {showRewriteMenu && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -5 }}
                                            transition={{ duration: 0.1 }}
                                            className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-popover rounded-xl shadow-2xl border border-border overflow-hidden"
                                        >
                                            {REWRITE_OPTIONS.map((option) => {
                                                const Icon = option.icon;
                                                return (
                                                    <button
                                                        key={option.action}
                                                        onClick={() => handleRewriteClick(option.action)}
                                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors text-left"
                                                    >
                                                        <Icon className="w-4 h-4 text-primary" />
                                                        {option.label}
                                                    </button>
                                                );
                                            })}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
