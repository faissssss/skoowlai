import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { db } from '@/lib/db';
import { checkRateLimitFromRequest } from '@/lib/ratelimit';
import { checkFeatureLimit, incrementFeatureUsage } from '@/lib/featureLimits';

export const maxDuration = 120;

// Schema for mind map nodes and edges
const mindMapSchema = z.object({
    nodes: z.array(z.object({
        id: z.string().describe('Unique identifier for the node'),
        label: z.string().describe('Text content of the node (max 40 chars)'),
        isRoot: z.boolean().describe('Whether this is the central/root node'),
        parentId: z.string().optional().describe('ID of the parent node for positioning'),
    })).describe('List of mind map nodes representing concepts'),
    connections: z.array(z.object({
        sourceId: z.string().describe('ID of the source node'),
        targetId: z.string().describe('ID of the target node'),
    })).describe('Connections between nodes'),
});

type MindMapDepth = 'shallow' | 'medium' | 'deep';
type MindMapLayout = 'mindmap' | 'tree' | 'logic' | 'timeline' | 'fishbone' | 'grid';

function buildMindMapPrompt(
    content: string,
    title: string,
    depth: MindMapDepth,
    layout: MindMapLayout
): string {
    const depthConfig = {
        shallow: { nodes: '5-8', levels: '2 levels deep' },
        medium: { nodes: '8-15', levels: '3 levels deep' },
        deep: { nodes: '15-25', levels: '4 levels deep' },
    };

    const layoutInstructions: Record<MindMapLayout, string> = {
        mindmap: 'Create a radial mind map with the main topic in center and related concepts branching outward in all directions.',
        tree: 'Create a hierarchical tree diagram with the main topic at top, flowing down to subtopics and details.',
        logic: 'Create a logic flowchart showing cause-and-effect relationships, decision points, and logical flow between concepts.',
        timeline: 'Create a sequential timeline showing progression, stages, or chronological order of concepts.',
        fishbone: 'Create a fishbone (Ishikawa) diagram with the main topic as the head and major categories as bones, each with contributing factors.',
        grid: 'Create a grid/matrix layout organizing concepts into categories or groups for comparison.',
    };

    const config = depthConfig[depth];

    return `You are an expert at creating educational diagrams. Create a ${layout} structure for the following content.

**TITLE:** ${title}

**LAYOUT TYPE:** ${layout.toUpperCase()}
**ORGANIZATION:** ${layoutInstructions[layout]}

**CONFIGURATION:**
- Number of nodes: ${config.nodes} nodes
- Depth: ${config.levels}

**RULES:**
1. The first node should be the ROOT node with isRoot=true (use the main topic/title)
2. Keep node labels SHORT (max 40 characters) - use keywords, not sentences
3. Create logical connections from parent to child concepts
4. Every node (except root) must have a parentId pointing to its logical parent
5. Make connections flow from more general to more specific concepts
6. Ensure all nodes are connected to the tree
7. Structure the diagram according to the specified layout type

**CONTENT TO ANALYZE:**
${content.slice(0, 20000)}

Generate a clear, educational ${layout} structure now.`;
}


// Color theme definitions
const colorThemes: Record<string, { primary: string; secondary: string; tertiary: string }> = {
    indigo: { primary: '#6366f1', secondary: '#818cf8', tertiary: '#a5b4fc' },
    emerald: { primary: '#10b981', secondary: '#34d399', tertiary: '#6ee7b7' },
    amber: { primary: '#f59e0b', secondary: '#fbbf24', tertiary: '#fcd34d' },
    rose: { primary: '#f43f5e', secondary: '#fb7185', tertiary: '#fda4af' },
    cyan: { primary: '#06b6d4', secondary: '#22d3ee', tertiary: '#67e8f9' },
    violet: { primary: '#8b5cf6', secondary: '#a78bfa', tertiary: '#c4b5fd' },
};

// Edge type configurations per layout
const getEdgeConfig = (layout: MindMapLayout, colorTheme: string) => {
    const colors = colorThemes[colorTheme] || colorThemes.indigo;

    switch (layout) {
        case 'mindmap':
            return {
                type: 'default', // Bezier curves
                animated: true,
                style: { stroke: colors.primary, strokeWidth: 2 },
            };
        case 'tree':
            return {
                type: 'smoothstep', // Right-angle steps
                animated: false,
                style: { stroke: colors.primary, strokeWidth: 2 },
            };
        case 'logic':
            return {
                type: 'step', // Sharp right angles
                animated: false,
                style: { stroke: colors.primary, strokeWidth: 2 },
            };
        case 'timeline':
            return {
                type: 'straight', // Direct lines
                animated: false,
                style: { stroke: colors.primary, strokeWidth: 3 },
            };
        case 'fishbone':
            return {
                type: 'straight', // Direct diagonal lines
                animated: false,
                style: { stroke: colors.primary, strokeWidth: 2 },
            };
        case 'grid':
            return {
                type: 'smoothstep',
                animated: false,
                style: { stroke: colors.primary, strokeWidth: 1, strokeDasharray: '5,5' },
            };
        default:
            return {
                type: 'default',
                animated: true,
                style: { stroke: colors.primary, strokeWidth: 2 },
            };
    }
};

