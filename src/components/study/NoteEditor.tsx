'use client';

import { marked } from 'marked';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { cn } from '@/lib/utils';
import Highlight from '@tiptap/extension-highlight';
import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import {
    Bold, Italic, Underline as UnderlineIcon,
    Heading1, Heading2, Heading3,
    List, ListOrdered,
    Palette, Highlighter,
    Bot, Send
} from 'lucide-react';
import { toast } from 'sonner';
import { updateNotes } from '@/actions/updateNotes';
import { useEditorContext } from './EditorContext';

// Color palette for text and highlight pickers
const COLOR_PALETTE: string[][] = [
    ['#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff'],
    ['#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff'],
    ['#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc'],
    ['#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd'],
    ['#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0'],
];

interface NoteEditorProps {
    deckId: string;
    initialContent: string;
    isEditing?: boolean;
    onEditingChange?: (isEditing: boolean) => void;
}

interface NoteEditorRef {
    save: () => Promise<boolean>;
    cancel: () => void;
}

const NoteEditor = forwardRef<NoteEditorRef, NoteEditorProps>(({
    deckId,
    initialContent,
    isEditing = false
}, ref) => {
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showHighlightPicker, setShowHighlightPicker] = useState(false);

    const [content] = useState(() => {
        const trimmed = initialContent.trim();
        if (trimmed.startsWith('<') || trimmed.length === 0) {
            return initialContent;
        }
        return marked.parse(initialContent) as string;
    });

    const [savedContent, setSavedContent] = useState(content);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            TextAlign,
            TextStyle,
            Color,
            Highlight.configure({
                multicolor: true,
            }),
        ],
        content: savedContent,
        editorProps: {
            attributes: {
                class: 'prose prose-slate max-w-none dark:prose-invert focus:outline-none min-h-[500px] px-4 py-2',
            },
        },
        editable: isEditing,
        immediatelyRender: false,
    });

    const { setEditor } = useEditorContext();

    // Register editor with context for rewrite feature
    useEffect(() => {
        if (editor) {
            setEditor(editor);
        }
        return () => setEditor(null);
    }, [editor, setEditor]);

    useEffect(() => {
        if (editor) {
            editor.setEditable(isEditing);
        }
    }, [isEditing, editor]);

    // Expose save and cancel methods via ref
    useImperativeHandle(ref, () => ({
        save: async () => {
            if (!editor) return false;
            const html = editor.getHTML();
            const result = await updateNotes(deckId, html);
            if (result.success) {
                toast.success('Notes saved successfully');
                setSavedContent(html);
                return true;
            } else {
                toast.error('Failed to save notes');
                return false;
            }
        },
        cancel: () => {
            if (editor) {
                editor.commands.setContent(savedContent);
            }
        }
    }), [editor, deckId, savedContent]);

    // AI Chat & Send Functions
    const handleAskAI = () => {
        toast.info('AI Chat feature coming soon!');
    };

    const handleSend = () => {
        toast.info('Send feature coming soon!');
    };

    if (!editor) {
        return null;
    }

    return (
        <div className="relative">
            {isEditing && (
                <div className="sticky top-0 z-10 bg-background border-b border-border p-2 flex flex-wrap gap-2 items-center justify-center mb-4 rounded-t-lg">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        className={cn(editor.isActive('bold') && 'bg-muted')}
                    >
                        <Bold className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        className={cn(editor.isActive('italic') && 'bg-muted')}
                    >
                        <Italic className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        className={cn(editor.isActive('underline') && 'bg-muted')}
                    >
                        <UnderlineIcon className="w-4 h-4" />
                    </Button>

                    <div className="w-px h-6 bg-border" />

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                        className={cn(editor.isActive('heading', { level: 1 }) && 'bg-muted')}
                    >
                        <Heading1 className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        className={cn(editor.isActive('heading', { level: 2 }) && 'bg-muted')}
                    >
                        <Heading2 className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                        className={cn(editor.isActive('heading', { level: 3 }) && 'bg-muted')}
                    >
                        <Heading3 className="w-4 h-4" />
                    </Button>

                    <div className="w-px h-6 bg-border" />

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        className={cn(editor.isActive('bulletList') && 'bg-muted')}
                    >
                        <List className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        className={cn(editor.isActive('orderedList') && 'bg-muted')}
                    >
                        <ListOrdered className="w-4 h-4" />
                    </Button>

                    <div className="w-px h-6 bg-border" />

                    <div className="relative">
                        <button
                            onClick={() => {
                                setShowColorPicker(!showColorPicker);
                                setShowHighlightPicker(false);
                            }}
                            className="flex items-center gap-1 border border-border rounded px-2 py-1 hover:bg-muted"
                        >
                            <Palette className="w-4 h-4" />
                            <div className="w-6 h-6 rounded border border-border" style={{ backgroundColor: editor.getAttributes('textStyle').color || '#000000' }} />
                        </button>
                        {showColorPicker && (
                            <div className="absolute top-full mt-1 p-2 bg-card rounded-lg shadow-lg z-20 border border-border" style={{ width: '240px' }}>
                                <button
                                    onClick={() => {
                                        editor.chain().focus().unsetColor().run();
                                        setShowColorPicker(false);
                                    }}
                                    className="w-full mb-2 px-2 py-1 text-sm bg-muted hover:bg-muted/80 rounded text-foreground"
                                >
                                    Default Color
                                </button>
                                {COLOR_PALETTE.map((row: string[], i: number) => (
                                    <div key={i} className="flex gap-1 mb-1">
                                        {row.map((color: string) => (
                                            <button
                                                key={color}
                                                onClick={() => {
                                                    editor.chain().focus().setColor(color).run();
                                                    setShowColorPicker(false);
                                                }}
                                                className="w-5 h-5 rounded cursor-pointer hover:scale-110 transition-transform border border-border"
                                                style={{ backgroundColor: color }}
                                                title={color}
                                            />
                                        ))}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="relative">
                        <button
                            onClick={() => {
                                setShowHighlightPicker(!showHighlightPicker);
                                setShowColorPicker(false);
                            }}
                            className="flex items-center gap-1 border border-border rounded px-2 py-1 hover:bg-muted"
                        >
                            <Highlighter className="w-4 h-4" />
                            <div className="w-6 h-6 rounded border border-border" style={{ backgroundColor: editor.getAttributes('highlight').color || 'transparent' }} />
                            <span className="text-xs">None</span>
                        </button>
                        {showHighlightPicker && (
                            <div className="absolute top-full mt-1 p-2 bg-card rounded-lg shadow-lg z-20 border border-border" style={{ width: '240px' }}>
                                <button
                                    onClick={() => {
                                        editor.chain().focus().unsetHighlight().run();
                                        setShowHighlightPicker(false);
                                    }}
                                    className="w-full mb-2 px-2 py-1 text-sm bg-muted hover:bg-muted/80 rounded text-foreground"
                                >
                                    Clear Highlight
                                </button>
                                {COLOR_PALETTE.map((row: string[], i: number) => (
                                    <div key={i} className="flex gap-1 mb-1">
                                        {row.map((color: string) => (
                                            <button
                                                key={color}
                                                onClick={() => {
                                                    editor.chain().focus().setHighlight({ color }).run();
                                                    setShowHighlightPicker(false);
                                                }}
                                                className="w-5 h-5 rounded cursor-pointer hover:scale-110 transition-transform border border-border"
                                                style={{ backgroundColor: color }}
                                                title={color}
                                            />
                                        ))}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className={cn(
                "min-h-[500px] rounded-lg transition-all",
                isEditing && "border border-border bg-background shadow-sm"
            )}>
                <EditorContent editor={editor} />
            </div>
        </div >
    );
});

NoteEditor.displayName = 'NoteEditor';

export default NoteEditor;
