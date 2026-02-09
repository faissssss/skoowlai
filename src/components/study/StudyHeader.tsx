
import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Menu, UserPlus, Pencil, Check, X } from 'lucide-react';
import { AnimatedDockButton } from '@/components/ui/animated-dock-button';
import StudyTimer from '@/components/study/StudyTimer';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Role } from '@/lib/permissions';
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler';

// Utility to shorten title
function shortenTitle(title: string, maxLength: number = 25): string {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength) + '...';
}

interface StudyHeaderProps {
    deck: {
        id: string;
        title: string;
        workspace?: {
            id: string;
            name: string;
            color: string;
        } | null;
    };
    currentUserId?: string;
    userRole?: Role | null;
    setIsMobileSidebarOpen: (isOpen: boolean) => void;
    isTimerRunning: boolean;
    isTimerPaused: boolean;
    setIsShareModalOpen: (isOpen: boolean) => void;
}

export function StudyHeader({
    deck,
    currentUserId,
    userRole,
    setIsMobileSidebarOpen,
    isTimerRunning,
    isTimerPaused,
    setIsShareModalOpen
}: StudyHeaderProps) {
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedTitle, setEditedTitle] = useState(deck.title);
    const [currentTitle, setCurrentTitle] = useState(deck.title);
    const [isSavingTitle, setIsSavingTitle] = useState(false);
    const titleInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const handleStartEditTitle = () => {
        setIsEditingTitle(true);
        setEditedTitle(currentTitle);
        setTimeout(() => titleInputRef.current?.focus(), 50);
    };

    const handleSaveTitle = async () => {
        const trimmedTitle = editedTitle.trim();
        if (!trimmedTitle || trimmedTitle === currentTitle) {
            setIsEditingTitle(false);
            return;
        }

        setIsSavingTitle(true);
        try {
            const response = await fetch(`/api/deck/${deck.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: trimmedTitle }),
            });

            if (response.ok) {
                setCurrentTitle(trimmedTitle);
                setIsEditingTitle(false);
                router.refresh();
            }
        } catch (error) {
            console.error('Failed to save title:', error);
        } finally {
            setIsSavingTitle(false);
        }
    };

    const handleCancelEditTitle = () => {
        setIsEditingTitle(false);
        setEditedTitle(currentTitle);
    };

    const handleTitleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSaveTitle();
        } else if (e.key === 'Escape') {
            handleCancelEditTitle();
        }
    };

    const canShare = userRole === 'OWNER';

    return (
        <header className="bg-card border-b border-border px-3 md:px-6 h-14 md:h-16 flex items-center sticky top-0 z-30">
            {/* Left: Mobile menu + Back button + Title */}
            <div className="flex items-center gap-1.5 md:gap-3 min-w-0 flex-1">
                {/* Mobile sidebar toggle */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden text-muted-foreground h-8 w-8 shrink-0"
                    onClick={() => setIsMobileSidebarOpen(true)}
                >
                    <Menu className="w-5 h-5" />
                </Button>
                <Link href="/dashboard" className="hidden md:block">
                    <Button variant="ghost" size="icon" className="text-muted-foreground">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>

                {/* Editable Title */}
                {isEditingTitle ? (
                    <div className="flex items-center gap-1.5 min-w-0">
                        <input
                            ref={titleInputRef}
                            type="text"
                            value={editedTitle}
                            onChange={(e) => setEditedTitle(e.target.value)}
                            onKeyDown={handleTitleKeyDown}
                            onBlur={() => setTimeout(() => { if (isEditingTitle) handleSaveTitle(); }, 150)}
                            disabled={isSavingTitle}
                            className="font-semibold text-sm md:text-base text-foreground bg-transparent border-b-2 border-primary outline-none px-1 py-0.5 min-w-0 w-full max-w-[100px] md:max-w-[300px]"
                            placeholder="Enter title..."
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 md:h-7 md:w-7 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 shrink-0"
                            onClick={handleSaveTitle}
                            disabled={isSavingTitle}
                        >
                            <Check className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 md:h-7 md:w-7 text-muted-foreground hover:bg-accent shrink-0"
                            onClick={handleCancelEditTitle}
                            disabled={isSavingTitle}
                        >
                            <X className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 group cursor-pointer min-w-0" onClick={handleStartEditTitle}>
                        <h1
                            className="font-semibold text-sm md:text-base text-foreground truncate"
                            title={currentTitle}
                        >
                            {shortenTitle(currentTitle, 12)}
                        </h1>
                        <Pencil className="w-3 h-3 md:w-3.5 md:h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                )}

                {/* Role Badge - hidden on mobile */}
                {userRole && userRole !== 'OWNER' && (
                    <span className={cn(
                        "px-2 py-0.5 text-xs font-medium rounded-full hidden md:inline",
                        userRole === 'EDITOR'
                            ? "bg-primary/10 text-primary"
                            : "bg-secondary text-muted-foreground"
                    )}>
                        {userRole === 'EDITOR' ? 'Editor' : 'Viewer'}
                    </span>
                )}

                {/* Workspace Badge */}
                {deck.workspace && (
                    <span
                        className="px-2 py-0.5 text-xs font-medium rounded-full hidden md:inline-flex items-center gap-1 bg-secondary"
                    >
                        <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: deck.workspace.color }}
                        />
                        <span className="text-muted-foreground">{deck.workspace.name}</span>
                    </span>
                )}
            </div>

            {/* Center: Timer - when not active */}
            <div className="absolute left-1/2 -translate-x-1/2 flex justify-center">
                <AnimatePresence mode="wait">
                    {!isTimerRunning && !isTimerPaused && (
                        <motion.div
                            key="timer-passive"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.12, ease: "easeOut" }}
                        >
                            <StudyTimer />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Right: Share Button + Theme Toggle */}
            <div className="flex items-center gap-2 shrink-0 justify-end flex-1">
                {canShare && currentUserId && (
                    <AnimatedDockButton>
                        <Button
                            onClick={() => setIsShareModalOpen(true)}
                            variant="outline"
                            size="sm"
                            className="gap-1.5 h-8 md:h-9 px-2 md:px-3"
                        >
                            <UserPlus className="w-4 h-4" />
                            <span className="hidden md:inline">Share</span>
                        </Button>
                    </AnimatedDockButton>
                )}
                <AnimatedThemeToggler />
            </div>
        </header>
    );
}
