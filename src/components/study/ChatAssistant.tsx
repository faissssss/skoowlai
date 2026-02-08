'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, Send, Loader2, ArrowRight, Mic, MicOff, Paperclip, X, Trash2, Maximize2 } from 'lucide-react';
import { useState, useEffect, useRef, useCallback, startTransition } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import RewriteSuggestionCard, { RewriteAction } from './RewriteSuggestionCard';
import FocusReadModal from '@/components/FocusReadModal';
import type { Editor } from '@tiptap/core';
import type { RewriteRequest } from './EditorContext';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    citation?: string; // Store citation separately
    files?: { name: string; type: string; url: string }[];
    isStreaming?: boolean; // Flag for streaming state
    isHistorical?: boolean; // True for messages loaded from DB
}

// Helper to clean up AI response formatting
const formatAIResponse = (text: string) => {
    if (!text) return '';

    let formatted = text;

    // 1. Fix missing space after punctuation (e.g., "word.Next" -> "word. Next")
    formatted = formatted.replace(/([.?!])([A-Z0-9])/g, '$1 $2');

    // 2. Ensure max 2 newlines between sections
    formatted = formatted.replace(/\n{3,}/g, '\n\n');

    return formatted;
};

// Typing animation component for AI messages
// Shows content with typing animation and cursor during streaming (real-time only)
function TypingMessage({
    content,
    isStreaming,
    isHistorical = false, // True for messages loaded from DB after refresh
}: {
    content: string;
    isStreaming?: boolean;
    isHistorical?: boolean;
}) {
    const [displayedLength, setDisplayedLength] = useState(isHistorical ? content.length : 0);
    const prevContentLengthRef = useRef(0);

    // Format the content for proper markdown rendering
    const formattedContent = formatAIResponse(content);

    useEffect(() => {
        // Skip animation for historical messages
        if (isHistorical) {
            startTransition(() => {
                setDisplayedLength(content.length);
            });
            return;
        }

        // Reset when new message starts
        if (content.length < prevContentLengthRef.current) {
            startTransition(() => {
                setDisplayedLength(0);
            });
        }
        prevContentLengthRef.current = content.length;

        // Typing animation - catch up to current content
        if (displayedLength < content.length) {
            const charsPerTick = 8;
            const tickInterval = 20;

            const timer = setTimeout(() => {
                startTransition(() => {
                    setDisplayedLength(prev => Math.min(prev + charsPerTick, content.length));
                });
            }, tickInterval);

            return () => clearTimeout(timer);
        }
    }, [content, displayedLength, isHistorical]);

    // For historical messages, always show full content immediately
    if (isHistorical) {
        return (
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
                <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                        strong: ({ ...props }) => <strong className="font-semibold text-white" {...props} />,
                        em: ({ ...props }) => <em className="italic text-white" {...props} />,
                        p: ({ ...props }) => <p className="mb-2 last:mb-0 text-white" {...props} />,
                        ul: ({ ...props }) => <ul className="list-disc pl-4 mb-2 space-y-0.5 text-white" {...props} />,
                        ol: ({ ...props }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5 text-white" {...props} />,
                        li: ({ ...props }) => <li className="pl-0.5 text-white" {...props} />,
                        h1: ({ ...props }) => <h1 className="text-base font-semibold mb-1.5 mt-2 first:mt-0 text-white" {...props} />,
                        h2: ({ ...props }) => <h2 className="text-sm font-semibold mb-1.5 mt-2 first:mt-0 text-white" {...props} />,
                        h3: ({ ...props }) => <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0 text-white" {...props} />,
                        hr: ({ ...props }) => <hr className="my-2 border-slate-700" {...props} />,
                        code: ({ ...props }) => <code className="bg-slate-800 px-1 py-0.5 rounded text-xs text-white" {...props} />,
                    }}
                >
                    {formattedContent}
                </ReactMarkdown>
            </div>
        );
    }

    // Real-time messages with typing animation
    const isTyping = displayedLength < content.length;
    const displayContent = isStreaming || isTyping
        ? formatAIResponse(content.slice(0, displayedLength))
        : formattedContent;

    return (
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
            <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                    strong: ({ ...props }) => <strong className="font-semibold text-white" {...props} />,
                    em: ({ ...props }) => <em className="italic text-white" {...props} />,
                    p: ({ ...props }) => <p className="mb-2 last:mb-0 text-white" {...props} />,
                    ul: ({ ...props }) => <ul className="list-disc pl-4 mb-2 space-y-0.5 text-white" {...props} />,
                    ol: ({ ...props }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5 text-white" {...props} />,
                    li: ({ ...props }) => <li className="pl-0.5 text-white" {...props} />,
                    h1: ({ ...props }) => <h1 className="text-base font-semibold mb-1.5 mt-2 first:mt-0 text-white" {...props} />,
                    h2: ({ ...props }) => <h2 className="text-sm font-semibold mb-1.5 mt-2 first:mt-0 text-white" {...props} />,
                    h3: ({ ...props }) => <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0 text-white" {...props} />,
                    hr: ({ ...props }) => <hr className="my-2 border-slate-700" {...props} />,
                    code: ({ ...props }) => <code className="bg-slate-800 px-1 py-0.5 rounded text-xs text-white" {...props} />,
                }}
            >
                {displayContent}
            </ReactMarkdown>
            {(isStreaming || isTyping) && (
                <span className="inline-block w-1.5 h-4 bg-primary ml-0.5 animate-pulse rounded-sm align-middle" />
            )}
        </div>
    );
}

