'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, CreditCard, ClipboardCheck, Share2, Menu, UserPlus, Pencil, Check, X, Crown } from 'lucide-react';
import { AnimatedDockButton } from '@/components/ui/animated-dock-button';
import ChatAssistant from '@/components/study/ChatAssistant';
import TextSelectionPopup, { RewriteAction } from '@/components/study/TextSelectionPopup';
import StudyTimer from '@/components/study/StudyTimer';
import { useTimer } from '@/contexts/TimerContext';
import ShareModal from '@/components/ShareModal';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Role } from '@/lib/permissions';
import { EditorProvider, useEditorContext, RewriteRequest } from './EditorContext';
import PricingModal from '@/components/PricingModal';
import { IS_PRE_LAUNCH } from '@/lib/config';
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler';

interface StudyPageLayoutProps {
    children: React.ReactNode;
    deck: {
        id: string;
        title: string;
        summary: string;
        workspace?: {
            id: string;
            name: string;
            color: string;
        } | null;
    };
    currentUserId?: string;
    userRole?: Role | null;
}

// Utility to shorten title
function shortenTitle(title: string, maxLength: number = 25): string {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength) + '...';
}

function StudyPageLayoutInner({
    children,
    deck,
    currentUserId,
    userRole
}: StudyPageLayoutProps) {
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true); // Collapsed by default
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [citation, setCitation] = useState<string | null>(null);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedTitle, setEditedTitle] = useState(deck.title);
    const [currentTitle, setCurrentTitle] = useState(deck.title);
    const [isSavingTitle, setIsSavingTitle] = useState(false);
    const [isPricingOpen, setIsPricingOpen] = useState(false);
    const titleInputRef = useRef<HTMLInputElement>(null);
    const pathname = usePathname();
    const router = useRouter();
    const { isRunning: isTimerRunning, isPaused: isTimerPaused } = useTimer();

    // Auto-collapse sidebar on scroll
    useEffect(() => {
        let lastScrollY = window.scrollY;

        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            // Collapse sidebar when scrolling down more than 50px
            if (currentScrollY > lastScrollY && currentScrollY > 50 && !isSidebarCollapsed) {
                setIsSidebarCollapsed(true);
            }
            lastScrollY = currentScrollY;
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [isSidebarCollapsed]);

    const { editorRef, rewriteRequest, setRewriteRequest, handleRewriteInsert, setDeckId } = useEditorContext();

    // Register deckId with context for auto-save
    useEffect(() => {
        setDeckId(deck.id);
    }, [deck.id, setDeckId]);

    const handleAskAI = (selectedText: string) => {
        setCitation(selectedText);
        setIsChatOpen(true);
    };

    const handleRewrite = useCallback((text: string, action: RewriteAction, range: { from: number; to: number }) => {
        setRewriteRequest({ text, action, range });
        setIsChatOpen(true); // Open chat to show results
    }, [setRewriteRequest]);

    const handleRewriteClear = useCallback(() => {
        setRewriteRequest(null);
    }, [setRewriteRequest]);

    // Title editing handlers
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
                router.refresh(); // Refresh to update any cached data
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

    const navItems = [
        { href: `/study/${deck.id}/notes`, label: 'Notes', icon: FileText },
        { href: `/study/${deck.id}/flashcards`, label: 'Flashcards', icon: CreditCard },
        { href: `/study/${deck.id}/quiz`, label: 'Quiz', icon: ClipboardCheck },
        { href: `/study/${deck.id}/mindmap`, label: 'Mind Map', icon: Share2 },
    ];

    // Detect if we're on the Notes page (chat enabled only here)
    const isNotesPage = pathname.endsWith('/notes');

    // Determine if user can share (only owner)
    const canShare = userRole === 'OWNER';
    // Determine if user can edit
    const canEdit = userRole === 'OWNER' || userRole === 'EDITOR';

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col overflow-x-hidden">
            {/* Header */}
            <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 md:px-6 h-14 md:h-16 flex items-center sticky top-0 z-30 relative">
                {/* Left: Mobile menu + Back button + Title */}
                <div className="flex items-center gap-1.5 md:gap-3 min-w-0 flex-1">
                    {/* Mobile sidebar toggle */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden text-slate-500 dark:text-slate-400 h-8 w-8 shrink-0"
                        onClick={() => setIsMobileSidebarOpen(true)}
                    >
                        <Menu className="w-5 h-5" />
                    </Button>
                    <Link href="/dashboard" className="hidden md:block">
                        <Button variant="ghost" size="icon" className="text-slate-500 dark:text-slate-400">
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
                                className="font-semibold text-sm md:text-base text-slate-900 dark:text-slate-100 bg-transparent border-b-2 border-indigo-500 outline-none px-1 py-0.5 min-w-0 w-full max-w-[100px] md:max-w-[300px]"
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
                                className="h-6 w-6 md:h-7 md:w-7 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                                onClick={handleCancelEditTitle}
                                disabled={isSavingTitle}
                            >
                                <X className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 group cursor-pointer min-w-0" onClick={handleStartEditTitle}>
                            <h1
                                className="font-semibold text-sm md:text-base text-slate-900 dark:text-slate-100 truncate"
                                title={currentTitle}
                            >
                                {shortenTitle(currentTitle, 12)}
                            </h1>
                            <Pencil className="w-3 h-3 md:w-3.5 md:h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                    )}

                    {/* Role Badge - hidden on mobile */}
                    {userRole && userRole !== 'OWNER' && (
                        <span className={cn(
                            "px-2 py-0.5 text-xs font-medium rounded-full hidden md:inline",
                            userRole === 'EDITOR'
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        )}>
                            {userRole === 'EDITOR' ? 'Editor' : 'Viewer'}
                        </span>
                    )}

                    {/* Workspace Badge */}
                    {deck.workspace && (
                        <span
                            className="px-2 py-0.5 text-xs font-medium rounded-full hidden md:inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800"
                        >
                            <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: deck.workspace.color }}
                            />
                            <span className="text-slate-600 dark:text-slate-400">{deck.workspace.name}</span>
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
                                className="gap-1.5 border-white/20 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 h-8 md:h-9 px-2 md:px-3 hover:border-indigo-500/50 hover:text-indigo-500 transition-colors"
                            >
                                <UserPlus className="w-4 h-4" />
                                <span className="hidden md:inline">Share</span>
                            </Button>
                        </AnimatedDockButton>
                    )}
                    <AnimatedThemeToggler />
                </div>
            </header>

            {/* Floating Timer - Desktop: top when running/paused */}
            <AnimatePresence>
                {(isTimerRunning || isTimerPaused) && (
                    <motion.div
                        key="timer-active-desktop"
                        initial={{ opacity: 0, scale: 0.9, y: -5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -5 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="hidden md:block fixed top-4 left-1/2 -translate-x-1/2 z-50"
                    >
                        <StudyTimer />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Timer - Mobile: top when running/paused */}
            <AnimatePresence>
                {(isTimerRunning || isTimerPaused) && (
                    <motion.div
                        key="timer-active-mobile"
                        initial={{ opacity: 0, scale: 0.9, y: -5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -5 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="md:hidden fixed top-3 left-1/2 -translate-x-1/2 z-50"
                    >
                        <StudyTimer />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content Area with Sidebar */}
            <div className="flex-1 relative flex">
                {/* Mobile Sidebar Overlay */}
                <AnimatePresence>
                    {isMobileSidebarOpen && (
                        <>
                            {/* Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-black/50 z-40 md:hidden"
                                onClick={() => setIsMobileSidebarOpen(false)}
                            />
                            {/* Mobile Drawer */}
                            <motion.aside
                                initial={{ x: -280 }}
                                animate={{ x: 0 }}
                                exit={{ x: -280 }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                className="fixed left-0 top-0 bottom-0 w-[280px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-50 md:hidden flex flex-col"
                            >
                                {/* Mobile Drawer Header */}
                                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                    <Link href="/dashboard" className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                        <ArrowLeft className="w-4 h-4" />
                                        <span className="text-sm font-medium">Back to Dashboard</span>
                                    </Link>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setIsMobileSidebarOpen(false)}
                                    >
                                        <X className="w-5 h-5" />
                                    </Button>
                                </div>

                                {/* Mobile Navigation Items */}
                                <nav className="flex-1 p-4 space-y-2">
                                    {navItems.map((item) => {
                                        const Icon = item.icon;
                                        const isActive = pathname === item.href;
                                        return (
                                            <Link key={item.href} href={item.href} onClick={() => setIsMobileSidebarOpen(false)}>
                                                <AnimatedDockButton className="relative w-full">
                                                    {/* Sliding active indicator */}
                                                    {isActive && (
                                                        <motion.div
                                                            layoutId="mobile-sidebar-active-indicator"
                                                            className="absolute inset-0 bg-indigo-50 dark:bg-indigo-900/20 rounded-md"
                                                            transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                                                        />
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        className={cn(
                                                            "w-full gap-3 justify-start relative z-10",
                                                            isActive && "text-indigo-600 dark:text-indigo-400"
                                                        )}
                                                    >
                                                        <Icon className="w-5 h-5 shrink-0" strokeWidth={1.5} />
                                                        <span>{item.label}</span>
                                                    </Button>
                                                </AnimatedDockButton>
                                            </Link>
                                        );
                                    })}
                                </nav>

                                {/* Mobile Upgrade Button - Hidden during pre-launch */}
                                {!IS_PRE_LAUNCH && (
                                    <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                                        <Button
                                            onClick={() => { setIsPricingOpen(true); setIsMobileSidebarOpen(false); }}
                                            className="w-full gap-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-lg shadow-purple-500/25"
                                        >
                                            <Crown className="w-4 h-4 shrink-0" />
                                            <span>Upgrade Plan</span>
                                        </Button>
                                    </div>
                                )}
                            </motion.aside>
                        </>
                    )}
                </AnimatePresence>

                {/* Desktop Left Sidebar - Floating card style */}
                <motion.aside
                    initial={false}
                    animate={{ width: isSidebarCollapsed ? 80 : 256 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="hidden md:flex bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-r border-y border-slate-200 dark:border-slate-700/50 flex-col fixed left-0 top-1/2 -translate-y-1/2 h-[70vh] z-20 overflow-y-auto rounded-r-2xl shadow-xl shadow-slate-900/10 dark:shadow-black/30"
                >
                    {/* Sidebar Header with Toggle */}
                    <div className="p-4 border-b border-slate-200/50 dark:border-slate-700/50 flex items-center justify-start">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        >
                            <Menu className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* Navigation Items with sliding indicator */}
                    <nav className="flex-1 p-4 space-y-2">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;
                            return (
                                <Link key={item.href} href={item.href}>
                                    <AnimatedDockButton className="relative w-full">
                                        {/* Sliding active indicator */}
                                        {isActive && (
                                            <motion.div
                                                layoutId="sidebar-active-indicator"
                                                className="absolute inset-0 bg-indigo-50 dark:bg-indigo-900/20 rounded-md"
                                                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                                            />
                                        )}
                                        <Button
                                            variant="ghost"
                                            className={cn(
                                                "w-full gap-3 transition-all duration-300 justify-start relative z-10",
                                                isActive && "text-indigo-600 dark:text-indigo-400"
                                            )}
                                            title={isSidebarCollapsed ? item.label : undefined}
                                        >
                                            <Icon className="w-5 h-5 shrink-0" strokeWidth={1.5} />
                                            <AnimatePresence mode="wait">
                                                {!isSidebarCollapsed && (
                                                    <motion.span
                                                        initial={{ opacity: 0, width: 0 }}
                                                        animate={{ opacity: 1, width: "auto" }}
                                                        exit={{ opacity: 0, width: 0 }}
                                                        transition={{ duration: 0.2 }}
                                                        className="whitespace-nowrap overflow-hidden"
                                                    >
                                                        {item.label}
                                                    </motion.span>
                                                )}
                                            </AnimatePresence>
                                        </Button>
                                    </AnimatedDockButton>
                                </Link>
                            );
                        })}


                    </nav>

                    {/* Upgrade Plan Button - Hidden during pre-launch */}
                    {!IS_PRE_LAUNCH && (
                        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                            <AnimatedDockButton className="w-full">
                                <Button
                                    onClick={() => setIsPricingOpen(true)}
                                    className="w-full gap-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-lg shadow-purple-500/25 justify-center"
                                    title={isSidebarCollapsed ? "Upgrade Plan" : undefined}
                                >
                                    <Crown className="w-4 h-4 shrink-0" />
                                    <AnimatePresence mode="wait">
                                        {!isSidebarCollapsed && (
                                            <motion.span
                                                initial={{ opacity: 0, width: 0 }}
                                                animate={{ opacity: 1, width: "auto" }}
                                                exit={{ opacity: 0, width: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="whitespace-nowrap overflow-hidden"
                                            >
                                                Upgrade Plan
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </Button>
                            </AnimatedDockButton>
                        </div>
                    )}
                </motion.aside>

                {/* Main Content */}
                <main
                    className={cn(
                        "flex-1 p-4 md:p-6 lg:p-8 transition-all duration-300 ease-in-out",
                        isChatOpen ? "md:mr-[400px]" : "mr-0",
                        isSidebarCollapsed ? "md:ml-[80px]" : "md:ml-[256px]"
                    )}
                >
                    <motion.div
                        key={pathname}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="max-w-5xl mx-auto w-full"
                    >
                        {children}
                    </motion.div>
                </main>

                {/* Chat Assistant */}
                {/* Chat Assistant - Only available on Notes page */}
                {isNotesPage && (
                    <ChatAssistant
                        context={deck.summary}
                        deckId={deck.id}
                        isOpen={isChatOpen}
                        onToggle={() => setIsChatOpen(!isChatOpen)}
                        citation={citation}
                        onCitationUsed={() => setCitation(null)}
                        rewriteRequest={rewriteRequest}
                        onRewriteInsert={handleRewriteInsert}
                        onRewriteClear={handleRewriteClear}
                        editorRef={editorRef}
                    />
                )}

                {/* Text Selection Popup - Only available on Notes page */}
                {isNotesPage && (
                    <TextSelectionPopup
                        onAskAI={handleAskAI}
                        onRewrite={handleRewrite}
                        editorRef={editorRef}
                    />
                )}
            </div>

            {/* Share Modal */}
            {currentUserId && (
                <ShareModal
                    isOpen={isShareModalOpen}
                    onClose={() => setIsShareModalOpen(false)}
                    deckId={deck.id}
                    deckTitle={deck.title}
                    currentUserId={currentUserId}
                />
            )}

            {/* Pricing Modal */}
            <PricingModal isOpen={isPricingOpen} onClose={() => setIsPricingOpen(false)} />
        </div>
    );
}

export default function StudyPageLayout(props: StudyPageLayoutProps) {
    return (
        <EditorProvider>
            <StudyPageLayoutInner {...props} />
        </EditorProvider>
    );
}
