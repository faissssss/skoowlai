'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FolderOpen,
    LayoutGrid,
    CheckSquare,
    Settings2, X, ChevronRight, Square,
    Mic, Youtube, FileText, BookOpen,
    Trash2, FolderPlus
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
    onBulkAdd: (workspaceId: string) => void;
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
    onBulkAdd,
    onBulkDelete
}: OptionsMenuProps) {
    const [interactionState, setInteractionState] = useState<'idle' | 'expanded' | 'workspace_active' | 'category_active' | 'bulk_active'>('idle');
    const containerRef = useRef<HTMLDivElement>(null);
    const prevIsSelectModeRef = useRef(isSelectMode);
    const prevInteractionStateRef = useRef(interactionState);

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
            // Use setTimeout to break the synchronous setState cycle
            setTimeout(() => setInteractionState('idle'), 0);
        }
        prevIsSelectModeRef.current = isSelectMode;
    }, [isSelectMode, interactionState]);

    // Auto-expand to bulk actions when select mode is triggered externally (e.g. from Add Decks)
    useEffect(() => {
        // If select mode is turned on while we are in idle state, expand to bulk actions
        if (isSelectMode && interactionState === 'idle') {
            // Use setTimeout to break the synchronous setState cycle
            setTimeout(() => setInteractionState('bulk_active'), 0);
        }
        prevInteractionStateRef.current = interactionState;
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
        return 'Options';
    };

    // Helper to get active color
    const getActiveColorClass = () => {
        if (isSelectMode) {
            return "bg-primary/10 text-primary border-primary/30";
        }
        if (workspaceFilter || filter !== 'all') {
            return "bg-background text-foreground border-primary ring-1 ring-primary/20";
        }
        return "bg-background text-foreground border-border";
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
                        <motion.div
                            key="idle"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="h-full w-full"
                        >
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleExpandClick}
                                className="h-full w-full justify-center flex-row-reverse active:scale-95 transition-all"
                            >
                                <Settings2 className="w-4 h-4" />
                                <span>{getActiveLabel()}</span>
                            </Button>
                        </motion.div>
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
                                variant="outline"
                                size="sm"
                                onClick={() => setInteractionState('idle')}
                                className="h-8 md:h-9 px-2 rounded-md gap-1.5 active:scale-95 transition-transform flex-row-reverse border-l border-border ml-1"
                            >
                                <X className="w-4 h-4" />
                                <span className="text-xs font-medium">Cancel</span>
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setInteractionState('workspace_active')}
                                className={cn(
                                    "h-8 md:h-9 px-2 rounded-md gap-1.5 active:scale-95 transition-transform",
                                    workspaceFilter && "text-primary bg-primary/10"
                                )}
                            >
                                <FolderOpen className="w-4 h-4" />
                                <span className="text-xs font-medium hidden sm:inline">Workspace</span>
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setInteractionState('category_active')}
                                className={cn(
                                    "h-8 md:h-9 px-2 rounded-md gap-1.5 active:scale-95 transition-transform",
                                    filter !== 'all' && "text-primary bg-primary/10"
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
                                    "h-8 md:h-9 px-2 rounded-md hover:bg-muted gap-1.5 active:scale-95 transition-transform",
                                    isSelectMode && "text-primary bg-primary/10"
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
                                className="h-7 w-7 rounded-md ml-1 text-muted-foreground hover:text-foreground active:scale-95 transition-transform"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>

                            <button
                                onClick={() => onWorkspaceFilterChange(null)}
                                className={cn(
                                    "px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
                                    !workspaceFilter
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "bg-muted text-muted-foreground hover:bg-muted/80"
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
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                                    )}
                                >
                                    <div
                                        className="w-2 h-2 rounded-full ring-1 ring-background"
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
                                className="h-7 w-7 rounded-md ml-1 text-muted-foreground hover:text-foreground active:scale-95 transition-transform"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>

                            {['all', 'doc', 'youtube', 'audio'].map((key) => {
                                const Icon = categoryIcons[key as keyof typeof categoryIcons];
                                return (
                                    <button
                                        key={key}
                                        onClick={() => onFilterChange(key as 'all' | 'doc' | 'youtube' | 'audio')}
                                        className={cn(
                                            "px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap",
                                            filter === key
                                                ? "bg-primary text-primary-foreground shadow-sm"
                                                : "bg-muted text-muted-foreground hover:bg-muted/80"
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
                                className="h-7 w-7 rounded-md ml-1 text-muted-foreground hover:text-foreground active:scale-95 transition-transform"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>

                            <Button
                                size="sm"
                                variant={isSelectMode ? "ghost" : "ghost"}
                                onClick={handleCancel}
                                className={cn(
                                    "h-8 text-xs gap-1.5 font-medium",
                                    isSelectMode && "bg-primary/10 text-primary hover:bg-primary/20"
                                )}
                            >
                                {isSelectMode ? <X className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                                {isSelectMode ? "Cancel" : "Select"}
                            </Button>

                            {isSelectMode && (
                                <>
                                    <div className="w-px h-4 bg-border" />

                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={onSelectAll}
                                        className="h-8 text-xs px-2 hover:bg-muted"
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
                                                        className="h-8 text-xs px-2 gap-1.5 hover:bg-muted"
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

                                            <div className="w-px h-4 bg-border" />

                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={onBulkDelete}
                                                className="h-8 text-xs px-2 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
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
