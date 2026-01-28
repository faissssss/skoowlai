'use client';

import { useUser } from '@clerk/nextjs';

import { AnimatedDockButton } from '@/components/ui/animated-dock-button';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
    CheckSquare, Square, Share2, MoreVertical,
    BookOpen, BookCopy, Mic, Youtube, FileText,
    Library, ChevronRight, Upload,
    Search, FolderPlus, FolderOpen, X, Clock
} from 'lucide-react';
import FileUpload from '@/components/study/FileUpload';
import LiveAudioRecorder from '@/components/study/LiveAudioRecorder';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
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
import DeckActionsMenu from '@/components/dashboard/DeckActionsMenu';
import { cn } from '@/lib/utils';
import { useGlobalLoader } from '@/contexts/LoaderContext';
import { toast } from 'sonner';
import NoteConfigModal from '@/components/NoteConfigModal';
import { NoteConfig } from '@/lib/noteConfig/types';
import UsageLimitModal from '@/components/UsageLimitModal';

import CreateWorkspaceModal from '@/components/dashboard/CreateWorkspaceModal';
import EditWorkspaceModal from '@/components/dashboard/EditWorkspaceModal';
import WorkspaceDetailModal from '@/components/dashboard/WorkspaceDetailModal';
import WorkspaceCard from '@/components/dashboard/WorkspaceCard';
import OptionsMenu from '@/components/dashboard/OptionsMenu';
import { DraggableCardContainer, DraggableCardBody } from '@/components/ui/draggable-card';

interface DashboardClientProps {
    decks: any[];
}

