'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

export default function EmbeddedChat({ context, deckId }: { context: string; deckId: string }) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Load conversation history on mount
    useEffect(() => {
        if (deckId) {
            fetch(`/api/chat/history?deckId=${deckId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.messages && data.messages.length > 0) {
                        setMessages(data.messages);
                    }
                })
                .catch(err => {
                    console.error('Failed to load chat history:', err);
                });
        }
    }, [deckId]);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput(''); // Clear input immediately

        // Add user message to UI immediately
        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: userMessage,
        };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: userMessage }],
                    context,
                    deckId,
                }),
            });

            if (!response.ok) throw new Error('Failed to get response');

            // Add empty assistant message that will be filled
            const assistantMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: '',
            };
            setMessages(prev => [...prev, assistantMsg]);

            // Read the streaming response
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (reader) {
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('0:')) {
                            const jsonStr = line.slice(2);
                            try {
                                const text = JSON.parse(jsonStr);
                                setMessages(prev => {
                                    const newMessages = [...prev];
                                    const lastMsg = newMessages[newMessages.length - 1];
                                    if (lastMsg && lastMsg.role === 'assistant') {
                                        newMessages[newMessages.length - 1] = {
                                            ...lastMsg,
                                            content: lastMsg.content + text
                                        };
                                    }
                                    return newMessages;
                                });
                            } catch {
                                // Ignore parse errors
                            }
                        }
                    }
                }

                // Process remaining buffer
                if (buffer && buffer.startsWith('0:')) {
                    const jsonStr = buffer.slice(2);
                    try {
                        const text = JSON.parse(jsonStr);
                        setMessages(prev => {
                            const newMessages = [...prev];
                            const lastMsg = newMessages[newMessages.length - 1];
                            if (lastMsg && lastMsg.role === 'assistant') {
                                newMessages[newMessages.length - 1] = {
                                    ...lastMsg,
                                    content: lastMsg.content + text
                                };
                            }
                            return newMessages;
                        });
                    } catch {
                        // Ignore parse errors
                    }
                }
            }
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => prev.slice(0, -1));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            {/* Header */}
            <div className="p-4 border-b border-border bg-muted/30">
                <h2 className="font-semibold text-foreground">Chat Assistant</h2>
                <p className="text-xs text-muted-foreground">Ask questions about your document</p>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-4">
                    {messages.length === 0 && (
                        <div className="text-center text-muted-foreground mt-10">
                            <p className="text-sm">Type a question below to get started.</p>
                        </div>
                    )}
                    {messages.map((m) => (
                        <div
                            key={m.id}
                            className={cn(
                                "flex w-full",
                                m.role === 'user' ? "justify-end" : "justify-start"
                            )}
                        >
                            <div
                                className={cn(
                                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                                    m.role === 'user'
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-foreground border border-border"
                                )}
                            >
                                {m.content}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start w-full">
                            <div className="bg-muted border border-border rounded-2xl px-4 py-2.5 flex items-center gap-2">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                                <span className="text-xs text-muted-foreground">Thinking...</span>
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 bg-card border-t border-border">
                <form onSubmit={handleSubmit} className="relative">
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask a question..."
                        className="w-full bg-muted/50 border-input text-foreground placeholder:text-muted-foreground rounded-xl pr-10 py-5 focus-visible:ring-ring"
                        disabled={isLoading}
                    />
                    <Button
                        type="submit"
                        size="icon"
                        disabled={isLoading || !input.trim()}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Send className="w-3.5 h-3.5" />
                    </Button>
                </form>
            </div>
        </div>
    );
}
