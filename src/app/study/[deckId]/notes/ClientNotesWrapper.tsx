'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Edit2, Save, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import NoteEditor from '@/components/study/NoteEditor';
import { AnimatedDockButton } from '@/components/ui/animated-dock-button';

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
                    <div className="w-10 h-10 bg-linear-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center">
                        <FileText className="w-5 h-5 text-(--brand-accent)" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground">Smart Notes</h2>
                        <p className="text-sm text-muted-foreground">
                            Your AI-generated study materials
                        </p>
                    </div>
                </div>

                {/* Edit/Save/Cancel Buttons */}
                <AnimatePresence mode="wait">
                    {isEditing ? (
                        <motion.div
                            key="editing"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            layout
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            className="flex gap-2 overflow-hidden"
                        >
                            <AnimatedDockButton>
                                <Button
                                    variant="outline"
                                    onClick={handleCancel}
                                    disabled={isSaving}
                                    className="shrink-0 border-border hover:border-primary/50 hover:text-primary active:border-primary transition-colors"
                                >
                                    <X className="w-4 h-4 mr-2" />
                                    Cancel
                                </Button>
                            </AnimatedDockButton>
                            <AnimatedDockButton>
                                <Button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 border border-transparent hover:border-primary/50 active:border-primary/30 transition-colors"
                                >
                                    {isSaving ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4 mr-2" />
                                    )}
                                    Save
                                </Button>
                            </AnimatedDockButton>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="view"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            layout
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        >
                            <AnimatedDockButton>
                                <Button
                                    variant="outline"
                                    onClick={() => setIsEditing(true)}
                                >
                                    <Edit2 className="w-4 h-4" />
                                    Edit Notes
                                </Button>
                            </AnimatedDockButton>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Notes Content */}
            <div className="bg-card rounded-2xl shadow-sm border border-border p-8 md:p-10 min-h-[700px]">
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
