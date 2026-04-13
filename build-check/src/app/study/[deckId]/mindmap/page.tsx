import { db, withRetry } from '@/lib/db';
import { notFound } from 'next/navigation';
import ClientMindMap from './ClientMindMap';

export default async function MindMapPage({ params }: { params: Promise<{ deckId: string }> }) {
    const { deckId } = await params;

    const deck = await withRetry(() => db.deck.findUnique({
        where: { id: deckId },
    }));

    if (!deck) {
        notFound();
    }

    // Fetch existing mind map if available
    let initialNodes: any[] = [];
    let initialEdges: any[] = [];

    try {
        const mindMap = await db.mindMap.findUnique({
            where: { deckId },
        });

        if (mindMap) {
            initialNodes = JSON.parse(mindMap.nodes);
            initialEdges = JSON.parse(mindMap.edges);
        }
    } catch (error) {
        console.error('Error fetching mind map:', error);
    }

    return (
        <div className="max-w-6xl mx-auto">
            <ClientMindMap
                deckId={deckId}
                initialNodes={initialNodes}
                initialEdges={initialEdges}
            />
        </div>
    );
}
