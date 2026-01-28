'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FolderOpen,
    LayoutGrid,
    CheckSquare,
    Settings2, X, ChevronLeft, ChevronRight, Square,
    Mic, Youtube, FileText, BookOpen,
    Trash2, FolderPlus, FolderMinus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Workspace {
    id: string;
    name: string;
    color: string;
}

interface OptionsMenuProps {
    filter: 'all' | 'doc' | 'youtube' | 'audio';
    onFilterChange: (filter: 'all' | 'doc' | 'youtube' | 'audio') => void;
    workspaceFilter: string | null;
    onWorkspaceFilterChange: (id: string | null) => void;
    workspaces: Workspace[];
    isSelectMode: boolean;
    onToggleSelectMode: () => void;
    selectedCount: number;
    onSelectAll: () => void;
    onClearSelection: () => void;
    onBulkAdd: (workspaceId: string) => void;
    isBulkMoving: boolean;
    onBulkDelete: () => void;
}

export default function OptionsMenu({
    filter,
    onFilterChange,
    workspaceFilter,
    onWorkspaceFilterChange,
    workspaces,
    isSelectMode,
    onToggleSelectMode,
    selectedCount,
    onSelectAll,
    onClearSelection,
    onBulkAdd,
    isBulkMoving,
    onBulkDelete
}: OptionsMenuProps) {
    const [interactionState, setInteractionState] = useState<'idle' | 'expanded' | 'workspace_active' | 'category_active' | 'bulk_active'>('idle');
    const containerRef = useRef<HTMLDivElement>(null);

    // Reset to idle on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                if (interactionState !== 'idle' && !isSelectMode) {
                    setInteractionState('idle');
                }
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [interactionState, isSelectMode]);

    // Reset interaction state when selection mode is disabled externally (e.g. via badge X)
    useEffect(() => {
        // If selection mode is turned off while we are in bulk_active state, reset to idle
        if (!isSelectMode && interactionState === 'bulk_active') {
            setInteractionState('idle');
        }
    }, [isSelectMode, interactionState]);

    // Define icons for categories
    const categoryIcons = {
        all: BookOpen,
        doc: FileText,
        youtube: Youtube,
        audio: Mic
    };

    // Helper to get active label
    const getActiveLabel = () => {
        if (isSelectMode) return `${selectedCount} Selected`;
        return 'All';
    };

    // Helper to get active color
    const getActiveColorClass = () => {
        if (isSelectMode) {
            return "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 border-indigo-200 dark:border-indigo-800";
        }
        if (workspaceFilter || filter !== 'all') {
            return "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-indigo-500 ring-1 ring-indigo-500/20";
        }
        return "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800";
    };

    const handleCancel = () => {
        onToggleSelectMode();
        // Redirect to options button (idle)
        setInteractionState('idle');
    };

    // Handle click to expand options (no hover)
    const handleExpandClick = () => {
        setInteractionState('expanded');
    };

    return (
        <div
            ref={containerRef}
            className="relative z-50 h-8 md:h-9 flex items-center justify-end"
        >
            <motion.div
                layout
                className={cn(
                    "flex items-center h-8 md:h-9 px-1 rounded-lg border shadow-sm transition-colors overflow-hidden flex-row-reverse",
                    getActiveColorClass()
                )}
                initial={{ minWidth: 100 }}
                animate={{
                    minWidth: interactionState === 'idle' ? 100 : 'auto'
                }}
                transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            >
                <AnimatePresence mode="wait" initial={false}>
                    {/* Default State: "All" Button - Click to expand */}
                    {interactionState === 'idle' && (
                        <motion.button
                            key="idle"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={handleExpandClick}
                            className="flex items-center px-3 gap-2 text-sm font-medium whitespace-nowrap h-full w-full justify-center flex-row-reverse active:scale-95 transition-transform"
                        >
                            <Settings2 className="w-4 h-4" />
                            <span>{getActiveLabel()}</span>
                        </motion.button>
                    )}

                    {/* Expanded State: 3 Icons with Labels - Click only (no hover) */}
                    {interactionState === 'expanded' && (
                        <motion.div
                            key="expanded"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-center gap-1 flex-row-reverse"
                        >
                            {/* Close/Cancel button */}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setInteractionState('idle')}
                                className="h-8 md:h-9 px-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 border-l border-slate-200 dark:border-slate-700 ml-1 gap-1.5 active:scale-95 transition-transform"
                            >
                                <X className="w-4 h-4" />
                                <span className="text-xs font-medium">Cancel</span>
                            </Button>

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setInteractionState('workspace_active')}
                                className={cn(
                                    "h-8 md:h-9 px-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 gap-1.5 active:scale-95 transition-transform",
                                    workspaceFilter && "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20"
                                )}
                            >
                                <FolderOpen className="w-4 h-4" />
                                <span className="text-xs font-medium hidden sm:inline">Workspace</span>
                            </Button>

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setInteractionState('category_active')}
                                className={cn(
                                    "h-8 md:h-9 px-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 gap-1.5 active:scale-95 transition-transform",
                                    filter !== 'all' && "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20"
                                )}
                            >
                                <LayoutGrid className="w-4 h-4" />
                                <span className="text-xs font-medium hidden sm:inline">Category</span>
                            </Button>

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setInteractionState('bulk_active');
                                    // Automatically trigger select mode when clicking the bulk actions button
                                    if (!isSelectMode) onToggleSelectMode();
                                }}
                                className={cn(
                                    "h-8 md:h-9 px-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 gap-1.5 active:scale-95 transition-transform",
                                    isSelectMode && "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20"
                                )}
                            >
                                <CheckSquare className="w-4 h-4" />
                                <span className="text-xs font-medium hidden sm:inline">Bulk</span>
                            </Button>
                        </motion.div>
                    )}

                    {/* Active State 1: Workspaces */}
                    {interactionState === 'workspace_active' && (
                        <motion.div
                            key="workspaces"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-center gap-1 flex-row-reverse"
                        >
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setInteractionState('expanded')}
                                className="h-7 w-7 rounded-md ml-1 text-slate-400 hover:text-slate-600 active:scale-95 transition-transform"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>

                            <button
                                onClick={() => onWorkspaceFilterChange(null)}
                                className={cn(
                                    "px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
                                    !workspaceFilter
                                        ? "bg-indigo-600 text-white shadow-sm"
                                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
                                )}
                            >
                                All
                            </button>

                            {workspaces.map(ws => (
                                <button
                                    key={ws.id}
                                    onClick={() => onWorkspaceFilterChange(ws.id)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap",
                                        workspaceFilter === ws.id
                                            ? "bg-indigo-600 text-white shadow-sm"
                                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
                                    )}
                                >
                                    <div
                                        className="w-2 h-2 rounded-full ring-1 ring-white/20"
                                        style={{ backgroundColor: workspaceFilter === ws.id ? 'currentColor' : ws.color }}
                                    />
                                    {ws.name}
                                </button>
                            ))}
                        </motion.div>
                    )}

                    {/* Active State 2: Categories */}
                    {interactionState === 'category_active' && (
                        <motion.div
                            key="categories"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-center gap-1 flex-row-reverse"
                        >
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setInteractionState('expanded')}
                                className="h-7 w-7 rounded-md ml-1 text-slate-400 hover:text-slate-600 active:scale-95 transition-transform"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>

                            {['all', 'doc', 'youtube', 'audio'].map((key) => {
                                const Icon = categoryIcons[key as keyof typeof categoryIcons];
                                return (
                                    <button
                                        key={key}
                                        onClick={() => onFilterChange(key as any)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap",
                                            filter === key
                                                ? "bg-indigo-600 text-white shadow-sm"
                                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
                                        )}
                                    >
                                        <Icon className="w-3 h-3" />
                                        <span className="capitalize">{key === 'doc' ? 'Docs' : key}</span>
                                    </button>
                                );
                            })}
                        </motion.div>
                    )}

                    {/* Active State 3: Bulk Actions */}
                    {interactionState === 'bulk_active' && (
                        <motion.div
                            key="bulk"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-center gap-2 flex-row-reverse"
                        >
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setInteractionState('expanded')}
                                className="h-7 w-7 rounded-md ml-1 text-slate-400 hover:text-slate-600 active:scale-95 transition-transform"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>

                            <Button
                                size="sm"
                                variant={isSelectMode ? "ghost" : "ghost"}
                                onClick={handleCancel}
                                className={cn(
                                    "h-8 text-xs gap-1.5 font-medium",
                                    isSelectMode && "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300"
                                )}
                            >
                                {isSelectMode ? <X className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                                {isSelectMode ? "Cancel" : "Select"}
                            </Button>

                            {isSelectMode && (
                                <>
                                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />

                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={onSelectAll}
                                        className="h-8 text-xs px-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    >
                                        All
                                    </Button>

                                    {selectedCount > 0 && (
                                        <>
                                            {/* Move to Workspace Dropdown */}
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 text-xs px-2 gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                                                    >
                                                        <FolderPlus className="w-3.5 h-3.5" />
                                                        Move to...
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48">
                                                    {workspaces.length === 0 ? (
                                                        <DropdownMenuItem disabled>
                                                            No workspaces found
                                                        </DropdownMenuItem>
                                                    ) : (
                                                        workspaces.map(ws => (
                                                            <DropdownMenuItem
                                                                key={ws.id}
                                                                onClick={() => onBulkAdd(ws.id)}
                                                            >
                                                                <div
                                                                    className="w-2 h-2 rounded-full mr-2"
                                                                    style={{ backgroundColor: ws.color }}
                                                                />
                                                                {ws.name}
                                                            </DropdownMenuItem>
                                                        ))
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>

                                            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />

                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={onBulkDelete}
                                                className="h-8 text-xs px-2 gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                Delete
                                            </Button>
                                        </>
                                    )}
                                </>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
