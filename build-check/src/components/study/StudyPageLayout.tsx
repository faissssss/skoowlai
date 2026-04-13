'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { FileText, Layers, HelpCircle, Network } from 'lucide-react';
import ChatAssistant from '@/components/study/ChatAssistant';
import TextSelectionPopup, { RewriteAction } from '@/components/study/TextSelectionPopup';
import StudyTimer from '@/components/study/StudyTimer';
import { useTimer } from '@/contexts/TimerContext';
import ShareModal from '@/components/ShareModal';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Role } from '@/lib/permissions';
import { EditorProvider, useEditorContext } from './EditorContext';
import PricingModal from '@/components/PricingModal';
import { StudyHeader } from './StudyHeader';
import { StudyNavbar } from './StudyNavbar';

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
    const [isPricingOpen, setIsPricingOpen] = useState(false);
    const pathname = usePathname();
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

    const navItems = useMemo(() => [
        { href: `/study/${deck.id}/notes`, label: 'Notes', icon: FileText },
        { href: `/study/${deck.id}/flashcards`, label: 'Flashcards', icon: Layers },
        { href: `/study/${deck.id}/quiz`, label: 'Quiz', icon: HelpCircle },
        { href: `/study/${deck.id}/mindmap`, label: 'Mind Map', icon: Network },
    ], [deck.id]);

    // Detect if we're on the Notes page (chat enabled only here)
    const isNotesPage = pathname.endsWith('/notes');

    return (
        <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
            {/* Header */}
            <StudyHeader
                deck={deck}
                currentUserId={currentUserId}
                userRole={userRole}
                setIsMobileSidebarOpen={setIsMobileSidebarOpen}
                isTimerRunning={isTimerRunning}
                isTimerPaused={isTimerPaused}
                setIsShareModalOpen={setIsShareModalOpen}
            />

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
                <StudyNavbar
                    navItems={navItems}
                    isSidebarCollapsed={isSidebarCollapsed}
                    toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    isMobileSidebarOpen={isMobileSidebarOpen}
                    setIsMobileSidebarOpen={setIsMobileSidebarOpen}
                    setIsPricingOpen={setIsPricingOpen}
                />

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
