'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { marked } from 'marked';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import { Extension } from '@tiptap/core';
import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import {
    Bold, Italic, Underline as UnderlineIcon,
    Heading1, Heading2, Heading3,
    List, ListOrdered,
    Save, Edit2, X, Loader2,
    Palette, Highlighter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { updateNotes } from '@/actions/updateNotes';
import { toast } from 'sonner';
import { useEditorContext } from './EditorContext';
import { motion, AnimatePresence } from 'framer-motion';

interface NoteEditorProps {
    deckId: string;
    initialContent: string;
    isEditing?: boolean;
    onEditingChange?: (editing: boolean) => void;
}

export interface NoteEditorHandle {
    save: () => Promise<boolean>;
    cancel: () => void;
}

// Custom FontSize extension
const FontSize = Extension.create({
    name: 'fontSize',
    addOptions() {
        return {
            types: ['textStyle'],
        };
    },
    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    fontSize: {
                        default: null,
                        parseHTML: element => element.style.fontSize || null,
                        renderHTML: attributes => {
                            if (!attributes.fontSize) {
                                return {};
                            }
                            return {
                                style: `font-size: ${attributes.fontSize}`,
                            };
                        },
                    },
                },
            },
        ];
    },
    addCommands() {
        return {
            setFontSize: (fontSize: string) => ({ chain }) => {
                return chain()
                    .setMark('textStyle', { fontSize })
                    .run();
            },
            unsetFontSize: () => ({ chain }) => {
                return chain()
                    .setMark('textStyle', { fontSize: null })
                    .removeEmptyTextStyle()
                    .run();
            },
        };
    },
});

const COLOR_PALETTE = [
    ['#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff'],
    ['#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff'],
    ['#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc'],
    ['#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd'],
    ['#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0'],
];

