'use client';

import { useState, useCallback } from 'react';
import { Node, Edge } from '@xyflow/react';
import MindMapEditor from '@/components/study/MindMapEditor';
import MindMapConfig from '@/components/study/MindMapConfig';
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

    if (showConfig) {
        return <MindMapConfig deckId={deckId} onGenerated={handleGenerated} />;
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <Network className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Mind Map</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Interactive visualization of your notes
                    </p>
                </div>
            </div>

            {/* Mind Map Editor */}
            <MindMapEditor
                deckId={deckId}
                initialNodes={nodes}
                initialEdges={edges}
                onSave={handleSave}
            />

            {/* Regenerate Button - Outside the box */}
            <button
                onClick={handleRegenerate}
                className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors mx-auto"
            >
                <RefreshCw className="w-4 h-4" />
                Regenerate with different settings
            </button>
        </div>
    );
}
