'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, CreditCard, ClipboardCheck, Share2, Menu, UserPlus, Pencil, Check, X, Crown } from 'lucide-react';
import ChatAssistant from '@/components/study/ChatAssistant';
import TextSelectionPopup, { RewriteAction } from '@/components/study/TextSelectionPopup';
import StudyTimer from '@/components/study/StudyTimer';
import ShareModal from '@/components/ShareModal';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Role } from '@/lib/permissions';
import { EditorProvider, useEditorContext, RewriteRequest } from './EditorContext';
import PricingModal from '@/components/PricingModal';

interface StudyPageLayoutProps {
    children: React.ReactNode;
    deck: {
        id: string;
        title: string;
        summary: string;
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
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
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
            <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 h-16 flex items-center sticky top-0 z-30">
                {/* Left: Back button + Title */}
                <div className="flex items-center gap-3 flex-shrink-0">
                    <Link href="/dashboard">
                        <Button variant="ghost" size="icon" className="text-slate-500 dark:text-slate-400">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>

                    {/* Editable Title */}
                    {isEditingTitle ? (
                        <div className="flex items-center gap-2">
                            <input
                                ref={titleInputRef}
                                type="text"
                                value={editedTitle}
                                onChange={(e) => setEditedTitle(e.target.value)}
                                onKeyDown={handleTitleKeyDown}
                                onBlur={() => setTimeout(() => { if (isEditingTitle) handleSaveTitle(); }, 150)}
                                disabled={isSavingTitle}
                                className="font-semibold text-slate-900 dark:text-slate-100 bg-transparent border-b-2 border-indigo-500 outline-none px-1 py-0.5 max-w-[200px] md:max-w-[300px]"
                                placeholder="Enter title..."
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                                onClick={handleSaveTitle}
                                disabled={isSavingTitle}
                            >
                                <Check className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                onClick={handleCancelEditTitle}
                                disabled={isSavingTitle}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 group cursor-pointer" onClick={handleStartEditTitle}>
                            <h1
                                className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[180px] md:max-w-[250px]"
                                title={currentTitle}
                            >
                                {shortenTitle(currentTitle, 28)}
                            </h1>
                            <Pencil className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    )}

                    {/* Role Badge */}
                    {userRole && userRole !== 'OWNER' && (
                        <span className={cn(
                            "px-2 py-0.5 text-xs font-medium rounded-full",
                            userRole === 'EDITOR'
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        )}>
                            {userRole === 'EDITOR' ? 'Editor' : 'Viewer'}
                        </span>
                    )}
                </div>

                {/* Center: Pomodoro Timer */}
                <div className="flex-1 flex justify-center">
                    <StudyTimer />
                </div>

                {/* Right: Share Button */}
                <div className="w-[180px] md:w-[250px] flex-shrink-0 flex justify-end">
                    {canShare && currentUserId && (
                        <Button
                            onClick={() => setIsShareModalOpen(true)}
                            variant="outline"
                            className="gap-2 border-white/20 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            <UserPlus className="w-4 h-4" />
                            <span className="hidden md:inline">Share</span>
                        </Button>
                    )}
                </div>
            </header>

            {/* Main Content Area with Sidebar */}
            <div className="flex-1 relative flex">
                {/* Left Sidebar */}
                <motion.aside
                    initial={false}
                    animate={{ width: isSidebarCollapsed ? 80 : 256 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col"
                >
                    {/* Sidebar Header with Toggle */}
                    <div className={cn(
                        "p-4 border-b border-slate-200 dark:border-slate-800 flex items-center",
                        isSidebarCollapsed ? "justify-center" : "justify-start"
                    )}>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        >
                            <Menu className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* Navigation Items */}
                    <nav className="flex-1 p-4 space-y-2">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;
                            return (
                                <Link key={item.href} href={item.href}>
                                    <Button
                                        variant={isActive ? "secondary" : "ghost"}
                                        className={cn(
                                            "w-full gap-3 transition-all duration-300",
                                            isActive && "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400",
                                            isSidebarCollapsed ? "justify-center px-2" : "justify-start"
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
                                </Link>
                            );
                        })}


                    </nav>

                    {/* Upgrade Plan Button */}
                    <div className={cn(
                        "p-4 border-t border-slate-200 dark:border-slate-800",
                        isSidebarCollapsed ? "flex justify-center" : ""
                    )}>
                        <Button
                            onClick={() => setIsPricingOpen(true)}
                            className={cn(
                                "w-full gap-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-lg shadow-purple-500/25",
                                isSidebarCollapsed ? "px-2" : ""
                            )}
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
                    </div>
                </motion.aside>

                {/* Main Content */}
                <main
                    className={cn(
                        "flex-1 p-6 md:p-8 transition-all duration-300 ease-in-out",
                        isChatOpen ? "mr-[400px]" : "mr-0"
                    )}
                >
                    <div className="max-w-5xl mx-auto w-full">
                        {children}
                    </div>
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

                {/* Text Selection Popup */}
                <TextSelectionPopup
                    onAskAI={handleAskAI}
                    onRewrite={handleRewrite}
                    editorRef={editorRef}
                />
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