export default function DashboardClient({ decks }: DashboardClientProps) {
    const { user } = useUser();
    const [filter, setFilter] = useState<'all' | 'doc' | 'youtube' | 'audio'>('all');
    const [workspaceFilter, setWorkspaceFilter] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [isYoutubeLoading, setIsYoutubeLoading] = useState(false);

    // Bulk selection state
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedDeckIds, setSelectedDeckIds] = useState<Set<string>>(new Set());

    const [isBulkMoving, setIsBulkMoving] = useState(false);
    const [showBulkDeleteAlert, setShowBulkDeleteAlert] = useState(false);

    const [showBulkMoveAlert, setShowBulkMoveAlert] = useState(false);
    const [pendingBulkMoveWorkspaceId, setPendingBulkMoveWorkspaceId] = useState<string | null>(null);

    // Controlled dialog state - allows closing when config modal opens
    const [youtubeDialogOpen, setYoutubeDialogOpen] = useState(false);
    const [audioDialogOpen, setAudioDialogOpen] = useState(false);

    // NoteConfig modal state
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [pendingYoutubeUrl, setPendingYoutubeUrl] = useState('');
    const [pendingAudioData, setPendingAudioData] = useState<{ notes: string; transcript: string; title: string } | null>(null);

    // Usage limit modal state
    const [showLimitModal, setShowLimitModal] = useState(false);
    const [limitInfo, setLimitInfo] = useState({ used: 0, limit: 3 });

    const router = useRouter();
    const { startLoading, stopLoading } = useGlobalLoader();

    // Workspace state
    const [workspaces, setWorkspaces] = useState<any[]>([]);
    const [isWorkspacesLoading, setIsWorkspacesLoading] = useState(true);
    const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
    const [showEditWorkspace, setShowEditWorkspace] = useState(false);
    const [showWorkspaceDetail, setShowWorkspaceDetail] = useState(false);
    const [editingWorkspace, setEditingWorkspace] = useState<any>(null);
    const [viewingWorkspaceId, setViewingWorkspaceId] = useState<string | null>(null);
    const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);

    // Drag and drop state
    const [draggingDeckId, setDraggingDeckId] = useState<string | null>(null);
    const [dragOverWorkspaceId, setDragOverWorkspaceId] = useState<string | null>(null);

    const dropSucceededRef = useRef(false);

    // Reusable function to fetch workspaces
    const fetchWorkspaces = async () => {
        try {
            const res = await fetch('/api/workspaces');
            if (res.ok) {
                const data = await res.json();
                setWorkspaces(data.workspaces || []);
            }
        } catch (error) {
            console.error('Failed to fetch workspaces:', error);
        } finally {
            setIsWorkspacesLoading(false);
        }
    };

    // Fetch workspaces on mount
    useEffect(() => {
        fetchWorkspaces();
    }, []);

    const handleWorkspaceCreated = (workspace: any) => {
        // New workspace has no decks, ensure decks array exists
        setWorkspaces(prev => [{ ...workspace, decks: [] }, ...prev]);
    };

    const handleDeleteWorkspace = async (workspaceId: string) => {
        // Find workspace to get deck count for notification
        const workspace = workspaces.find(w => w.id === workspaceId);
        const deckCount = workspace?._count?.decks || 0;

        try {
            const res = await fetch(`/api/workspaces/${workspaceId}`, { method: 'DELETE' });
            if (res.ok) {
                setWorkspaces(prev => prev.filter(w => w.id !== workspaceId));
                if (selectedWorkspace === workspaceId) setSelectedWorkspace(null);
                if (workspaceFilter === workspaceId) setWorkspaceFilter(null);

                // Show appropriate message based on deck count
                if (deckCount > 0) {
                    toast.success(`Workspace deleted. ${deckCount} ${deckCount === 1 ? 'deck' : 'decks'} unlinked`);
                } else {
                    toast.success('Workspace deleted');
                }

                // Refresh to update deck workspaceId fields
                router.refresh();
            }
        } catch (error) {
            toast.error('Failed to delete workspace');
        }
    };

    const handleEditWorkspace = (workspace: any) => {
        setEditingWorkspace(workspace);
        setShowEditWorkspace(true);
    };

    const handleWorkspaceUpdated = (updatedWorkspace: any) => {
        // Preserve existing decks array when updating workspace metadata
        setWorkspaces(prev => prev.map(w =>
            w.id === updatedWorkspace.id
                ? { ...w, ...updatedWorkspace, decks: w.decks }
                : w
        ));
    };

    // Bulk selection handlers
    const toggleDeckSelection = (deckId: string) => {
        setSelectedDeckIds(prev => {
            const next = new Set(prev);
            if (next.has(deckId)) {
                next.delete(deckId);
            } else {
                next.add(deckId);
            }
            return next;
        });
    };

    const selectAllDecks = () => {
        setSelectedDeckIds(new Set(filteredDecks.map(d => d.id)));
    };

    const clearSelection = () => {
        setSelectedDeckIds(new Set());
        setIsSelectMode(false);
    };



    const handleBulkDelete = async () => {
        if (selectedDeckIds.size === 0) return;

        // Open custom confirmation dialog instead of window.confirm
        setShowBulkDeleteAlert(true);
    };

    const confirmBulkDelete = async () => {
        setIsBulkMoving(true);
        try {
            const deletePromises = Array.from(selectedDeckIds).map(id =>
                fetch(`/api/decks/${id}`, { method: 'DELETE' })
            );

            await Promise.all(deletePromises);

            toast.success(`Deleted ${selectedDeckIds.size} decks`);
            clearSelection();
            router.refresh();
        } catch (error) {
            console.error('Bulk delete error:', error);
            toast.error('Failed to delete decks');
        } finally {
            setIsBulkMoving(false);
            setShowBulkDeleteAlert(false);
        }
    };

    const confirmBulkMove = async () => {
        if (!pendingBulkMoveWorkspaceId) return;

        setIsBulkMoving(true);
        try {
            const res = await fetch(`/api/workspaces/${pendingBulkMoveWorkspaceId}/decks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deckIds: Array.from(selectedDeckIds) })
            });

            if (res.ok) {
                toast.success(`Added ${selectedDeckIds.size} decks to workspace`);
                clearSelection();
                fetchWorkspaces();
                router.refresh();
            } else {
                toast.error('Failed to add decks to workspace');
            }
        } catch (error) {
            toast.error('Failed to add decks to workspace');
        } finally {
            setIsBulkMoving(false);
            setShowBulkMoveAlert(false);
            setPendingBulkMoveWorkspaceId(null);
        }
    };

    // Modified handler that opens the alert
    const handleBulkAddToWorkspace = (workspaceId: string) => {
        if (selectedDeckIds.size === 0) return;
        setPendingBulkMoveWorkspaceId(workspaceId);
        setShowBulkMoveAlert(true);
    };

    // Long-press helpers for drag start


    // Drag and drop handlers
    const handleDragStart = (deckId: string) => {
        setDraggingDeckId(deckId);
        dropSucceededRef.current = false;
    };

    const handleDragEnd = (event: any, info: any) => {
        // Find if we're over a workspace card using coordinates
        // We use info.point which is the absolute pointer position
        const x = info.point.x;
        const y = info.point.y;

        // Temporarily disable pointer events on the dragging element so we can see what's under it
        const draggingElement = event.target as HTMLElement;
        const originalPointerEvents = draggingElement.style.pointerEvents;
        draggingElement.style.pointerEvents = 'none';

        const element = document.elementFromPoint(x, y);
        const workspaceCard = element?.closest('[data-workspace-id]');
        const workspaceId = workspaceCard?.getAttribute('data-workspace-id');

        // Restore pointer events
        draggingElement.style.pointerEvents = originalPointerEvents;

        if (workspaceId && draggingDeckId) {
            handleDropLogic(draggingDeckId, workspaceId);
        } else {
            // If no workspace handled the drop, notify the user gently
            if (!dropSucceededRef.current) {
                if (workspaces.length === 0) {
                    toast.info('Create a workspace to organize your decks');
                    setShowCreateWorkspace(true);
                } else {
                    toast.info('Drag decks onto a workspace to move them');
                }
            }
        }

        setDragOverWorkspaceId(null);
        setDraggingDeckId(null);
    };

    const handleDropLogic = async (deckId: string, workspaceId: string) => {
        dropSucceededRef.current = true;
        setDragOverWorkspaceId(null);

        // Don't move if it's already in this workspace
        const deck = decks.find(d => d.id === deckId);
        if (deck?.workspaceId === workspaceId) {
            toast.info('Deck is already in this workspace');
            return;
        }

        try {
            const res = await fetch(`/api/workspaces/${workspaceId}/decks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deckIds: [deckId] })
            });

            if (res.ok) {
                const workspace = workspaces.find(w => w.id === workspaceId);
                toast.success(`Moved to "${workspace?.name || 'workspace'}"`);
                fetchWorkspaces();
                router.refresh();
            } else {
                toast.error('Failed to move deck');
                dropSucceededRef.current = false;
            }
        } catch (error) {
            console.error('Drop error:', error);
            toast.error('Failed to move deck');
            dropSucceededRef.current = false;
        }
    };

    const handleDrag = (event: any, info: any) => {
        // Highlight workspace cards during drag
        const x = info.point.x;
        const y = info.point.y;

        // Ignore the dragging element itself
        const draggingElement = event.target as HTMLElement;
        const originalPointerEvents = draggingElement.style.pointerEvents;
        draggingElement.style.pointerEvents = 'none';

        const element = document.elementFromPoint(x, y);
        const workspaceCard = element?.closest('[data-workspace-id]');
        const workspaceId = workspaceCard?.getAttribute('data-workspace-id');

        // Restore
        draggingElement.style.pointerEvents = originalPointerEvents;

        if (workspaceId !== dragOverWorkspaceId) {
            setDragOverWorkspaceId(workspaceId as string | null);
        }
    };

    // Dummy handlers for WorkspaceCard props (logic is now in handleDrag/handleDragEnd)
    const handleDragOverDummy = (e: React.DragEvent) => e.preventDefault();
    const handleDragLeaveDummy = () => { };
    const handleDropDummy = (e: React.DragEvent) => e.preventDefault();

    const filteredDecks = decks.filter(deck => {
        const deckSourceType = deck.sourceType || 'doc';
        const matchesFilter = filter === 'all' ? true : deckSourceType === filter;
        const matchesSearch = deck.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesWorkspace = workspaceFilter === null ? true : deck.workspaceId === workspaceFilter;
        return matchesFilter && matchesSearch && matchesWorkspace;
    });

    // Helper function to get icon and color based on source type
    const getSourceInfo = (sourceType: string) => {
        switch (sourceType) {
            case 'youtube':
                return {
                    icon: Youtube,
                    label: 'YouTube',
                    bgColor: 'bg-red-50 dark:bg-red-900/20',
                    textColor: 'text-red-600 dark:text-red-400'
                };
            case 'audio':
                return {
                    icon: Mic,
                    label: 'Audio',
                    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
                    textColor: 'text-purple-600 dark:text-purple-400'
                };
            default:
                return {
                    icon: FileText,
                    label: 'Document',
                    bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
                    textColor: 'text-indigo-600 dark:text-indigo-400'
                };
        }
    };

    // Show config modal when user clicks YouTube "Generate Notes"
    const handleYoutubeClickGenerate = () => {
        if (!youtubeUrl) return;
        setPendingYoutubeUrl(youtubeUrl);
        // Keep dialog open - its backdrop will show behind config modal
        setShowConfigModal(true);
    };

    // Handle config selection and start generation
    const handleGenerateWithConfig = async (config: NoteConfig) => {
        setShowConfigModal(false);

        // Handle YouTube URL generation
        if (pendingYoutubeUrl) {
            setYoutubeDialogOpen(false); // Now close the dialog
            await processYoutubeWithConfig(pendingYoutubeUrl, config);
            setPendingYoutubeUrl('');
            return;
        }

        // Handle Audio generation
        if (pendingAudioData) {
            setAudioDialogOpen(false); // Now close the dialog
            await processAudioWithConfig(pendingAudioData, config);
            setPendingAudioData(null);
            return;
        }
    };

    const processYoutubeWithConfig = async (url: string, config: NoteConfig) => {
        setIsYoutubeLoading(true);
        startLoading('Fetching video transcript...');
        try {
            const transcriptTimer = setTimeout(() => {
                startLoading('Analyzing video content...');
            }, 2000);

            const notesTimer = setTimeout(() => {
                startLoading('Generating notes & flashcards...');
            }, 5000);

            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ youtubeUrl: url, noteConfig: config }),
            });

            clearTimeout(transcriptTimer);
            clearTimeout(notesTimer);

            if (!response.ok) {
                const errorData = await response.json();

                // Handle 429 limit reached - show upgrade modal
                if (response.status === 429 && errorData.upgradeRequired) {
                    setLimitInfo({
                        used: errorData.currentUsage || errorData.used || 3,
                        limit: errorData.limit || 3
                    });
                    setShowLimitModal(true);
                    clearTimeout(transcriptTimer);
                    clearTimeout(notesTimer);
                    return;
                }

                throw new Error(errorData.details || errorData.error || 'Failed to process YouTube video');
            }

            startLoading('Finalizing your study set...');
            const data = await response.json();
            router.push(`/study/${data.deckId}`);
        } catch (error) {
            console.error(error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to process YouTube video';
            toast.error('Processing Failed', {
                description: errorMessage,
                duration: 5000,
            });
        } finally {
            setIsYoutubeLoading(false);
            setYoutubeUrl('');
            stopLoading();
        }
    };

    const processAudioWithConfig = async (audioData: { notes: string; transcript: string; title: string }, config: NoteConfig) => {
        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    audioNotes: audioData.notes,
                    audioTranscript: audioData.transcript,
                    title: audioData.title || 'Audio Recording',
                    noteConfig: config
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error:', response.status, errorText);
                throw new Error(`Failed to create study set: ${errorText}`);
            }

            const data = await response.json();
            router.push(`/study/${data.deckId}`);
        } catch (error) {
            console.error('Error creating deck:', error);
            toast.error('Failed to save notes. Please try again.');
        }
    };

    const QuickCreateCard = ({ icon: Icon, title, description, color, onClick, disabled }: any) => (
        <motion.div
            onClick={disabled ? undefined : onClick}
            whileHover={disabled ? {} : { scale: 1.02, y: -3 }}
            whileTap={disabled ? {} : { scale: 0.98 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className={cn(
                "relative overflow-hidden group p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors duration-300",
                disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-300 dark:hover:border-indigo-700"
            )}
        >
            {/* Icon container */}
            <div
                className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors relative", color)}
            >
                <Icon className="w-6 h-6 text-white relative z-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">{title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </motion.div>
    );

    // Animation variants for staggered entrance - fast for filter changes
    const containerVariants: Variants = {
        hidden: { opacity: 1 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.03, // Much faster stagger (was 0.1)
                delayChildren: 0     // No initial delay (was 0.1)
            }
        }
    };

    const itemVariants: Variants = {
        hidden: { opacity: 0, y: 10 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                type: "tween",
                duration: 0.15,  // Fast fade-in
                ease: "easeOut"
            }
        }
    };

    return (
        <div className="p-6 pt-16 md:p-12 max-w-7xl mx-auto space-y-10">
            {/* Header with entrance animation */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
            >
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                        Welcome, {user?.firstName || 'there'}! 👋
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">What would you like to study today?</p>
                </div>
            </motion.div>

            {/* Quick Create Section with staggered entrance */}
            <div className="space-y-4">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Upload className="w-5 h-5 text-slate-400" />
                    Import Materials
                </h2>
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid grid-cols-1 md:grid-cols-3 gap-6"
                >
                    <Dialog>
                        <DialogTrigger asChild>
                            <div suppressHydrationWarning>
                                <QuickCreateCard
                                    icon={Upload}
                                    title="Upload Document"
                                    description="PDF, DOCX, PPT, TXT"
                                    color="bg-blue-500"
                                />
                            </div>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-xl">
                            <DialogHeader>
                                <DialogTitle>Upload Document</DialogTitle>
                                <DialogDescription>
                                    Upload your study materials to generate notes and flashcards.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="mt-4">
                                <FileUpload />
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={youtubeDialogOpen} onOpenChange={setYoutubeDialogOpen}>
                        <DialogTrigger asChild>
                            <div suppressHydrationWarning>
                                <QuickCreateCard
                                    icon={Youtube}
                                    title="YouTube Video"
                                    description="Paste a link to summarize"
                                    color="bg-red-500"
                                />
                            </div>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-xl">
                            <DialogHeader>
                                <DialogTitle>YouTube Summary</DialogTitle>
                                <DialogDescription>
                                    Paste a YouTube video URL to generate study notes from its captions.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="mt-4 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Video URL</label>
                                    <input
                                        type="text"
                                        placeholder="https://youtube.com/watch?v=..."
                                        value={youtubeUrl}
                                        onChange={(e) => setYoutubeUrl(e.target.value)}
                                        className="w-full p-2 border rounded-md dark:bg-slate-950 dark:border-slate-800"
                                    />
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        ⏱️ Max 60 minutes • Works with or without captions
                                    </p>
                                </div>
                                <AnimatedDockButton className="w-full">
                                    <Button
                                        onClick={handleYoutubeClickGenerate}
                                        disabled={isYoutubeLoading || !youtubeUrl}
                                        className="w-full bg-red-600 hover:bg-red-700 text-white transition-all shadow-lg shadow-red-500/20 hover:shadow-red-500/40"
                                    >
                                        {isYoutubeLoading ? 'Processing...' : 'Generate Notes'}
                                    </Button>
                                </AnimatedDockButton>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={audioDialogOpen} onOpenChange={setAudioDialogOpen}>
                        <DialogTrigger asChild>
                            <div suppressHydrationWarning>
                                <QuickCreateCard
                                    icon={Mic}
                                    title="Record Audio"
                                    description="Record lectures with live transcription"
                                    color="bg-purple-500"
                                />
                            </div>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Record Audio Notes</DialogTitle>
                                <DialogDescription>
                                    Record your voice and get AI-generated study notes with live transcription.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="mt-4">
                                <LiveAudioRecorder
                                    onComplete={(notes, transcript, title) => {
                                        // Store audio data and show config modal (keep dialog open for backdrop)
                                        setPendingAudioData({ notes, transcript, title: title || 'Audio Recording' });
                                        setShowConfigModal(true);
                                    }}
                                />
                            </div>
                        </DialogContent>
                    </Dialog>
                </motion.div>
            </div>

            {/* Bulk Action Alerts */}
            <AlertDialog open={showBulkDeleteAlert} onOpenChange={setShowBulkDeleteAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {selectedDeckIds.size} decks?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. These decks and all their contents will be permanently deleted.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmBulkDelete}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {isBulkMoving ? 'Deleting...' : 'Delete Decks'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={showBulkMoveAlert} onOpenChange={setShowBulkMoveAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Move decks to workspace?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to move the {selectedDeckIds.size} selected decks to "{workspaces.find(w => w.id === pendingBulkMoveWorkspaceId)?.name || 'workspace'}"?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmBulkMove}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            {isBulkMoving ? 'Moving...' : 'Move Decks'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Workspaces Section */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <FolderOpen className="w-5 h-5 text-slate-400" />
                        Workspaces
                    </h2>
                    <AnimatedDockButton>
                        <Button
                            onClick={() => setShowCreateWorkspace(true)}
                            variant="outline"
                            size="sm"
                            className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 gap-2 h-8 md:h-9 px-3 transition-colors shadow-sm flex-row-reverse"
                        >
                            <FolderPlus className="w-4 h-4" />
                            <span className="hidden md:inline">Create Workspace</span>
                        </Button>
                    </AnimatedDockButton>
                </div>

                {isWorkspacesLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Skeleton placeholder */}
                        <div className="h-[180px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 animate-pulse" />
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                    >
                        {workspaces.length === 0 ? (
                            <div
                                className={cn(
                                    "text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-dashed transition-all",
                                    draggingDeckId
                                        ? "border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20"
                                        : "border-slate-200 dark:border-slate-800"
                                )}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'none';
                                }}
                            >
                                <div className={cn(
                                    "w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3",
                                    draggingDeckId
                                        ? "bg-indigo-100 dark:bg-indigo-900/40"
                                        : "bg-slate-100 dark:bg-slate-800"
                                )}>
                                    <FolderOpen className={cn(
                                        "w-6 h-6",
                                        draggingDeckId ? "text-indigo-500" : "text-slate-400"
                                    )} />
                                </div>
                                {draggingDeckId ? (
                                    <>
                                        <p className="text-indigo-600 dark:text-indigo-400 font-medium">Create a workspace first</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">You need a workspace to organize decks</p>
                                        <Button
                                            onClick={() => setShowCreateWorkspace(true)}
                                            variant="outline"
                                            size="sm"
                                            className="mt-4 border-indigo-300 text-indigo-600 hover:bg-indigo-50"
                                        >
                                            <FolderPlus className="w-4 h-4 mr-2" />
                                            Create Workspace
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-slate-500 dark:text-slate-400">No workspaces yet</p>
                                        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Create a workspace to group your study decks</p>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {workspaces.map((workspace) => (
                                    <WorkspaceCard
                                        key={workspace.id}
                                        workspace={workspace}
                                        isSelected={selectedWorkspace === workspace.id}
                                        isDragOver={dragOverWorkspaceId === workspace.id}
                                        onClick={() => {
                                            if (!draggingDeckId) {
                                                setViewingWorkspaceId(workspace.id);
                                                setShowWorkspaceDetail(true);
                                            }
                                        }}
                                        onEdit={() => handleEditWorkspace(workspace)}
                                        onDelete={() => handleDeleteWorkspace(workspace.id)}
                                        onAddDecks={() => {
                                            // Activate bulk select mode and set the target workspace
                                            setIsSelectMode(true);
                                            setPendingBulkMoveWorkspaceId(workspace.id);
                                            // Scroll to study sets section
                                            document.getElementById('study-sets-section')?.scrollIntoView({ behavior: 'smooth' });
                                            toast.info(`Select decks to add to "${workspace.name}"`, {
                                                description: 'Click on decks to select them, then confirm to add to workspace',
                                            });
                                        }}
                                        onDragOver={handleDragOverDummy}
                                        onDragLeave={handleDragLeaveDummy}
                                        onDrop={handleDropDummy}
                                    />
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </div>

            {/* Recent Sets */}
            <div id="study-sets-section" className="space-y-6 scroll-mt-20">
                {/* Title Row */}
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Library className="w-5 h-5 text-slate-400" />
                        Study Sets
                    </h2>

                    {/* Active Filter Badges - visible on all sizes */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <AnimatePresence mode="popLayout" initial={false}>
                            {(workspaceFilter || filter !== 'all' || (isSelectMode && selectedDeckIds.size > 0)) && (
                                <div className="flex items-center gap-2">
                                    {/* Selection Badge */}
                                    {isSelectMode && selectedDeckIds.size > 0 && (
                                        <motion.button
                                            layout
                                            initial={{ opacity: 0, scale: 0.8, x: -10 }}
                                            animate={{ opacity: 1, scale: 1, x: 0 }}
                                            exit={{ opacity: 0, scale: 0.8, x: -10 }}
                                            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                                            onClick={() => {
                                                clearSelection();
                                                setIsSelectMode(false);
                                            }}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/60 transition-colors whitespace-nowrap"
                                        >
                                            <CheckSquare className="w-3.5 h-3.5" />
                                            {selectedDeckIds.size} Selected
                                            <X className="w-3 h-3 ml-1 opacity-60 hover:opacity-100" />
                                        </motion.button>
                                    )}

                                    {/* Workspace Badge */}
                                    {workspaceFilter && (() => {
                                        const ws = workspaces.find(w => w.id === workspaceFilter);
                                        return ws ? (
                                            <motion.button
                                                layout
                                                key="workspace-badge"
                                                initial={{ opacity: 0, scale: 0.8, x: -10 }}
                                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                                exit={{ opacity: 0, scale: 0.8, x: -10 }}
                                                transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                                                onClick={() => setWorkspaceFilter(null)}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 whitespace-nowrap"
                                            >
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ws.color }} />
                                                {ws.name}
                                                <X className="w-3 h-3 ml-1 opacity-60 hover:opacity-100" />
                                            </motion.button>
                                        ) : null;
                                    })()}

                                    {/* Category Badge */}
                                    {filter !== 'all' && (() => {
                                        const icons = { doc: FileText, youtube: Youtube, audio: Mic };
                                        const labels = { doc: 'Docs', youtube: 'YouTube', audio: 'Audio' };
                                        const Icon = icons[filter as keyof typeof icons] || BookOpen;
                                        return (
                                            <motion.button
                                                layout
                                                key="category-badge"
                                                initial={{ opacity: 0, scale: 0.8, x: -10 }}
                                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                                exit={{ opacity: 0, scale: 0.8, x: -10 }}
                                                transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                                                onClick={() => setFilter('all')}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 whitespace-nowrap"
                                            >
                                                <Icon className="w-3.5 h-3.5" />
                                                {labels[filter as keyof typeof labels] || filter}
                                                <X className="w-3 h-3 ml-1 opacity-60 hover:opacity-100" />
                                            </motion.button>
                                        );
                                    })()}
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Search and Options row */}
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    {/* Options Menu - top on mobile, right on desktop */}
                    <div className="order-1 md:order-2">
                        <OptionsMenu
                            filter={filter}
                            onFilterChange={setFilter}
                            workspaceFilter={workspaceFilter}
                            onWorkspaceFilterChange={setWorkspaceFilter}
                            workspaces={workspaces}
                            isSelectMode={isSelectMode}
                            onToggleSelectMode={() => {
                                if (isSelectMode) {
                                    clearSelection();
                                } else {
                                    setIsSelectMode(true);
                                }
                            }}
                            selectedCount={selectedDeckIds.size}
                            onSelectAll={selectAllDecks}
                            onClearSelection={clearSelection}
                            onBulkAdd={handleBulkAddToWorkspace}
                            isBulkMoving={isBulkMoving}
                            onBulkDelete={handleBulkDelete}
                        />
                    </div>

                    {/* Search Bar - bottom on mobile, left on desktop */}
                    <div className="relative w-full md:w-auto md:min-w-[200px] md:max-w-[280px] order-2 md:order-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search your sets..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>
                </div>

                {filteredDecks.length === 0 ? (
                    <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                            <BookOpen className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-slate-500 dark:text-slate-400">No study sets found</p>
                        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                            Try adjusting your filters or create a new set to get started.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredDecks.map((deck) => {
                            const sourceInfo = getSourceInfo(deck.sourceType || 'doc');
                            const SourceIcon = sourceInfo.icon;
                            const isSelected = selectedDeckIds.has(deck.id);
                            const isDragging = draggingDeckId === deck.id;
                            return (
                                <div key={deck.id} className="h-full">
                                    <DraggableCardContainer
                                        isDragging={isDragging}
                                        className="h-full"
                                    >
                                        <DraggableCardBody
                                            isDragging={isDragging}
                                            drag={!isSelectMode}
                                            onDragStart={() => handleDragStart(deck.id)}
                                            onDrag={handleDrag}
                                            onDragEnd={handleDragEnd}
                                            onClick={(e) => {
                                                if (isSelectMode) {
                                                    e.preventDefault();
                                                    toggleDeckSelection(deck.id);
                                                }
                                            }}
                                            className={cn(
                                                "group relative p-6 h-full flex flex-col cursor-grab active:cursor-grabbing",
                                                isSelectMode && "cursor-pointer",
                                                isSelected && "ring-2 ring-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500"
                                            )}
                                        >
                                            {!isSelectMode && !isDragging && (
                                                <Link href={`/study/${deck.id}`} className="absolute inset-0 z-0" aria-label={`Open ${deck.title}`} />
                                            )}

                                            {/* Selection checkbox overlay */}
                                            {isSelectMode && (
                                                <div className="absolute top-3 left-3 z-20">
                                                    {isSelected ? (
                                                        <div className="w-6 h-6 rounded-md bg-indigo-500 flex items-center justify-center">
                                                            <CheckSquare className="w-4 h-4 text-white" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-md border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" />
                                                    )}
                                                </div>
                                            )}

                                            <div className="relative z-10 pointer-events-none flex flex-col h-full">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", sourceInfo.bgColor, sourceInfo.textColor)}>
                                                        <SourceIcon className="w-5 h-5" />
                                                    </div>
                                                    {/* Three dots menu - always visible for mobile accessibility */}
                                                    <div className="pointer-events-auto relative z-20">
                                                        <DeckActionsMenu
                                                            deckId={deck.id}
                                                            currentWorkspaceId={deck.workspaceId}
                                                            workspaces={workspaces}
                                                            onWorkspaceChange={() => {
                                                                fetchWorkspaces();
                                                                router.refresh();
                                                            }}
                                                        />
                                                    </div>
                                                </div>

                                                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                    {deck.title}
                                                </h3>

                                                <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 mb-6 space-x-3">
                                                    <span className="flex items-center">
                                                        <Clock className="w-3 h-3 mr-1" />
                                                        {new Date(deck.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </span>
                                                    {deck._count?.cards > 0 && (
                                                        <>
                                                            <span>•</span>
                                                            <span>{deck._count.cards} cards</span>
                                                        </>
                                                    )}
                                                </div>

                                                <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                                    <div className="flex items-center gap-2">
                                                        <span className={cn("text-xs font-medium px-2 py-1 rounded-md", sourceInfo.bgColor, sourceInfo.textColor)}>
                                                            {sourceInfo.label}
                                                        </span>
                                                        {deck.workspaceId && (() => {
                                                            const workspace = workspaces.find(w => w.id === deck.workspaceId);
                                                            if (workspace) {
                                                                return (
                                                                    <span
                                                                        className="text-xs font-medium px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center gap-1"
                                                                    >
                                                                        <div
                                                                            className="w-2 h-2 rounded-full"
                                                                            style={{ backgroundColor: workspace.color }}
                                                                        />
                                                                        {workspace.name}
                                                                    </span>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        </DraggableCardBody>
                                    </DraggableCardContainer>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Note Configuration Modal */}
            <NoteConfigModal
                isOpen={showConfigModal}
                onClose={() => {
                    setShowConfigModal(false);
                    // Dialogs are already open, user can try again or close them
                }}
                onGenerate={handleGenerateWithConfig}
                isLoading={isYoutubeLoading}
            />

            {/* Usage Limit Modal - shows when deck limit reached */}
            <UsageLimitModal
                isOpen={showLimitModal}
                onClose={() => setShowLimitModal(false)}
                feature="study deck"
                limit={limitInfo.limit}
                used={limitInfo.used}
            />

            {/* Create Workspace Modal */}
            <CreateWorkspaceModal
                isOpen={showCreateWorkspace}
                onClose={() => setShowCreateWorkspace(false)}
                onCreated={handleWorkspaceCreated}
            />

            {/* Edit Workspace Modal */}
            <EditWorkspaceModal
                isOpen={showEditWorkspace}
                onClose={() => {
                    setShowEditWorkspace(false);
                    setEditingWorkspace(null);
                }}
                onWorkspaceUpdated={handleWorkspaceUpdated}
                workspace={editingWorkspace}
            />

            {/* Workspace Detail Modal */}
            <WorkspaceDetailModal
                isOpen={showWorkspaceDetail}
                onClose={() => {
                    setShowWorkspaceDetail(false);
                    setViewingWorkspaceId(null);
                }}
                workspace={workspaces.find(w => w.id === viewingWorkspaceId) || null}
                workspaces={workspaces}
                onWorkspaceChange={fetchWorkspaces}
            />
        </div>
    );
}
