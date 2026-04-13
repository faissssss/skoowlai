'use client';

import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface FocusReadModalProps {
    isOpen: boolean;
    onClose: () => void;
    content: string;
    title?: string;
}

export default function FocusReadModal({ isOpen, onClose, content, title }: FocusReadModalProps) {
    // Close on Escape key
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, handleKeyDown]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Overlay */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
                        onClick={onClose}
                    />

                    {/* Modal Container */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div
                            className="max-w-4xl w-full h-[85vh] bg-card rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                                <h2 className="text-lg font-semibold text-foreground">
                                    {title || 'Focus Read'}
                                </h2>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                    aria-label="Close modal"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Content - Scrollable */}
                            <div className="flex-1 overflow-y-auto p-8 md:p-12">
                                <article className="prose prose-invert prose-lg max-w-none text-foreground/80 leading-8">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkMath]}
                                        rehypePlugins={[rehypeKatex]}
                                        components={{
                                            p: ({ node: _node, ...props }) => (
                                                <p className="mb-6 text-lg leading-8 text-foreground/80" {...props} />
                                            ),
                                            h1: ({ node: _node, ...props }) => (
                                                <h1 className="text-3xl font-bold mb-6 mt-8 first:mt-0 text-foreground" {...props} />
                                            ),
                                            h2: ({ node: _node, ...props }) => (
                                                <h2 className="text-2xl font-semibold mb-4 mt-8 first:mt-0 text-foreground" {...props} />
                                            ),
                                            h3: ({ node: _node, ...props }) => (
                                                <h3 className="text-xl font-semibold mb-3 mt-6 first:mt-0 text-foreground" {...props} />
                                            ),
                                            ul: ({ node: _node, ...props }) => (
                                                <ul className="list-disc pl-6 mb-6 space-y-3 text-lg text-foreground/80" {...props} />
                                            ),
                                            ol: ({ node: _node, ...props }) => (
                                                <ol className="list-decimal pl-6 mb-6 space-y-3 text-lg text-foreground/80" {...props} />
                                            ),
                                            li: ({ node: _node, ...props }) => (
                                                <li className="pl-2 leading-8" {...props} />
                                            ),
                                            strong: ({ node: _node, ...props }) => (
                                                <strong className="font-semibold text-foreground" {...props} />
                                            ),
                                            em: ({ node: _node, ...props }) => (
                                                <em className="italic text-muted-foreground" {...props} />
                                            ),
                                            blockquote: ({ node: _node, ...props }) => (
                                                <blockquote className="border-l-4 border-primary pl-6 py-2 my-6 text-muted-foreground italic bg-muted/50 rounded-r-lg" {...props} />
                                            ),
                                            code: ({ node: _node, className, ...props }) => {
                                                const isInline = !className;
                                                return isInline ? (
                                                    <code className="bg-muted px-2 py-1 rounded text-sm text-primary font-mono" {...props} />
                                                ) : (
                                                    <code className="block bg-muted p-4 rounded-lg text-sm text-muted-foreground font-mono overflow-x-auto" {...props} />
                                                );
                                            },
                                            pre: ({ node: _node, ...props }) => (
                                                <pre className="bg-muted rounded-lg p-4 overflow-x-auto mb-6" {...props} />
                                            ),
                                            hr: ({ node: _node, ...props }) => (
                                                <hr className="my-8 border-border" {...props} />
                                            ),
                                            a: ({ node: _node, ...props }) => (
                                                <a className="text-primary hover:text-primary/80 underline underline-offset-2" {...props} />
                                            ),
                                        }}
                                    >
                                        {content}
                                    </ReactMarkdown>
                                </article>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
