'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Edit2, Save, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import NoteEditor from '@/components/study/NoteEditor';

interface ClientNotesWrapperProps {
    deckId: string;
    initialContent: string;
}

export default function ClientNotesWrapper({ deckId, initialContent }: ClientNotesWrapperProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const editorRef = useRef<{ save: () => Promise<boolean>; cancel: () => void } | null>(null);

    const handleSave = async () => {
        if (editorRef.current) {
            setIsSaving(true);
            const success = await editorRef.current.save();
            setIsSaving(false);
            if (success) {
                setIsEditing(false);
            }
        }
    };

    const handleCancel = () => {
        if (editorRef.current) {
            editorRef.current.cancel();
        }
        setIsEditing(false);
    };

    return (
        <div className="space-y-4">
            {/* Header with Edit Button */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                        <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Study Notes</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Your AI-generated study materials
                        </p>
                    </div>
                </div>

                {/* Edit/Save/Cancel Buttons */}
                <AnimatePresence mode="wait">
                    {isEditing ? (
                        <motion.div
                            key="editing"
                            initial={{ width: 48, opacity: 0 }}
                            animate={{ width: 'auto', opacity: 1 }}
                            exit={{ width: 48, opacity: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="flex gap-2 overflow-hidden"
                        >
                            <Button
                                variant="outline"
                                onClick={handleCancel}
                                disabled={isSaving}
                                className="shrink-0"
                            >
                                <X className="w-4 h-4 mr-2" />
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                            >
                                {isSaving ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4 mr-2" />
                                )}
                                Save
                            </Button>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="view"
                            initial={{ width: 'auto', opacity: 0 }}
                            animate={{ width: 'auto', opacity: 1 }}
                            exit={{ width: 48, opacity: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                        >
                            <Button
                                variant="outline"
                                onClick={() => setIsEditing(true)}
                                className="gap-2"
                            >
                                <Edit2 className="w-4 h-4" />
                                Edit Notes
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Notes Content */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 md:p-10 min-h-[700px]">
                <NoteEditor
                    ref={editorRef}
                    deckId={deckId}
                    initialContent={initialContent}
                    isEditing={isEditing}
                    onEditingChange={setIsEditing}
                />
            </div>
        </div>
    );
}
