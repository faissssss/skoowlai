'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
    BookOpen, Clock, Youtube, Mic, Upload,
    FileText, Search, Crown
} from 'lucide-react';
import FileUpload from '@/components/study/FileUpload';
import LiveAudioRecorder from '@/components/study/LiveAudioRecorder';
import PricingModal from '@/components/PricingModal';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import DeleteDeckButton from '@/components/dashboard/DeleteDeckButton';
import { cn } from '@/lib/utils';
import { useGlobalLoader } from '@/contexts/LoaderContext';

interface DashboardClientProps {
    decks: any[];
}

export default function DashboardClient({ decks }: DashboardClientProps) {
    const [filter, setFilter] = useState<'all' | 'doc' | 'youtube' | 'audio'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [isYoutubeLoading, setIsYoutubeLoading] = useState(false);
    const [isPricingOpen, setIsPricingOpen] = useState(false);

    const router = useRouter();
    const { startLoading, stopLoading } = useGlobalLoader();

    const filteredDecks = decks.filter(deck => {
        const deckSourceType = deck.sourceType || 'doc';
        const matchesFilter = filter === 'all' ? true : deckSourceType === filter;
        const matchesSearch = deck.title.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
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

    const handleYoutubeSubmit = async () => {
        if (!youtubeUrl) return;
        setIsYoutubeLoading(true);
        startLoading('Fetching video transcript...');
        try {
            // Update progress messages
            const transcriptTimer = setTimeout(() => {
                startLoading('Analyzing video content...');
            }, 2000);

            const notesTimer = setTimeout(() => {
                startLoading('Generating notes & flashcards...');
            }, 5000);

            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ youtubeUrl }),
            });

            clearTimeout(transcriptTimer);
            clearTimeout(notesTimer);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || errorData.error || 'Failed to process YouTube video');
            }

            startLoading('Finalizing your study set...');
            const data = await response.json();
            router.push(`/study/${data.deckId}`);
        } catch (error) {
            console.error(error);
            alert(error instanceof Error ? error.message : 'Failed to process YouTube video');
        } finally {
            setIsYoutubeLoading(false);
            setYoutubeUrl('');
            stopLoading();
        }
    };

    const QuickCreateCard = ({ icon: Icon, title, description, color, onClick, disabled }: any) => (
        <div
            onClick={disabled ? undefined : onClick}
            className={cn(
                "relative overflow-hidden group p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 transition-all duration-300",
                disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-700 hover:-translate-y-1"
            )}
        >
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors", color)}>
                <Icon className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>

            {/* Hover Effect Background */}
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
        </div>
    );

    return (
        <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Welcome back! 👋</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">What would you like to study today?</p>
                </div>
                <Button
                    onClick={() => setIsPricingOpen(true)}
                    className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-lg shadow-purple-500/25 gap-2"
                >
                    <Crown className="w-4 h-4" />
                    Upgrade Plan
                </Button>
            </div>

            {/* Quick Create Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Dialog>
                    <DialogTrigger asChild>
                        <div>
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

                <Dialog>
                    <DialogTrigger asChild>
                        <div>
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
                                Paste a YouTube video URL to generate study notes.
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
                            </div>
                            <Button
                                onClick={handleYoutubeSubmit}
                                disabled={isYoutubeLoading || !youtubeUrl}
                                className="w-full bg-red-600 hover:bg-red-700 text-white"
                            >
                                {isYoutubeLoading ? 'Processing...' : 'Generate Notes'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                <Dialog>
                    <DialogTrigger asChild>
                        <div>
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
                                onComplete={async (notes, transcript, title) => {
                                    // Create a new deck with the generated notes
                                    try {
                                        const response = await fetch('/api/generate', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                audioNotes: notes,
                                                audioTranscript: transcript,
                                                title: title || 'Audio Recording'
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
                                        alert('Failed to save notes. Please try again.');
                                    }
                                }}
                            />
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Recent Sets */}
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Clock className="w-5 h-5 text-slate-400" />
                        Recent Study Sets
                    </h2>

                    <div className="flex items-center gap-4 flex-1 justify-end">
                        {/* Filters */}
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                            <Button
                                variant={filter === 'all' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setFilter('all')}
                                className="text-xs"
                            >
                                All
                            </Button>
                            <Button
                                variant={filter === 'doc' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setFilter('doc')}
                                className="text-xs gap-1"
                            >
                                <FileText className="w-3 h-3" /> Docs
                            </Button>
                            <Button
                                variant={filter === 'youtube' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setFilter('youtube')}
                                className="text-xs gap-1"
                            >
                                <Youtube className="w-3 h-3" /> YouTube
                            </Button>
                            <Button
                                variant={filter === 'audio' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setFilter('audio')}
                                className="text-xs gap-1"
                            >
                                <Mic className="w-3 h-3" /> Audio
                            </Button>
                        </div>

                        {/* Search Bar */}
                        <div className="relative w-64 hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search your sets..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>
                    </div>
                </div>

                {filteredDecks.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
                            <BookOpen className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No study sets found</h3>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                            Try adjusting your filters or create a new set to get started.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredDecks.map((deck) => {
                            const sourceInfo = getSourceInfo(deck.sourceType || 'doc');
                            const SourceIcon = sourceInfo.icon;
                            return (
                                <div key={deck.id} className="group relative bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all duration-200 h-full flex flex-col">
                                    <Link href={`/study/${deck.id}`} className="absolute inset-0 z-0" aria-label={`Open ${deck.title}`} />

                                    <div className="relative z-10 pointer-events-none flex flex-col h-full">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", sourceInfo.bgColor, sourceInfo.textColor)}>
                                                <SourceIcon className="w-5 h-5" />
                                            </div>
                                            <div className="pointer-events-auto">
                                                <DeleteDeckButton deckId={deck.id} />
                                            </div>
                                        </div>

                                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                            {deck.title}
                                        </h3>

                                        <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 mb-6 space-x-3">
                                            <span className="flex items-center">
                                                <Clock className="w-3 h-3 mr-1" />
                                                {new Date(deck.createdAt).toLocaleDateString()}
                                            </span>
                                            {deck._count.cards > 0 && (
                                                <>
                                                    <span>•</span>
                                                    <span>{deck._count.cards} cards</span>
                                                </>
                                            )}
                                        </div>

                                        <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                            <span className={cn("text-xs font-medium px-2 py-1 rounded-md", sourceInfo.bgColor, sourceInfo.textColor)}>
                                                {sourceInfo.label}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Pricing Modal */}
            <PricingModal
                isOpen={isPricingOpen}
                onClose={() => setIsPricingOpen(false)}
            />
        </div>
    );
}
