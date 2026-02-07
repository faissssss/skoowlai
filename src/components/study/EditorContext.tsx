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

    // Utility to strip ALL markdown formatting from AI output (aggressive cleanup)
    const stripMarkdownFormatting = (text: string): string => {
        let cleaned = text;

        // Remove ALL bold markers (**text** and __text__) - handle nested cases
        cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1');  // **bold** -> bold
        cleaned = cleaned.replace(/__(.+?)__/g, '$1');       // __bold__ -> bold

        // Remove ALL italic markers (*text* and _text_) - be careful with asterisks
        cleaned = cleaned.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '$1');  // *italic* -> italic
        cleaned = cleaned.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '$1');         // _italic_ -> italic

        // Remove markdown headers (# ## ### etc) at start of lines
        cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');

        // Remove quotes at start/end
        cleaned = cleaned.replace(/^["']|["']$/g, '');

        // Remove any stray ** or __ at start/end that weren't caught
        cleaned = cleaned.replace(/^[\*_]{1,2}|[\*_]{1,2}$/g, '');

        // Remove any remaining ** or __ anywhere (safety net)
        cleaned = cleaned.replace(/\*\*/g, '');
        cleaned = cleaned.replace(/__/g, '');

        return cleaned.trim();
    };

    const handleRewriteInsert = useCallback(async (newText: string, range: { from: number; to: number }) => {
        if (editorRef.current) {
            // Clean the text before inserting (remove unwanted markdown formatting)
            const cleanText = stripMarkdownFormatting(newText);

            // CRITICAL: Insert as explicit text node with NO marks
            // This prevents TipTap from inheriting bold/italic from surrounding text
            editorRef.current
                .chain()
                .focus()
                .setTextSelection(range)
                .unsetAllMarks() // CRITICAL: Clear marks from the range BEFORE replacing to break style continuity
                .insertContent({
                    type: 'text',
                    text: cleanText,
                    marks: [], // Explicitly NO formatting marks
                })
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
