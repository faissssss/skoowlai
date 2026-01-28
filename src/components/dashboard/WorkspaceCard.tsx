'use client';

import { useState } from 'react';
import { FolderOpen, MoreHorizontal, Trash2, Edit2, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';

interface Deck {
    id: string;
    title: string;
    sourceType: string | null;
    createdAt: Date;
}

interface Workspace {
    id: string;
    name: string;
    description?: string | null;
    color: string;
    decks: Deck[];
    _count: {
        decks: number;
    };
}

interface WorkspaceCardProps {
    workspace: Workspace;
    isSelected?: boolean;
    isDragOver?: boolean;
    onClick?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    onAddDecks?: () => void;
    onDragOver?: (e: React.DragEvent) => void;
    onDragLeave?: () => void;
    onDrop?: (e: React.DragEvent) => void;
}

export default function WorkspaceCard({
    workspace,
    isSelected,
    isDragOver,
    onClick,
    onEdit,
    onDelete,
    onAddDecks,
    onDragOver,
    onDragLeave,
    onDrop
}: WorkspaceCardProps) {
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowDeleteDialog(true);
    };

    const handleConfirmDelete = () => {
        setShowDeleteDialog(false);
        onDelete?.();
    };

    const handleAddDecksClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onAddDecks?.();
    };

    return (
        <>
            <motion.div
                whileHover={isDragOver ? {} : { y: -3, scale: 1.02 }}
                whileTap={isDragOver ? {} : { scale: 0.98 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                onClick={onClick}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={cn(
                    "relative bg-white dark:bg-slate-900 rounded-xl border p-6 cursor-pointer transition-all group h-full flex flex-col",
                    isDragOver
                        ? "border-indigo-500 ring-2 ring-indigo-500/40 shadow-lg shadow-indigo-500/20 scale-[1.02] bg-indigo-50/50 dark:bg-indigo-950/20"
                        : isSelected
                            ? "border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg shadow-indigo-500/10"
                            : "border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-xl hover:shadow-indigo-500/10"
                )}
            >
                {/* Header with icon and actions */}
                <div className="flex justify-between items-start mb-4">
                    <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: workspace.color }}
                    >
                        <FolderOpen className="w-5 h-5 text-white" />
                    </div>

                    {/* Actions dropdown - always visible for mobile accessibility */}
                    <div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <MoreHorizontal className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleAddDecksClick}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Decks
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit?.(); }}>
                                    <Edit2 className="w-4 h-4 mr-2" />
                                    Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={handleDeleteClick}
                                    className="text-red-600 dark:text-red-400"
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Name */}
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {workspace.name}
                </h3>

                {/* Description or deck count */}
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 line-clamp-2">
                    {workspace.description || `${workspace._count.decks} study ${workspace._count.decks === 1 ? 'deck' : 'decks'}`}
                </p>

                {/* Footer */}
                <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <span className="text-xs font-medium px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
                        {workspace._count.decks} {workspace._count.decks === 1 ? 'deck' : 'decks'}
                    </span>
                    <span className="text-xs text-slate-400 group-hover:text-indigo-500 transition-colors">
                        Click to view →
                    </span>
                </div>
            </motion.div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete "{workspace.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {workspace._count.decks > 0 ? (
                                <>
                                    This workspace contains <strong>{workspace._count.decks} study {workspace._count.decks === 1 ? 'deck' : 'decks'}</strong>.
                                    The decks will be unlinked but not deleted.
                                </>
                            ) : (
                                'This workspace will be permanently deleted.'
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Delete Workspace
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
