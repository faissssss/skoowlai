'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FolderPlus, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface CreateWorkspaceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: (workspace: {
        id: string;
        name: string;
        description?: string;
        color: string;
        _count: { decks: number };
    }) => void;
}

const COLORS = [
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#ef4444', // Red
    '#f97316', // Orange
    '#eab308', // Yellow
    '#22c55e', // Green
    '#14b8a6', // Teal
    '#0ea5e9', // Sky
    '#3b82f6', // Blue
];

export default function CreateWorkspaceModal({ isOpen, onClose, onCreated }: CreateWorkspaceModalProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState(COLORS[0]);
    const [isLoading, setIsLoading] = useState(false);

    const handleCreate = async () => {
        if (!name.trim()) {
            toast.error('Please enter a workspace name');
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch('/api/workspaces', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), description: description.trim(), color }),
            });

            if (!response.ok) {
                throw new Error('Failed to create workspace');
            }

            const data = await response.json();
            toast.success('Workspace created!');
            onCreated(data.workspace);
            handleClose();
        } catch (error) {
            console.error('Error creating workspace:', error);
            toast.error('Failed to create workspace');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setName('');
        setDescription('');
        setColor(COLORS[0]);
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                    onClick={handleClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-md bg-card rounded-2xl shadow-xl border border-border overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{ backgroundColor: color }}
                                >
                                    <FolderPlus className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-foreground">Create Workspace</h2>
                                    <p className="text-sm text-muted-foreground">Group your study decks</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={handleClose}>
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-5">
                            {/* Name */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">
                                    Workspace Name <span className="text-destructive">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g., Biology 101, Exam Prep"
                                    className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">
                                    Description <span className="text-muted-foreground">(optional)</span>
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="What's this workspace for?"
                                    rows={2}
                                    className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                                />
                            </div>

                            {/* Color Picker */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Color</label>
                                <div className="flex gap-2 flex-wrap">
                                    {COLORS.map((c) => (
                                        <button
                                            key={c}
                                            onClick={() => setColor(c)}
                                            className={`w-8 h-8 rounded-lg transition-all ${color === c
                                                    ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110'
                                                    : 'hover:scale-105'
                                                }`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex justify-between gap-3 p-6 bg-muted/50 border-t border-border">
                            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                                Cancel
                            </Button>
                            <div className="flex justify-end">
                                <Button
                                    onClick={handleCreate}
                                    disabled={isLoading || !name.trim()}
                                    className="bg-primary hover:bg-primary/90 text-white"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <FolderPlus className="w-4 h-4 mr-2" />
                                            Create Workspace
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
