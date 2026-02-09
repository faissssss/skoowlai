'use client';

import { useState, useCallback } from 'react';
import { Node, Edge } from '@xyflow/react';
import MindMapEditor from '@/components/study/MindMapEditor';
import MindMapConfig from '@/components/study/MindMapConfig';
import { Button } from '@/components/ui/button';
import { Network, RefreshCw } from 'lucide-react';

interface ClientMindMapProps {
    deckId: string;
    initialNodes: Node[];
    initialEdges: Edge[];
}

export default function ClientMindMap({ deckId, initialNodes, initialEdges }: ClientMindMapProps) {
    const [nodes, setNodes] = useState<Node[]>(initialNodes);
    const [edges, setEdges] = useState<Edge[]>(initialEdges);
    const [showConfig, setShowConfig] = useState(initialNodes.length === 0);

    const handleGenerated = useCallback(async () => {
        // Fetch the newly generated mind map
        const response = await fetch(`/api/mindmap?deckId=${deckId}`);
        if (response.ok) {
            const data = await response.json();
            setNodes(data.nodes || []);
            setEdges(data.edges || []);
            setShowConfig(false);
        }
    }, [deckId]);

    const handleSave = useCallback(async (updatedNodes: Node[], updatedEdges: Edge[]) => {
        const response = await fetch('/api/mindmap', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deckId,
                nodes: updatedNodes,
                edges: updatedEdges,
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to save mind map');
        }

        setNodes(updatedNodes);
        setEdges(updatedEdges);
    }, [deckId]);

    const handleRegenerate = () => {
        setShowConfig(true);
    };

    // Config modal (overlay on existing content)
    const configModal = (
        <MindMapConfig
            deckId={deckId}
            isOpen={showConfig}
            onClose={() => setShowConfig(false)}
            onGenerated={handleGenerated}
        />
    );

    if (nodes.length === 0) {
        return (
            <>
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-16 h-16 bg-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Network className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground mb-2">No Mind Map Yet</h2>
                    <p className="text-muted-foreground mb-4">Generate a mind map from your notes</p>
                    <Button onClick={() => setShowConfig(true)} className="bg-pink-500 hover:bg-pink-600 text-white">
                        <Network className="w-4 h-4 mr-2" /> Create Mind Map
                    </Button>
                </div>
                {configModal}
            </>
        );
    }

    return (
        <>
            {configModal}
            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-pink-500 rounded-xl flex items-center justify-center">
                        <Network className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground">Mind Map</h2>
                        <p className="text-sm text-muted-foreground">
                            Interactive visualization of your notes
                        </p>
                    </div>
                </div>

                {/* Mind Map Editor */}
                <MindMapEditor
                    initialNodes={nodes}
                    initialEdges={edges}
                    onSave={handleSave}
                />

                {/* Regenerate Button - Outside the box */}
                <button
                    onClick={handleRegenerate}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mx-auto"
                >
                    <RefreshCw className="w-4 h-4" />
                    Regenerate with different settings
                </button>
            </div>
        </>
    );
}
