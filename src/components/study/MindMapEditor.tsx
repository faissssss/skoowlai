'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Node,
    Edge,
    BackgroundVariant,
    Panel,
    NodeProps,
    Handle,
    Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Plus, Save, Trash2, Settings, Loader2, X, Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface MindMapEditorProps {
    deckId: string;
    initialNodes?: Node[];
    initialEdges?: Edge[];
    onSave?: (nodes: Node[], edges: Edge[]) => Promise<void>;
}

// Custom editable node component
function EditableNode({ id, data, selected }: NodeProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [label, setLabel] = useState(data.label as string);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleDoubleClick = () => {
        setIsEditing(true);
    };

    const handleBlur = () => {
        setIsEditing(false);
        if (data.onLabelChange) {
            (data.onLabelChange as (id: string, label: string) => void)(id, label);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleBlur();
        }
        if (e.key === 'Escape') {
            setLabel(data.label as string);
            setIsEditing(false);
        }
    };

    const isRoot = data.isRoot as boolean;
    const nodeColor = data.color as string | undefined;
    const handleColor = nodeColor || '#6366f1';

    // Dynamic styles based on color theme
    const nodeStyle = nodeColor ? {
        background: isRoot ? `linear-gradient(135deg, ${nodeColor}, ${nodeColor}dd)` : undefined,
        borderColor: nodeColor,
        boxShadow: isRoot ? `0 4px 14px ${nodeColor}40` : undefined,
    } : {};

    // Common handle style - visible and interactive
    const handleClass = "!w-3 !h-3 !border-2 !border-white dark:!border-slate-800 !opacity-70 hover:!opacity-100 !transition-opacity";

    return (
        <div
            className={cn(
                "px-4 py-2 rounded-xl border-2 shadow-lg transition-all duration-200 min-w-[100px] max-w-[180px] text-center",
                isRoot
                    ? "text-white"
                    : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100",
                !nodeColor && isRoot && "bg-gradient-to-br from-indigo-500 to-purple-600 border-indigo-300",
                !nodeColor && !isRoot && "border-slate-200 dark:border-slate-700",
                selected && "ring-2 ring-offset-2 dark:ring-offset-slate-900",
                nodeColor ? `ring-[${nodeColor}]` : "ring-indigo-500"
            )}
            style={nodeStyle}
            onDoubleClick={handleDoubleClick}
        >
            {/* 4 directional handles - both source and target for flexibility */}
            <Handle type="source" position={Position.Top} id="top" className={handleClass} style={{ background: handleColor }} />
            <Handle type="target" position={Position.Top} id="target-top" className={`${handleClass} !opacity-0`} style={{ background: handleColor, top: 0 }} />

            <Handle type="source" position={Position.Bottom} id="bottom" className={handleClass} style={{ background: handleColor }} />
            <Handle type="target" position={Position.Bottom} id="target-bottom" className={`${handleClass} !opacity-0`} style={{ background: handleColor, bottom: 0 }} />

            <Handle type="source" position={Position.Left} id="left" className={handleClass} style={{ background: handleColor }} />
            <Handle type="target" position={Position.Left} id="target-left" className={`${handleClass} !opacity-0`} style={{ background: handleColor, left: 0 }} />

            <Handle type="source" position={Position.Right} id="right" className={handleClass} style={{ background: handleColor }} />
            <Handle type="target" position={Position.Right} id="target-right" className={`${handleClass} !opacity-0`} style={{ background: handleColor, right: 0 }} />

            {isEditing ? (
                <Input
                    ref={inputRef}
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className="h-6 text-sm text-center bg-transparent border-none focus:ring-0 p-0"
                />
            ) : (
                <span className="text-sm font-medium break-words">{label}</span>
            )}
        </div>
    );
}

const nodeTypes = {
    editableNode: EditableNode,
};

