import { db, withRetry } from '@/lib/db';
import { notFound } from 'next/navigation';
import DocumentViewer from '@/components/study/DocumentViewer';
import EmbeddedChat from '@/components/study/EmbeddedChat';

interface PageProps {
    params: Promise<{
        deckId: string;
    }>;
}

export default async function AIChatboxPage({ params }: PageProps) {
    const { deckId } = await params;

    const deck = await withRetry(() => db.deck.findUnique({
        where: { id: deckId },
    }));

    if (!deck) {
        notFound();
    }

    return (
        <div className="h-[calc(100vh-8rem)] flex gap-6">
            {/* Left Side: Document Viewer */}
            <div className="flex-1 min-w-0 h-full">
                <DocumentViewer fileUrl={deck.fileUrl} fileType={deck.fileType} />
            </div>

            {/* Right Side: AI Chat */}
            <div className="w-[400px] shrink-0 h-full">
                <EmbeddedChat context={deck.summary} deckId={deckId} />
            </div>
        </div>
    );
}
