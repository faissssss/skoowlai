'use client';

import { createContext, useContext, useRef, useCallback, useState, ReactNode } from 'react';
import type { Editor } from '@tiptap/core';
import type { RewriteAction } from './TextSelectionPopup';
import { updateNotes } from '@/actions/updateNotes';
import { toast } from 'sonner';

export interface RewriteRequest {
    text: string;
    action: RewriteAction;
    range: { from: number; to: number };
}

interface EditorContextType {
    editorRef: React.RefObject<Editor | null>;
    setEditor: (editor: Editor | null) => void;
    rewriteRequest: RewriteRequest | null;
    setRewriteRequest: (request: RewriteRequest | null) => void;
    handleRewriteInsert: (newText: string, range: { from: number; to: number }) => Promise<void>;
    deckId: string | null;
    setDeckId: (id: string | null) => void;
}

const EditorContext = createContext<EditorContextType | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
    const editorRef = useRef<Editor | null>(null);
    const [rewriteRequest, setRewriteRequest] = useState<RewriteRequest | null>(null);
    const [deckId, setDeckId] = useState<string | null>(null);

    const setEditor = useCallback((editor: Editor | null) => {
        editorRef.current = editor;
    }, []);

    // Utility to strip markdown formatting from AI output (safety net)
    const stripMarkdownFormatting = (text: string): string => {
        return text
            .replace(/^\*\*|\*\*$/g, '')   // Remove ** at start/end (bold)
            .replace(/^__|\__$/g, '')      // Remove __ at start/end (bold alt)
            .replace(/^\*([^*]+)\*$/g, '$1') // Remove single * wrapper (italics)
            .replace(/^_([^_]+)_$/g, '$1')   // Remove single _ wrapper (italics alt)
            .replace(/^"|"$/g, '')         // Remove quotes at start/end
            .replace(/^'|'$/g, '')         // Remove single quotes at start/end
            .trim();
    };

    const handleRewriteInsert = useCallback(async (newText: string, range: { from: number; to: number }) => {
        if (editorRef.current) {
            // Clean the text before inserting (remove unwanted markdown formatting)
            const cleanText = stripMarkdownFormatting(newText);

            // Insert the cleaned text
            editorRef.current
                .chain()
                .focus()
                .setTextSelection(range)
                .insertContent(cleanText)
                .run();

            // Auto-save the notes
            if (deckId) {
                const html = editorRef.current.getHTML();
                const result = await updateNotes(deckId, html);
                if (result.success) {
                    toast.success('Text replaced and notes saved');
                } else {
                    toast.error('Text replaced but failed to save notes');
                }
            }
        }
    }, [deckId]);

    return (
        <EditorContext.Provider value={{
            editorRef,
            setEditor,
            rewriteRequest,
            setRewriteRequest,
            handleRewriteInsert,
            deckId,
            setDeckId
        }}>
            {children}
        </EditorContext.Provider>
    );
}

export function useEditorContext() {
    const context = useContext(EditorContext);
    if (!context) {
        throw new Error('useEditorContext must be used within an EditorProvider');
    }
    return context;
}