// RewriteRequest is imported from EditorContext in StudyPageLayout

export default function ChatAssistant({
    context,
    deckId,
    isOpen,
    onToggle,
    citation,
    onCitationUsed,
    rewriteRequest,
    onRewriteInsert,
    onRewriteClear,
}: {
    context: string;
    deckId: string;
    isOpen: boolean;
    onToggle: () => void;
    citation?: string | null;
    onCitationUsed?: () => void;
    rewriteRequest?: RewriteRequest | null;
    onRewriteInsert?: (text: string, range: { from: number; to: number }) => Promise<void>;
    onRewriteClear?: () => void;
    editorRef?: React.RefObject<Editor | null>;
}) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const [showClearDialog, setShowClearDialog] = useState(false);
    const [rewriteResult, setRewriteResult] = useState<string>('');
    const [isRewriting, setIsRewriting] = useState(false);
    const [focusContent, setFocusContent] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load conversation history on mount
    useEffect(() => {
        if (deckId) {
            fetch(`/api/chat/history?deckId=${deckId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.messages && data.messages.length > 0) {
                        // Mark all loaded messages as historical (no typing animation)
                        const historicalMessages = data.messages.map((msg: Message) => ({
                            ...msg,
                            isHistorical: true
                        }));
                        setMessages(historicalMessages);
                    }
                })
                .catch(err => {
                    console.error('Failed to load chat history:', err);
                });
        }
    }, [deckId]);

    // MediaRecorder refs for voice recording
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const [isTranscribing, _setIsTranscribing] = useState(false); // Voice transcription loading state - setter unused but reserved

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
        };
    }, []);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const [activeCitation, setActiveCitation] = useState<string | null>(null);

    // Handle citation from text selection
    useEffect(() => {
        if (citation && citation.trim()) {
            // Store citation to display as a card, not in input
            setActiveCitation(citation);
            onCitationUsed?.();

            // Focus on input field if chat is open
            if (isOpen) {
                setTimeout(() => {
                    const inputElement = document.querySelector('input[placeholder*="Type a question"]') as HTMLInputElement;
                    if (inputElement) {
                        inputElement.focus();
                    }
                }, 100);
            }
        }
    }, [citation, onCitationUsed, isOpen]);

    const clearCitation = () => {
        setActiveCitation(null);
    };

    // Handle rewrite requests
    const fetchRewrite = useCallback(async (text: string, action: RewriteAction) => {
        setIsRewriting(true);
        setRewriteResult('');

        try {
            const response = await fetch('/api/rewrite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, action, deckId }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Rewrite API Error:', errorData);
                throw new Error(errorData.error || 'Failed to rewrite');
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (!line.trim()) continue;

                        // Handle AI SDK streaming format: 0:"text content"
                        if (line.startsWith('0:')) {
                            const jsonStr = line.slice(2);
                            try {
                                const parsedText = JSON.parse(jsonStr);
                                accumulated += parsedText;
                                setRewriteResult(accumulated);
                            } catch {
                                // If JSON parse fails, try raw text
                                const rawText = jsonStr.replace(/^"|"$/g, '');
                                accumulated += rawText;
                                setRewriteResult(accumulated);
                            }
                        } else if (!line.startsWith('e:') && !line.startsWith('d:')) {
                            // Plain text that's not a control message
                            accumulated += line;
                            setRewriteResult(accumulated);
                        }
                    }
                }
            }

            // Ensure final state is set
            if (accumulated) {
                setRewriteResult(accumulated);
            }
        } catch (error) {
            console.error('Rewrite error:', error);
            setRewriteResult('Failed to rewrite. Please try again.');
        } finally {
            setIsRewriting(false);
        }
    }, [deckId]);

    // Trigger rewrite when request changes
    useEffect(() => {
        if (rewriteRequest) {
            fetchRewrite(rewriteRequest.text, rewriteRequest.action);
        } else {
            setRewriteResult('');
        }
    }, [rewriteRequest, fetchRewrite]);

    const handleRewriteInsert = async () => {
        if (rewriteRequest && rewriteResult && onRewriteInsert) {
            await onRewriteInsert(rewriteResult, rewriteRequest.range);
            onRewriteClear?.();
        }
    };

    const handleRewriteRetry = () => {
        if (rewriteRequest) {
            fetchRewrite(rewriteRequest.text, rewriteRequest.action);
        }
    };

    const handleRewriteDismiss = () => {
        onRewriteClear?.();
        setRewriteResult('');
    };

    // Voice recording handlers - using MediaRecorder + Groq Whisper for high accuracy
    const getSupportedMimeType = (): string => {
        const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
        for (const type of types) {
            if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type;
        }
        return 'audio/webm';
    };

    const toggleRecording = async () => {
        if (isRecording) {
            // Stop recording
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            setIsRecording(false);
        } else {
            // Start recording
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                });
                streamRef.current = stream;
                audioChunksRef.current = [];

                const mimeType = getSupportedMimeType();
                const mediaRecorder = new MediaRecorder(stream, { mimeType });
                mediaRecorderRef.current = mediaRecorder;

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunksRef.current.push(event.data);
                    }
                };

                mediaRecorder.onstop = async () => {
                    // Stop all tracks
                    stream.getTracks().forEach(t => t.stop());

                    // Create audio blob
                    const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

                    if (audioBlob.size < 1000) {
                        // Too short, ignore
                        return;
                    }

                    // Transcribe with Groq Whisper
                    _setIsTranscribing(true);
                    try {
                        const arrayBuffer = await audioBlob.arrayBuffer();
                        const base64 = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));

                        const response = await fetch('/api/voice-transcribe', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ audio: base64, mimeType }),
                        });

                        if (response.ok) {
                            const data = await response.json();
                            if (data.transcript?.trim()) {
                                setInput(prev => prev ? prev + ' ' + data.transcript : data.transcript);
                            }
                        } else {
                            console.error('Transcription failed');
                        }
                    } catch (err) {
                        console.error('Voice transcription error:', err);
                    } finally {
                        _setIsTranscribing(false);
                    }
                };

                mediaRecorder.start();
                setIsRecording(true);
            } catch (err) {
                console.error('Microphone error:', err);
                alert('Could not access microphone. Please check permissions.');
            }
        }
    };

    // File attachment handlers
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        setAttachedFiles(prev => [...prev, ...files]);
    };

    const removeFile = (index: number) => {
        setAttachedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleClearHistory = async () => {
        try {
            const res = await fetch(`/api/chat/history?deckId=${deckId}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                setMessages([]);
                setShowClearDialog(false);
            } else {
                console.error('Failed to clear history');
            }
        } catch (error) {
            console.error('Error clearing history:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput(''); // Clear input immediately

        // Add user message to UI with citation stored separately
        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: userMessage,
            citation: activeCitation || undefined, // Store citation separately
        };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        // Clear citation after using it
        setActiveCitation(null);

        // Build message content for API (still needs merged format for AI context)
        let apiMessageContent = userMessage;
        if (userMsg.citation) {
            apiMessageContent = `> "${userMsg.citation}"\n\n${userMessage}`;
        }

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{
                        role: 'user',
                        content: apiMessageContent,
                        citation: userMsg.citation // Send citation separately for DB storage
                    }],
                    context,
                    deckId,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Chat API Error Response:', errorData);
                throw new Error(errorData.details || 'Failed to get response');
            }

            // Add empty assistant message that will be filled
            const assistantMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: '',
                isStreaming: true, // Mark as streaming
            };
            setMessages(prev => [...prev, assistantMsg]);

            // Read the streaming response
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (reader) {
                let accumulatedText = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');

                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        if (!line.trim()) continue;

                        let textToAdd = '';

                        if (line.startsWith('0:')) {
                            const jsonStr = line.slice(2);
                            try {
                                // JSON.parse should convert \n to actual newlines
                                textToAdd = JSON.parse(jsonStr);
                            } catch {
                                // Fallback: manually unescape common sequences
                                textToAdd = jsonStr
                                    .replace(/^"|"$/g, '')        // Remove quotes
                                    .replace(/\\n/g, '\n')         // Unescape newlines
                                    .replace(/\\t/g, '\t')         // Unescape tabs
                                    .replace(/\\"/g, '"')          // Unescape quotes
                                    .replace(/\\\\/g, '\\');       // Unescape backslashes
                            }
                        } else if (!line.startsWith('e:') && !line.startsWith('d:')) {
                            textToAdd = line;
                            // CRITICAL: Add newline back if we split it out
                            if (i < lines.length - 1) {
                                textToAdd += '\n';
                            }
                        }

                        if (textToAdd) {
                            accumulatedText += textToAdd;

                            // Update state with the full accumulated text
                            // This ensures markdown is always parsed with complete content
                            setMessages(prev => {
                                const newMessages = [...prev];
                                const lastMsg = newMessages[newMessages.length - 1];
                                if (lastMsg && lastMsg.role === 'assistant') {
                                    newMessages[newMessages.length - 1] = {
                                        ...lastMsg,
                                        content: accumulatedText
                                    };
                                }
                                return newMessages;
                            });
                        }
                    }
                }

                // Mark streaming as complete
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMsg = newMessages[newMessages.length - 1];
                    if (lastMsg && lastMsg.role === 'assistant') {
                        newMessages[newMessages.length - 1] = {
                            ...lastMsg,
                            isStreaming: false
                        };
                    }
                    return newMessages;
                });
            }
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => prev.slice(0, -1));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* Toggle Button - Middle Right */}
            <div className={cn(
                "fixed top-1/2 right-0 z-50 transform -translate-y-1/2 transition-all duration-300",
                isOpen ? "translate-x-full opacity-0" : "translate-x-0 opacity-100"
            )}>
                <Button
                    onClick={onToggle}
                    className="h-12 w-10 rounded-l-xl rounded-r-none shadow-lg bg-linear-to-r from-(--brand-primary) to-(--brand-secondary) hover:from-(--brand-primary-dark) hover:to-(--brand-primary) text-white flex items-center justify-center"
                >
                    <Bot className="h-5 w-5" />
                </Button>
            </div>

            {/* Chat Sidebar */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed top-16 right-0 bottom-0 z-40 w-[400px] bg-background border-l border-border flex flex-col shadow-2xl"
                    >
                        {/* Header - Toolbar Only */}
                        <div className="px-6 py-3 border-b border-border bg-background shrink-0">
                            <div className="flex items-center justify-between">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowClearDialog(true)}
                                    className="text-muted-foreground hover:text-destructive p-2 h-auto"
                                    title="Clear History"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onToggle}
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    Hide <ArrowRight className="w-4 h-4 ml-1" />
                                </Button>
                            </div>
                        </div>

                        {/* Messages - Scrollable */}
                        <div className="flex-1 overflow-y-auto p-6" ref={scrollRef}>
                            <div className="space-y-6">
                                {/* Intro Header - Scrollable with messages */}
                                <div className="pb-4 border-b border-border mb-2">
                                    <h2 className="font-heading text-2xl font-bold text-foreground mb-1">Hey, I&apos;m Skoowl AI</h2>
                                    <p className="text-muted-foreground text-sm">
                                        I can work with you on your doc and answer any questions!
                                    </p>
                                </div>

                                {messages.length === 0 && (
                                    <div className="text-center text-muted-foreground mt-6">
                                        <p className="text-sm">Type a question below to get started.</p>
                                    </div>
                                )}
                                {messages.map((m) => (
                                    <div
                                        key={m.id}
                                        className={cn(
                                            "flex flex-col w-full mb-6",
                                            m.role === 'user' ? "items-end" : "items-start"
                                        )}
                                    >
                                        {/* Citation Display (Outside Bubble) */}
                                        {m.citation && m.role === 'user' && (
                                            <div className="flex items-start gap-2 mb-2 max-w-[85%] opacity-80 hover:opacity-100 transition-opacity">
                                                <div className="mt-1.5">
                                                    <div className="w-3 h-3 border-l-2 border-b-2 border-muted-foreground rounded-bl-md" />
                                                </div>
                                                <p className="text-xs text-muted-foreground italic line-clamp-2 text-left bg-muted px-2 py-1 rounded">
                                                    &ldquo;{m.citation}&rdquo;
                                                </p>
                                            </div>
                                        )}

                                        <div
                                            className={cn(
                                                "max-w-[85%] w-fit rounded-2xl px-5 py-3 text-sm leading-relaxed relative group",
                                                m.role === 'user'
                                                    ? "bg-primary text-white self-end ml-auto"
                                                    : "bg-[#1e293b] text-white border border-slate-700 self-start mr-auto"
                                            )}
                                        >
                                            {/* Focus Read Button - Only for assistant messages */}
                                            {m.role === 'assistant' && m.content && !m.isStreaming && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setFocusContent(m.content);
                                                    }}
                                                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-background/80 text-muted-foreground hover:text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-all"
                                                    title="Focus Read"
                                                >
                                                    <Maximize2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}

                                            {/* Message content */}
                                            {m.role === 'assistant' ? (
                                                <TypingMessage
                                                    content={m.content}
                                                    isStreaming={m.isStreaming}
                                                    isHistorical={m.isHistorical}
                                                />
                                            ) : (
                                                <div className="whitespace-pre-wrap wrap-break-word">{m.content}</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex justify-start w-full">
                                        <div className="bg-muted border border-border rounded-2xl px-5 py-3 flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                            <span className="text-xs text-muted-foreground">Thinking...</span>
                                        </div>
                                    </div>
                                )}

                                {/* Rewrite Suggestion Card */}
                                {rewriteRequest && (
                                    <RewriteSuggestionCard
                                        originalText={rewriteRequest.text}
                                        rewrittenText={rewriteResult}
                                        action={rewriteRequest.action}
                                        isLoading={isRewriting}
                                        onInsert={handleRewriteInsert}
                                        onRetry={handleRewriteRetry}
                                        onDismiss={handleRewriteDismiss}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Input Bar - Fixed */}
                        <div className="p-4 bg-background border-t border-border shrink-0">
                            {/* Attached Files Display */}
                            {attachedFiles.length > 0 && (
                                <div className="mb-3 flex flex-wrap gap-2">
                                    {attachedFiles.map((file, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 text-xs"
                                        >
                                            <Paperclip className="w-3 h-3" />
                                            <span className="max-w-[150px] truncate">{file.name}</span>
                                            <button
                                                onClick={() => removeFile(index)}
                                                className="text-muted-foreground hover:text-destructive"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Recording Indicator */}
                            {isRecording && (
                                <div className="mb-2 flex items-center gap-2 text-xs text-destructive">
                                    <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
                                    <span>Recording... Speak now</span>
                                </div>
                            )}

                            {/* Transcribing Indicator */}
                            {isTranscribing && (
                                <div className="mb-2 flex items-center gap-2 text-xs text-primary">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>Transcribing...</span>
                                </div>
                            )}

                            {/* Citation Card */}
                            {activeCitation && (
                                <div className="mb-3 bg-muted border border-border rounded-lg p-3 flex items-start gap-3">
                                    <ArrowRight className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0 rotate-180" />
                                    <p className="text-sm text-foreground flex-1 line-clamp-3">
                                        &quot;{activeCitation}&quot;
                                    </p>
                                    <button
                                        onClick={clearCitation}
                                        className="text-muted-foreground hover:text-foreground shrink-0"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
                                {/* Hidden file input */}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    multiple
                                    className="hidden"
                                    accept="image/*,.pdf,.doc,.docx,.txt"
                                />

                                {/* File Attachment Button (Left) */}
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isLoading}
                                    className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 shrink-0"
                                >
                                    <Paperclip className="w-4 h-4" />
                                </Button>

                                {/* Text Input */}
                                <div className="flex-1 relative">
                                    <Input
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder={isRecording ? "Listening..." : "Type a question here..."}
                                        className={cn(
                                            "w-full bg-muted border-border text-foreground placeholder:text-muted-foreground rounded-xl pr-12 py-3 focus-visible:ring-primary/50 focus-visible:border-primary",
                                            isRecording && "border-destructive"
                                        )}
                                        disabled={isLoading}
                                    />

                                    {/* Send Button */}
                                    <Button
                                        type="submit"
                                        size="icon"
                                        disabled={isLoading || (!input.trim() && attachedFiles.length === 0)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg disabled:opacity-50"
                                    >
                                        <Send className="w-4 h-4" />
                                    </Button>
                                </div>

                                {/* Microphone Button (Right) */}
                                <Button
                                    type="button"
                                    size="icon"
                                    variant={isRecording ? "default" : "ghost"}
                                    onClick={toggleRecording}
                                    disabled={isLoading}
                                    className={cn(
                                        "h-9 w-9 shrink-0",
                                        isRecording
                                            ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                            : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                                    )}
                                >
                                    {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                                </Button>
                            </form>
                            <div className="text-center mt-2">
                                <p className="text-[10px] text-muted-foreground">
                                    AI can make mistakes. Check important info.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Clear History Confirmation Dialog */}
            <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
                <DialogContent className="sm:max-w-md bg-background border-border">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">Clear Chat History?</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Are you sure you want to delete all chat messages? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setShowClearDialog(false)}
                            className="border-border text-foreground hover:bg-muted"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleClearHistory}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Focus Read Modal */}
            <FocusReadModal
                isOpen={focusContent !== null}
                onClose={() => setFocusContent(null)}
                content={focusContent || ''}
                title="AI Response"
            />
        </>
    );
}