// Convert AI response to React Flow format
function convertToReactFlowFormat(
    data: z.infer<typeof mindMapSchema>,
    layout: MindMapLayout,
    colorTheme: string = 'indigo'
) {
    const colors = colorThemes[colorTheme] || colorThemes.indigo;
    const nodePositions = new Map<string, { x: number; y: number }>();
    const levelMap = new Map<string, number>();
    const childrenByParent = new Map<string, string[]>();

    // Find root and build parent-child relationships
    const rootNode = data.nodes.find(n => n.isRoot);
    if (!rootNode) throw new Error('No root node found');

    // Build children map
    data.nodes.forEach(node => {
        if (node.parentId) {
            const children = childrenByParent.get(node.parentId) || [];
            children.push(node.id);
            childrenByParent.set(node.parentId, children);
        }
    });

    // Calculate levels using BFS
    levelMap.set(rootNode.id, 0);
    const queue = [rootNode.id];
    while (queue.length > 0) {
        const current = queue.shift()!;
        const currentLevel = levelMap.get(current) || 0;
        const children = childrenByParent.get(current) || [];
        children.forEach(childId => {
            levelMap.set(childId, currentLevel + 1);
            queue.push(childId);
        });
    }

    // Layout-specific spacing - INCREASED to prevent overlap
    const getSpacing = () => {
        switch (layout) {
            case 'mindmap': return { h: 280, v: 200 }; // +80h, +50v
            case 'tree': return { h: 250, v: 150 };    // +70h, +50v
            case 'logic': return { h: 300, v: 150 };   // +80h, +50v
            case 'timeline': return { h: 280, v: 120 }; // +80h, +40v
            case 'fishbone': return { h: 220, v: 180 }; // +60h, +60v
            case 'grid': return { h: 280, v: 150 };    // +80h, +50v
            default: return { h: 300, v: 180 };        // +50h, +40v
        }
    };

    const spacing = getSpacing();

    // Calculate positions
    const levelCounts = new Map<number, number>();
    const levelIndices = new Map<number, number>();

    data.nodes.forEach(node => {
        const level = levelMap.get(node.id) || 0;
        levelCounts.set(level, (levelCounts.get(level) || 0) + 1);
    });

    // Get max nodes at any level to calculate proper spacing
    const maxNodesAtLevel = Math.max(...Array.from(levelCounts.values()));

    // Dynamic spacing adjustment based on node count
    const dynamicHSpacing = Math.max(spacing.h, maxNodesAtLevel > 5 ? 280 : spacing.h);
    const dynamicVSpacing = Math.max(spacing.v, maxNodesAtLevel > 5 ? 160 : spacing.v);

    // For mind map: Radial rose pattern - branches spread outward in all directions
    if (layout === 'mindmap') {
        const centerX = 600;
        const centerY = 400;

        // Position root at center
        nodePositions.set(rootNode.id, { x: centerX, y: centerY });

        // Get direct children of root
        const rootChildren = childrenByParent.get(rootNode.id) || [];
        const numRootChildren = rootChildren.length;

        // Store the angle for each branch (so children continue in same direction)
        const branchAngles = new Map<string, number>();

        // Position root's children in a circle around the center
        rootChildren.forEach((childId, idx) => {
            // Distribute evenly around the circle
            const angle = (idx / numRootChildren) * 2 * Math.PI - Math.PI / 2;
            branchAngles.set(childId, angle);

            const radius = 280; // Increased from 200 for main branches
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            nodePositions.set(childId, { x, y });
        });

        // Recursive function to position all descendants
        const positionDescendants = (parentId: string, depth: number) => {
            const children = childrenByParent.get(parentId) || [];
            if (children.length === 0) return;

            const parentPos = nodePositions.get(parentId);
            if (!parentPos) return;

            // Get the angle of this branch (inherited from the root child)
            let branchAngle = branchAngles.get(parentId);

            // If not set, calculate from parent's position relative to root
            if (branchAngle === undefined) {
                branchAngle = Math.atan2(parentPos.y - centerY, parentPos.x - centerX);
            }

            const numChildren = children.length;
            // Increased spread angle for more separation
            const spreadAngle = Math.min(Math.PI * 0.8, numChildren * 0.35);
            // Increased radius for more distance between nodes
            const radius = 180 + depth * 40;

            children.forEach((childId, idx) => {
                // Fan children out slightly around the parent's direction
                let childAngle: number;
                if (numChildren === 1) {
                    childAngle = branchAngle!;
                } else {
                    const offset = (idx - (numChildren - 1) / 2) * (spreadAngle / Math.max(1, numChildren - 1));
                    childAngle = branchAngle! + offset;
                }

                // Store angle for this child's descendants
                branchAngles.set(childId, childAngle);

                const x = parentPos.x + Math.cos(childAngle) * radius;
                const y = parentPos.y + Math.sin(childAngle) * radius;
                nodePositions.set(childId, { x, y });

                // Recursively position this child's children
                positionDescendants(childId, depth + 1);
            });
        };

        // Position all descendants of each root child
        rootChildren.forEach(childId => {
            positionDescendants(childId, 1);
        });
    } else {
        // For other layouts, use the level-based positioning
        // Calculate node positions based on layout
        data.nodes.forEach(node => {
            const level = levelMap.get(node.id) || 0;
            const count = levelCounts.get(level) || 1;
            const index = levelIndices.get(level) || 0;
            levelIndices.set(level, index + 1);

            let x: number, y: number;

            switch (layout) {
                case 'tree': {
                    // Top-down tree with LARGER bounding boxes
                    const nodeWidth = 220;  // Increased from 180
                    const nodeGap = 80;     // Increased from 40
                    const totalWidth = count * nodeWidth + (count - 1) * nodeGap;
                    const startX = 600 - totalWidth / 2 + nodeWidth / 2;
                    x = startX + index * (nodeWidth + nodeGap);
                    y = level * dynamicVSpacing + 80;
                    break;
                }
                case 'logic': {
                    // Left-to-right flowchart with LARGER spacing
                    const nodeHeight = 80;  // Increased from 60
                    const nodeGap = 80;     // Increased from 50
                    const totalHeight = count * nodeHeight + (count - 1) * nodeGap;
                    x = level * dynamicHSpacing + 150;
                    const startY = 350 - totalHeight / 2 + nodeHeight / 2;
                    y = startY + index * (nodeHeight + nodeGap);
                    break;
                }
                case 'timeline': {
                    // Horizontal timeline with better spacing
                    if (node.isRoot) {
                        x = 100;
                        y = 300;
                    } else {
                        x = 100 + level * dynamicHSpacing;
                        // Alternate above and below with proper spacing
                        const verticalOffset = (index - (count - 1) / 2) * 100;
                        y = 300 + verticalOffset;
                    }
                    break;
                }
                case 'fishbone': {
                    // Fishbone with head on right, better spacing
                    const boneSpacing = dynamicHSpacing;
                    if (node.isRoot) {
                        x = 800;
                        y = 300;
                    } else if (level === 1) {
                        x = 800 - (index + 1) * boneSpacing;
                        y = index % 2 === 0 ? 150 : 450;
                    } else {
                        const parentPos = nodePositions.get(node.parentId || '') || { x: 400, y: 300 };
                        const subOffset = (index + 1) * 80;
                        x = parentPos.x - subOffset;
                        y = parentPos.y + (index % 2 === 0 ? -50 : 50);
                    }
                    break;
                }
                case 'grid': {
                    // Grid/matrix layout with proper spacing
                    if (node.isRoot) {
                        x = 500;
                        y = 40;
                    } else {
                        const nonRootNodes = data.nodes.filter(n => !n.isRoot);
                        const nodeIndex = nonRootNodes.findIndex(n => n.id === node.id);
                        const cols = Math.min(4, Math.ceil(Math.sqrt(nonRootNodes.length)));
                        const nodeWidth = 220;
                        const nodeHeight = 120;
                        x = 150 + (nodeIndex % cols) * nodeWidth;
                        y = 150 + Math.floor(nodeIndex / cols) * nodeHeight;
                    }
                    break;
                }
                default: {
                    const nodeWidth = 200;
                    const totalWidth = count * nodeWidth + (count - 1) * 50;
                    const startX = 500 - totalWidth / 2 + nodeWidth / 2;
                    x = startX + index * (nodeWidth + 50);
                    y = level * dynamicVSpacing + 50;
                }
            }

            nodePositions.set(node.id, { x, y });
        });
    } // end else (non-mindmap layouts)

    // Get edge configuration for this layout
    const edgeConfig = getEdgeConfig(layout, colorTheme);

    // Create React Flow nodes with color theme
    const nodes = data.nodes.map((node, idx) => {
        const level = levelMap.get(node.id) || 0;
        // Assign colors based on level
        const nodeColor = node.isRoot ? colors.primary : (level === 1 ? colors.secondary : colors.tertiary);

        return {
            id: node.id,
            type: 'editableNode',
            position: nodePositions.get(node.id) || { x: 0, y: 0 },
            data: {
                label: node.label,
                isRoot: node.isRoot,
                color: nodeColor,
                colorTheme,
            },
        };
    });

    // Smart handle selection based on layout type and node positions
    const getSmartHandles = (
        sourceId: string,
        targetId: string,
        layoutType: MindMapLayout
    ): { sourceHandle: string; targetHandle: string } => {
        const sourcePos = nodePositions.get(sourceId);
        const targetPos = nodePositions.get(targetId);

        if (!sourcePos || !targetPos) {
            return { sourceHandle: 'bottom', targetHandle: 'top' };
        }

        // Layout-specific handle logic
        switch (layoutType) {
            case 'tree':
                // Top-down: Parent outputs from bottom, child receives at top
                return { sourceHandle: 'bottom', targetHandle: 'top' };

            case 'logic':
                // Left-to-right: Parent outputs from right, child receives at left
                return { sourceHandle: 'right', targetHandle: 'left' };

            case 'timeline':
                // Horizontal timeline: main spine uses right->left, branches use top/bottom
                if (Math.abs(targetPos.y - sourcePos.y) > 50) {
                    // Vertical connection
                    return targetPos.y > sourcePos.y
                        ? { sourceHandle: 'bottom', targetHandle: 'top' }
                        : { sourceHandle: 'top', targetHandle: 'bottom' };
                }
                return { sourceHandle: 'right', targetHandle: 'left' };

            case 'fishbone':
                // Fishbone: Calculate based on position relative to spine
                if (targetPos.y < sourcePos.y) {
                    return { sourceHandle: 'top', targetHandle: 'bottom' };
                } else if (targetPos.y > sourcePos.y) {
                    return { sourceHandle: 'bottom', targetHandle: 'top' };
                }
                return { sourceHandle: 'left', targetHandle: 'right' };

            case 'grid':
                // Grid: Use closest handles
                return getClosestHandles(sourcePos, targetPos);

            case 'mindmap':
            default:
                // Radial mind map: Calculate based on angle/direction
                return getClosestHandles(sourcePos, targetPos);
        }
    };

    // Calculate closest handles for organic layouts
    const getClosestHandles = (
        sourcePos: { x: number; y: number },
        targetPos: { x: number; y: number }
    ): { sourceHandle: string; targetHandle: string } => {
        const dx = targetPos.x - sourcePos.x;
        const dy = targetPos.y - sourcePos.y;

        // Determine primary direction
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (absDx > absDy) {
            // Horizontal dominant
            if (dx > 0) {
                return { sourceHandle: 'right', targetHandle: 'left' };
            } else {
                return { sourceHandle: 'left', targetHandle: 'right' };
            }
        } else {
            // Vertical dominant
            if (dy > 0) {
                return { sourceHandle: 'bottom', targetHandle: 'top' };
            } else {
                return { sourceHandle: 'top', targetHandle: 'bottom' };
            }
        }
    };

    // Create React Flow edges with layout-specific configuration and smart handles
    const edges = data.connections.map((conn, index) => {
        const handles = getSmartHandles(conn.sourceId, conn.targetId, layout);

        return {
            id: `edge-${index}`,
            source: conn.sourceId,
            target: conn.targetId,
            sourceHandle: handles.sourceHandle,
            targetHandle: `target-${handles.targetHandle}`,
            type: edgeConfig.type,
            animated: edgeConfig.animated,
            style: edgeConfig.style,
        };
    });

    return { nodes, edges, colorTheme, layout };
}


