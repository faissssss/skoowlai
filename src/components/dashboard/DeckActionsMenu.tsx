'use client';

import { useState } from 'react';
import { MoreHorizontal, FolderPlus, FolderMinus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedDockButton } from '@/components/ui/animated-dock-button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
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
import { deleteDeck } from '@/actions/deleteDeck';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface Workspace {
    id: string;
    name: string;
    color: string;
}

interface DeckActionsMenuProps {
    deckId: string;
    currentWorkspaceId?: string | null;
    workspaces: Workspace[];
    onWorkspaceChange?: () => void;
}

export default function DeckActionsMenu({
    deckId,
    currentWorkspaceId,
    workspaces,
    onWorkspaceChange
}: DeckActionsMenuProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [isMoving, setIsMoving] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const router = useRouter();

    const handleAddToWorkspace = async (workspaceId: string) => {
        setIsMoving(true);
        try {
            const res = await fetch(`/api/workspaces/${workspaceId}/decks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deckIds: [deckId] })
            });

            if (res.ok) {
                toast.success('Added to workspace');
                onWorkspaceChange?.();
                router.refresh();
            } else {
                toast.error('Failed to add to workspace');
            }
        } catch (error) {
            console.error('Error adding to workspace:', error);
            toast.error('Failed to add to workspace');
        } finally {
            setIsMoving(false);
        }
    };

    const handleRemoveFromWorkspace = async () => {
        if (!currentWorkspaceId) return;

        setIsMoving(true);
        try {
            const res = await fetch(`/api/workspaces/${currentWorkspaceId}/decks`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deckIds: [deckId] })
            });

            if (res.ok) {
                toast.success('Removed from workspace');
                onWorkspaceChange?.();
                router.refresh();
            } else {
                toast.error('Failed to remove from workspace');
            }
        } catch (error) {
            console.error('Error removing from workspace:', error);
            toast.error('Failed to remove from workspace');
        } finally {
            setIsMoving(false);
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const result = await deleteDeck(deckId);
            if (result.success) {
                setShowDeleteDialog(false);
                onWorkspaceChange?.(); // Refresh workspaces to remove deleted deck
                router.refresh();
            } else {
                toast.error('Failed to delete deck');
                setIsDeleting(false);
            }
        } catch (error) {
            console.error('Error deleting deck:', error);
            toast.error('An unexpected error occurred');
            setIsDeleting(false);
        }
    };

    const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId);
    const availableWorkspaces = workspaces.filter(w => w.id !== currentWorkspaceId);

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <div onClick={(e) => e.stopPropagation()}>
                        <AnimatedDockButton>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            >
                                {isMoving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <MoreHorizontal className="w-4 h-4" />
                                )}
                            </Button>
                        </AnimatedDockButton>
                    </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    {/* Add to Workspace submenu */}
                    {availableWorkspaces.length > 0 && (
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                <FolderPlus className="w-4 h-4 mr-2" />
                                {currentWorkspaceId ? 'Move to Workspace' : 'Add to Workspace'}
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                                {availableWorkspaces.map((workspace) => (
                                    <DropdownMenuItem
                                        key={workspace.id}
                                        onClick={() => handleAddToWorkspace(workspace.id)}
                                    >
                                        <div
                                            className="w-3 h-3 rounded-full mr-2"
                                            style={{ backgroundColor: workspace.color }}
                                        />
                                        {workspace.name}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                    )}

                    {/* Remove from workspace */}
                    {currentWorkspaceId && (
                        <DropdownMenuItem onClick={handleRemoveFromWorkspace}>
                            <FolderMinus className="w-4 h-4 mr-2" />
                            Remove from "{currentWorkspace?.name}"
                        </DropdownMenuItem>
                    )}

                    {(availableWorkspaces.length > 0 || currentWorkspaceId) && (
                        <DropdownMenuSeparator />
                    )}

                    {/* Delete */}
                    <DropdownMenuItem
                        onClick={() => setShowDeleteDialog(true)}
                        className="text-red-600 dark:text-red-400"
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Delete confirmation dialog */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete this study set and all its notes, flashcards, and quizzes.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-red-600 hover:bg-red-700 text-white"
                            disabled={isDeleting}
                        >
                            {isDeleting ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