export default function MindMapEditor({
    deckId,
    initialNodes = [],
    initialEdges = [],
    onSave,
}: MindMapEditorProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [isToolbarExpanded, setIsToolbarExpanded] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Toggle fullscreen
    const toggleFullscreen = useCallback(() => {
        if (!containerRef.current) return;

        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().then(() => {
                setIsFullscreen(true);
            }).catch(console.error);
        } else {
            document.exitFullscreen().then(() => {
                setIsFullscreen(false);
            }).catch(console.error);
        }
    }, []);

    // Listen for fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // Track changes
    useEffect(() => {
        if (initialNodes.length > 0 || initialEdges.length > 0) {
            setHasChanges(true);
        }
    }, [nodes, edges, initialNodes.length, initialEdges.length]);

    // Handle label change from editable nodes
    const handleLabelChange = useCallback((nodeId: string, newLabel: string) => {
        setNodes((nds) =>
            nds.map((node) =>
                node.id === nodeId
                    ? { ...node, data: { ...node.data, label: newLabel } }
                    : node
            )
        );
        setHasChanges(true);
    }, [setNodes]);

    // Add onLabelChange callback to all nodes
    const nodesWithCallbacks = nodes.map((node) => ({
        ...node,
        data: { ...node.data, onLabelChange: handleLabelChange },
    }));

    // Get edge style from existing edges to maintain consistency
    const getEdgeStyle = useCallback(() => {
        if (edges.length > 0) {
            const firstEdge = edges[0];
            return {
                type: firstEdge.type || 'default',
                style: firstEdge.style || { stroke: '#6366f1', strokeWidth: 2 },
                animated: firstEdge.animated ?? false,
            };
        }
        return {
            type: 'default',
            style: { stroke: '#6366f1', strokeWidth: 2 },
            animated: true,
        };
    }, [edges]);

    const onConnect = useCallback(
        (params: Connection) => {
            const edgeStyle = getEdgeStyle();
            setEdges((eds) => addEdge({
                ...params,
                type: edgeStyle.type,
                style: edgeStyle.style,
                animated: edgeStyle.animated,
            }, eds));
            setHasChanges(true);
        },
        [setEdges, getEdgeStyle]
    );

    const addNode = useCallback(() => {
        const newNode: Node = {
            id: `node-${Date.now()}`,
            type: 'editableNode',
            position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
            data: { label: 'New Topic', isRoot: false },
        };
        setNodes((nds) => [...nds, newNode]);
        setHasChanges(true);
    }, [setNodes]);

    const deleteSelectedNodes = useCallback(() => {
        setNodes((nds) => nds.filter((node) => !node.selected || node.data.isRoot));
        setEdges((eds) => eds.filter((edge) => !edge.selected));
        setHasChanges(true);
    }, [setNodes, setEdges]);

    const handleSave = useCallback(async () => {
        if (!onSave) return;
        setIsSaving(true);
        try {
            await onSave(nodes, edges);
            setHasChanges(false);
        } catch (error) {
            console.error('Failed to save mind map:', error);
        } finally {
            setIsSaving(false);
        }
    }, [nodes, edges, onSave]);

    // Handle initialNodes/Edges updates (e.g. from regeneration)
    const [rfInstance, setRfInstance] = useState<any>(null);

    useEffect(() => {
        if (initialNodes && initialNodes.length > 0) {
            setNodes(initialNodes);
            setEdges(initialEdges);

            // Fit view after a brief delay to allow rendering
            if (rfInstance) {
                setTimeout(() => {
                    rfInstance.fitView({ padding: 0.2, duration: 800 });
                }, 100);
            }
        }
    }, [initialNodes, initialEdges, setNodes, setEdges, rfInstance]);

    return (
        <div
            ref={containerRef}
            className={cn(
                "w-full bg-slate-100 dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800",
                isFullscreen ? "h-screen rounded-none" : "h-[calc(100dvh-220px)] min-h-[400px]"
            )}
        >
            {/* Custom styles for React Flow controls and attribution */}
            <style jsx global>{`
                /* Controls styling - theme aware */
                .react-flow__controls {
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                }
                .react-flow__controls-button {
                    background: white !important;
                    border: 1px solid #e2e8f0 !important;
                    border-radius: 8px !important;
                    margin: 2px !important;
                    width: 28px !important;
                    height: 28px !important;
                    transition: all 0.2s ease !important;
                }
                .react-flow__controls-button:hover {
                    background: #f1f5f9 !important;
                    position: relative;
                }
                .react-flow__controls-button svg {
                    fill: #475569 !important;
                }
                .dark .react-flow__controls-button {
                    background: #1e293b !important;
                    border-color: #334155 !important;
                }
                .dark .react-flow__controls-button:hover {
                    background: #334155 !important;
                }
                .dark .react-flow__controls-button svg {
                    fill: #94a3b8 !important;
                }
                /* Hide React Flow attribution/watermark */
                .react-flow__attribution {
                    display: none !important;
                }
                /* MiniMap styling for dark mode */
                .dark .react-flow__minimap {
                    background: #1e293b !important;
                }
            `}</style>
            <ReactFlow
                nodes={nodesWithCallbacks}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onInit={setRfInstance}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                panOnScroll
                panOnDrag
                zoomOnScroll
                className="bg-slate-50 dark:bg-slate-950"
                defaultEdgeOptions={{
                    style: { stroke: '#6366f1', strokeWidth: 2 },
                    animated: true,
                }}
                proOptions={{ hideAttribution: true }}
            >
                {/* Zoom Controls - Top Left */}
                <Controls
                    position="top-left"
                    showInteractive={false}
                    className="!bg-transparent !border-none !shadow-none !rounded-xl !m-2"
                />

                {/* MiniMap - Bottom Right */}
                <MiniMap
                    position="bottom-right"
                    className="!bg-white dark:!bg-slate-800 !border-slate-200 dark:!border-slate-700 !rounded-xl !shadow-lg"
                    nodeColor={(node) => node.data.isRoot ? '#6366f1' : '#94a3b8'}
                    maskColor="rgba(0, 0, 0, 0.1)"
                    pannable
                    zoomable
                />

                <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="!bg-slate-50 dark:!bg-slate-950" color="#94a3b8" />

                {/* Floating Edit Toolbar - Top Right */}
                <Panel position="top-right" className="m-2">
                    <div className="flex items-center gap-1">
                        <AnimatePresence>
                            {isToolbarExpanded && (
                                <motion.div
                                    initial={{ opacity: 0, width: 0 }}
                                    animate={{ opacity: 1, width: 'auto' }}
                                    exit={{ opacity: 0, width: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="flex items-center gap-1 overflow-hidden"
                                >
                                    {/* Add Node */}
                                    <Button
                                        onClick={addNode}
                                        size="icon"
                                        className="w-10 h-10 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg rounded-xl"
                                        title="Add Node"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </Button>

                                    {/* Delete */}
                                    <Button
                                        onClick={deleteSelectedNodes}
                                        size="icon"
                                        variant="outline"
                                        className="w-10 h-10 bg-white dark:bg-slate-800 shadow-lg border-slate-200 dark:border-slate-700 rounded-xl"
                                        title="Delete Selected"
                                    >
                                        <Trash2 className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                                    </Button>

                                    {/* Save */}
                                    {onSave && (
                                        <Button
                                            onClick={handleSave}
                                            size="icon"
                                            disabled={isSaving || !hasChanges}
                                            className={cn(
                                                "w-10 h-10 shadow-lg rounded-xl",
                                                hasChanges
                                                    ? "bg-green-600 hover:bg-green-700 text-white"
                                                    : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500"
                                            )}
                                            title="Save"
                                        >
                                            {isSaving ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : (
                                                <Save className="w-5 h-5" />
                                            )}
                                        </Button>
                                    )}

                                    {/* Divider */}
                                    <div className="w-px h-8 bg-slate-300 dark:bg-slate-600 mx-1" />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Edit Toggle Button */}
                        <Button
                            onClick={() => setIsToolbarExpanded(!isToolbarExpanded)}
                            size="icon"
                            className={cn(
                                "w-12 h-12 shadow-lg rounded-xl transition-all",
                                isToolbarExpanded
                                    ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-800"
                                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                            )}
                        >
                            {isToolbarExpanded ? (
                                <X className="w-5 h-5" />
                            ) : (
                                <Pencil className="w-5 h-5" />
                            )}
                        </Button>

                        {/* Fullscreen Button */}
                        <Button
                            onClick={toggleFullscreen}
                            size="icon"
                            variant="outline"
                            className="w-12 h-12 bg-white dark:bg-slate-800 shadow-lg border-slate-200 dark:border-slate-700 rounded-xl"
                            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                        >
                            {isFullscreen ? (
                                <Minimize2 className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                            ) : (
                                <Maximize2 className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                            )}
                        </Button>
                    </div>
                </Panel>

                {/* Instructions Panel */}
                <Panel position="bottom-left" className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 m-2">
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                        <strong>Tips:</strong> Double-click to edit • Drag to move • Scroll to pan
                    </p>
                </Panel>
            </ReactFlow>
        </div>
    );
}