const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(({
    deckId,
    initialContent,
    isEditing: externalIsEditing,
    onEditingChange
}, ref) => {
    const { setEditor } = useEditorContext();
    // Use external editing state if provided, otherwise use internal
    const [internalIsEditing, setInternalIsEditing] = useState(false);
    const isEditing = externalIsEditing !== undefined ? externalIsEditing : internalIsEditing;
    const setIsEditing = onEditingChange || setInternalIsEditing;

    const [isSaving, setIsSaving] = useState(false);
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
            TextStyle,
            FontSize,
            Color,
            FontFamily.configure({
                types: ['textStyle'],
            }),
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

    useEffect(() => {
        if (editor) {
            editor.setEditable(isEditing);
        }
    }, [isEditing, editor]);

    // Expose editor to parent via context
    useEffect(() => {
        if (editor) {
            setEditor(editor);
        }
        return () => setEditor(null);
    }, [editor, setEditor]);

    // Expose save and cancel methods via ref
    useImperativeHandle(ref, () => ({
        save: async () => {
            if (!editor) return false;
            setIsSaving(true);
            const html = editor.getHTML();
            const result = await updateNotes(deckId, html);
            if (result.success) {
                toast.success('Notes saved successfully');
                setSavedContent(html);
                setIsSaving(false);
                return true;
            } else {
                toast.error('Failed to save notes');
                setIsSaving(false);
                return false;
            }
        },
        cancel: () => {
            if (editor) {
                editor.commands.setContent(savedContent);
            }
        }
    }), [editor, deckId, savedContent]);

    const handleSave = async (): Promise<boolean> => {
        if (!editor) return false;

        setIsSaving(true);
        const html = editor.getHTML();

        const result = await updateNotes(deckId, html);

        if (result.success) {
            toast.success('Notes saved successfully');
            setSavedContent(html);
            setIsEditing(false);
            setIsSaving(false);
            return true;
        } else {
            toast.error('Failed to save notes');
            setIsSaving(false);
            return false;
        }
    };

    if (!editor) {
        return null;
    }

    return (
        <div className="relative">
            {isEditing && (
                <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-2 flex flex-wrap gap-2 items-center mb-4 rounded-t-lg">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        className={cn(editor.isActive('bold') && 'bg-slate-100 dark:bg-slate-800')}
                    >
                        <Bold className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        className={cn(editor.isActive('italic') && 'bg-slate-100 dark:bg-slate-800')}
                    >
                        <Italic className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        className={cn(editor.isActive('underline') && 'bg-slate-100 dark:bg-slate-800')}
                    >
                        <UnderlineIcon className="w-4 h-4" />
                    </Button>

                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-800" />

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                        className={cn(editor.isActive('heading', { level: 1 }) && 'bg-slate-100 dark:bg-slate-800')}
                    >
                        <Heading1 className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        className={cn(editor.isActive('heading', { level: 2 }) && 'bg-slate-100 dark:bg-slate-800')}
                    >
                        <Heading2 className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                        className={cn(editor.isActive('heading', { level: 3 }) && 'bg-slate-100 dark:bg-slate-800')}
                    >
                        <Heading3 className="w-4 h-4" />
                    </Button>

                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-800" />

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        className={cn(editor.isActive('bulletList') && 'bg-slate-100 dark:bg-slate-800')}
                    >
                        <List className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        className={cn(editor.isActive('orderedList') && 'bg-slate-100 dark:bg-slate-800')}
                    >
                        <ListOrdered className="w-4 h-4" />
                    </Button>

                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-800" />

                    <select
                        onChange={(e) => {
                            const font = e.target.value;
                            if (font) {
                                editor.chain().focus().setFontFamily(font).run();
                            } else {
                                editor.chain().focus().unsetFontFamily().run();
                            }
                        }}
                        className="text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900"
                    >
                        <option value="">Font</option>
                        <option value="Arial" style={{ fontFamily: 'Arial' }}>Arial</option>
                        <option value="'Times New Roman'" style={{ fontFamily: 'Times New Roman' }}>Times New Roman</option>
                        <option value="'Courier New'" style={{ fontFamily: 'Courier New' }}>Courier New</option>
                        <option value="Georgia" style={{ fontFamily: 'Georgia' }}>Georgia</option>
                        <option value="Verdana" style={{ fontFamily: 'Verdana' }}>Verdana</option>
                    </select>

                    <select
                        onChange={(e) => {
                            const size = e.target.value;
                            if (size) {
                                editor.chain().focus().setFontSize(size + 'px').run();
                            }
                        }}
                        className="text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-900"
                    >
                        <option value="">Size</option>
                        <option value="12">12</option>
                        <option value="14">14</option>
                        <option value="16">16</option>
                        <option value="18">18</option>
                        <option value="20">20</option>
                        <option value="24">24</option>
                        <option value="28">28</option>
                        <option value="32">32</option>
                    </select>

                    <div className="relative">
                        <button
                            onClick={() => {
                                setShowColorPicker(!showColorPicker);
                                setShowHighlightPicker(false);
                            }}
                            className="flex items-center gap-1 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                            <Palette className="w-4 h-4" />
                            <div className="w-6 h-6 rounded border border-slate-300" style={{ backgroundColor: editor.getAttributes('textStyle').color || '#000000' }} />
                        </button>
                        {showColorPicker && (
                            <div className="absolute top-full mt-1 p-2 bg-slate-900 rounded-lg shadow-lg z-20" style={{ width: '240px' }}>
                                <button
                                    onClick={() => {
                                        editor.chain().focus().unsetColor().run();
                                        setShowColorPicker(false);
                                    }}
                                    className="w-full mb-2 px-2 py-1 text-sm bg-slate-800 hover:bg-slate-700 rounded text-white"
                                >
                                    Default Color
                                </button>
                                {COLOR_PALETTE.map((row, i) => (
                                    <div key={i} className="flex gap-1 mb-1">
                                        {row.map((color) => (
                                            <button
                                                key={color}
                                                onClick={() => {
                                                    editor.chain().focus().setColor(color).run();
                                                    setShowColorPicker(false);
                                                }}
                                                className="w-5 h-5 rounded cursor-pointer hover:scale-110 transition-transform border border-slate-700"
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
                            className="flex items-center gap-1 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                            <Highlighter className="w-4 h-4" />
                            <div className="w-6 h-6 rounded border border-slate-300" style={{ backgroundColor: editor.getAttributes('highlight').color || 'transparent' }} />
                            <span className="text-xs">None</span>
                        </button>
                        {showHighlightPicker && (
                            <div className="absolute top-full mt-1 p-2 bg-slate-900 rounded-lg shadow-lg z-20" style={{ width: '240px' }}>
                                <button
                                    onClick={() => {
                                        editor.chain().focus().unsetHighlight().run();
                                        setShowHighlightPicker(false);
                                    }}
                                    className="w-full mb-2 px-2 py-1 text-sm bg-slate-800 hover:bg-slate-700 rounded text-white"
                                >
                                    Clear Highlight
                                </button>
                                {COLOR_PALETTE.map((row, i) => (
                                    <div key={i} className="flex gap-1 mb-1">
                                        {row.map((color) => (
                                            <button
                                                key={color}
                                                onClick={() => {
                                                    editor.chain().focus().setHighlight({ color }).run();
                                                    setShowHighlightPicker(false);
                                                }}
                                                className="w-5 h-5 rounded cursor-pointer hover:scale-110 transition-transform border border-slate-700"
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
                isEditing && "border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm"
            )}>
                <EditorContent editor={editor} />
            </div>
        </div>
    );
});

NoteEditor.displayName = 'NoteEditor';

export default NoteEditor;