// POST - Generate mind map from deck content
export async function POST(req: NextRequest) {
    // 1. Authenticate user first
    const { user, errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    // Rate limit check
    const rateLimitResponse = await checkRateLimitFromRequest(req);
    if (rateLimitResponse) return rateLimitResponse;

    // Check feature usage limit
    const limitCheck = await checkFeatureLimit('mindmap');
    if (!limitCheck.allowed) {
        return limitCheck.errorResponse;
    }

    try {
        const body = await req.json();

        // Strict input validation
        const generateMindMapSchema = z.object({
            deckId: z.string().uuid(),
            depth: z.enum(['shallow', 'medium', 'deep']).default('medium'),
            style: z.enum(['mindmap', 'tree', 'logic', 'timeline', 'fishbone', 'grid']).default('mindmap'),
            colorTheme: z.enum(['indigo', 'emerald', 'amber', 'rose', 'cyan', 'violet']).default('indigo')
        }).strict();

        const payload = generateMindMapSchema.safeParse(body);

        if (!payload.success) {
            return NextResponse.json({
                error: 'Invalid request body',
                details: payload.error.flatten()
            }, { status: 400 });
        }

        const { deckId, depth, style, colorTheme } = payload.data;

        if (!deckId) {
            return NextResponse.json({ error: 'deckId is required' }, { status: 400 });
        }

        // Verify deck ownership (Authorization)
        const deck = await db.deck.findUnique({
            where: { id: deckId },
        });

        if (!deck) {
            return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
        }

        if (deck.userId !== user.id) {
            return NextResponse.json({ error: 'Unauthorized access to deck' }, { status: 403 });
        }

        const sourceContent = deck.summary || deck.content;
        const prompt = buildMindMapPrompt(sourceContent, deck.title, depth, style);

        // Generate mind map structure using AI
        const { object } = await generateObject({
            model: google('gemini-2.5-flash'),
            schema: mindMapSchema,
            messages: [{ role: 'user', content: prompt }],
        });

        // Convert to React Flow format with color theme
        const { nodes, edges } = convertToReactFlowFormat(object, style, colorTheme);

        // Save to database (upsert)
        await db.mindMap.upsert({
            where: { deckId },
            create: {
                deckId,
                nodes: JSON.stringify(nodes),
                edges: JSON.stringify(edges),
            },
            update: {
                nodes: JSON.stringify(nodes),
                edges: JSON.stringify(edges),
            },
        });

        // Increment usage count after successful generation
        if (limitCheck.user) {
            await incrementFeatureUsage(limitCheck.user.id, 'mindmap');
        }

        return NextResponse.json({
            success: true,
            nodes,
            edges,
            colorTheme,
        });

    } catch (error) {
        console.error('Mind map generation error:', error);
        // Generic error message for client, detailed log for server
        return NextResponse.json({
            error: 'Internal Server Error',
            details: 'Failed to generate mind map. Please try again later.'
        }, { status: 500 });
    }
}

// GET - Fetch existing mind map
export async function GET(req: NextRequest) {
    // Authenticate user
    const { user, errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    try {
        const { searchParams } = new URL(req.url);
        const deckId = searchParams.get('deckId');

        if (!deckId) {
            return NextResponse.json({ error: 'deckId is required' }, { status: 400 });
        }

        // Verify deck ownership via deck lookup
        // MindMap table might not have userId, but deck does, and relation is one-to-one
        const deck = await db.deck.findUnique({
            where: { id: deckId },
            select: { userId: true }
        });

        if (!deck) {
            return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
        }

        if (deck.userId !== user.id) {
            return NextResponse.json({ error: 'Unauthorized access to deck' }, { status: 403 });
        }

        const mindMap = await db.mindMap.findUnique({
            where: { deckId },
        });

        if (!mindMap) {
            return NextResponse.json({ nodes: [], edges: [] });
        }

        return NextResponse.json({
            nodes: JSON.parse(mindMap.nodes),
            edges: JSON.parse(mindMap.edges),
        });

    } catch (error) {
        console.error('Mind map fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch mind map' }, { status: 500 });
    }
}

// PUT - Update/save mind map
export async function PUT(req: NextRequest) {
    // Authenticate user
    const { user, errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    try {
        const body = await req.json();
        const { deckId, nodes, edges } = body;

        if (!deckId) {
            return NextResponse.json({ error: 'deckId is required' }, { status: 400 });
        }

        // Verify deck ownership
        const deck = await db.deck.findUnique({
            where: { id: deckId },
            select: { userId: true }
        });

        if (!deck) {
            return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
        }

        if (deck.userId !== user.id) {
            return NextResponse.json({ error: 'Unauthorized access to deck' }, { status: 403 });
        }

        await db.mindMap.upsert({
            where: { deckId },
            create: {
                deckId,
                nodes: JSON.stringify(nodes),
                edges: JSON.stringify(edges),
            },
            update: {
                nodes: JSON.stringify(nodes),
                edges: JSON.stringify(edges),
            },
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Mind map save error:', error);
        return NextResponse.json({ error: 'Failed to save mind map' }, { status: 500 });
    }
}
