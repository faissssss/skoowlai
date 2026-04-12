/**
 * Integration tests for /api/mindmap endpoint
 * 
 * Tests the migrated mindmap endpoint using LLM Router with:
 * - Structured output generation for mind maps
 * - Multiple layout types (mindmap, tree, logic, timeline, fishbone, grid)
 * - Custom depth and color themes
 * - Schema validation
 * - Error handling
 * 
 * Validates: Requirements 15.4, 15.5, 15.6
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST, GET, PUT } from './route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/csrf', () => ({
    checkCsrfOrigin: vi.fn(() => null),
}));

vi.mock('@/lib/auth', () => ({
    requireAuth: vi.fn(() => ({
        user: { id: 'user123', email: 'test@example.com' },
        errorResponse: null,
    })),
}));

vi.mock('@/lib/ratelimit', () => ({
    checkRateLimitFromRequest: vi.fn(() => null),
}));

vi.mock('@/lib/featureLimits', () => ({
    checkFeatureLimit: vi.fn(() => ({
        allowed: true,
        errorResponse: null,
        user: { id: 'user123' },
    })),
    incrementFeatureUsage: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
    db: {
        deck: {
            findUnique: vi.fn(),
        },
        mindMap: {
            findUnique: vi.fn(),
            upsert: vi.fn(),
        },
    },
}));

vi.mock('@/lib/llm/router', () => {
    const mockGenerateObject = vi.fn();
    class MockLLMRouter {
        generateObject = mockGenerateObject;
    }
    return {
        LLMRouter: vi.fn(MockLLMRouter),
        DEFAULT_MODEL_MAPPING: {},
        __mockGenerateObject: mockGenerateObject,
    };
});

vi.mock('@/lib/llm/config', () => ({
    ProviderConfig: {
        load: vi.fn(() => ({
            getPrimaryProvider: () => 'groq',
            getFallbackProvider: () => 'gemini',
            isFallbackEnabled: () => true,
            getModelMapping: () => ({}),
            isContentSizeRoutingEnabled: () => true,
            getContentSizeThreshold: () => 6000,
            isMigrationEnabled: () => true,
            getEndpointOverride: () => undefined,
        })),
    },
}));

import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { checkRateLimitFromRequest } from '@/lib/ratelimit';
import { checkFeatureLimit, incrementFeatureUsage } from '@/lib/featureLimits';
// Removed unused import

describe('/api/mindmap', () => {
    const mockDeckId = 'deck123';
    const mockDeck = {
        id: mockDeckId,
        userId: 'user123',
        title: 'Test Deck',
        content: 'Test content for mind map generation',
        summary: 'Test summary',
    };

    const mockMindMapData = {
        nodes: [
            { id: '1', label: 'Root Node', isRoot: true },
            { id: '2', label: 'Child 1', isRoot: false, parentId: '1' },
            { id: '3', label: 'Child 2', isRoot: false, parentId: '1' },
        ],
        connections: [
            { sourceId: '1', targetId: '2' },
            { sourceId: '1', targetId: '3' },
        ],
    };

    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(requireAuth).mockResolvedValue({
            user: { id: 'user123', email: 'test@example.com' },
            errorResponse: null,
        } as any);
        vi.mocked(checkRateLimitFromRequest).mockResolvedValue(null as any);
        vi.mocked(checkFeatureLimit).mockResolvedValue({
            allowed: true,
            errorResponse: null,
            user: { id: 'user123' },
        } as any);

        vi.mocked(db.deck.findUnique).mockResolvedValue(mockDeck as any);
        vi.mocked(db.mindMap.findUnique).mockResolvedValue(null);
        vi.mocked(db.mindMap.upsert).mockResolvedValue({
            id: 'mindmap123',
            deckId: mockDeckId,
            nodes: JSON.stringify([]),
            edges: JSON.stringify([]),
        } as any);

        vi.mocked(require('@/lib/llm/router').__mockGenerateObject).mockResolvedValue({
            object: mockMindMapData,
        });
    });

    describe('POST - Generate mind map', () => {
        it('should generate mind map with default parameters', async () => {
            const req = new NextRequest('http://localhost:3000/api/mindmap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deckId: mockDeckId }),
            });

            const response = (await POST(req))!
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.nodes).toBeDefined();
            expect(data.edges).toBeDefined();
            expect(data.colorTheme).toBe('indigo'); // default
        });

        it('should generate mind map with custom depth', async () => {
            const req = new NextRequest('http://localhost:3000/api/mindmap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    deckId: mockDeckId,
                    depth: 'deep'
                }),
            });

            const response = (await POST(req))!
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
        });

        it('should generate mind map with custom style', async () => {
            const req = new NextRequest('http://localhost:3000/api/mindmap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    deckId: mockDeckId,
                    style: 'tree'
                }),
            });

            const response = (await POST(req))!
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
        });

        it('should generate mind map with custom color theme', async () => {
            const req = new NextRequest('http://localhost:3000/api/mindmap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    deckId: mockDeckId,
                    colorTheme: 'emerald'
                }),
            });

            const response = (await POST(req))!
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.colorTheme).toBe('emerald');
        });

        it('should generate mind map with all custom parameters', async () => {
            const req = new NextRequest('http://localhost:3000/api/mindmap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    deckId: mockDeckId,
                    depth: 'shallow',
                    style: 'fishbone',
                    colorTheme: 'rose'
                }),
            });

            const response = (await POST(req))!
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.colorTheme).toBe('rose');
        });

        it('should save generated mind map to database', async () => {
            const req = new NextRequest('http://localhost:3000/api/mindmap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deckId: mockDeckId }),
            });

            await POST(req);

            expect(db.mindMap.upsert).toHaveBeenCalledWith({
                where: { deckId: mockDeckId },
                create: expect.objectContaining({
                    deckId: mockDeckId,
                    nodes: expect.any(String),
                    edges: expect.any(String),
                }),
                update: expect.objectContaining({
                    nodes: expect.any(String),
                    edges: expect.any(String),
                }),
            });
        });

        it('should increment feature usage after successful generation', async () => {
            const req = new NextRequest('http://localhost:3000/api/mindmap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deckId: mockDeckId }),
            });

            await POST(req);

            expect(incrementFeatureUsage).toHaveBeenCalledWith('user123', 'mindmap');
        });

        it('should return 400 for missing deckId', async () => {
            const req = new NextRequest('http://localhost:3000/api/mindmap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });

            const response = (await POST(req))!
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('Invalid request body');
        });

        it('should return 400 for invalid depth value', async () => {
            const req = new NextRequest('http://localhost:3000/api/mindmap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    deckId: mockDeckId,
                    depth: 'invalid'
                }),
            });

            const response = (await POST(req))!
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('Invalid request body');
        });

        it('should return 400 for invalid style value', async () => {
            const req = new NextRequest('http://localhost:3000/api/mindmap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    deckId: mockDeckId,
                    style: 'invalid'
                }),
            });

            const response = (await POST(req))!
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('Invalid request body');
        });

        it('should return 404 for non-existent deck', async () => {
            vi.mocked(db.deck.findUnique).mockResolvedValue(null);

            const req = new NextRequest('http://localhost:3000/api/mindmap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deckId: mockDeckId }),
            });

            const response = (await POST(req))!
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error).toBe('Deck not found');
        });

        it('should return 403 for unauthorized deck access', async () => {
            vi.mocked(db.deck.findUnique).mockResolvedValue({
                ...mockDeck,
                userId: 'different-user',
            } as any);

            const req = new NextRequest('http://localhost:3000/api/mindmap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deckId: mockDeckId }),
            });

            const response = (await POST(req))!
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.error).toBe('Unauthorized access to deck');
        });

        it('should return 401 for unauthenticated request', async () => {
            vi.mocked(requireAuth).mockResolvedValue({
                user: null,
                errorResponse: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
            } as any);

            const req = new NextRequest('http://localhost:3000/api/mindmap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deckId: mockDeckId }),
            });

            const response = (await POST(req))!

            expect(response.status).toBe(401);
        });

        it('should return error when feature limit exceeded', async () => {
            vi.mocked(checkFeatureLimit).mockResolvedValue({
                allowed: false,
                errorResponse: new Response(JSON.stringify({ error: 'Feature limit exceeded' }), { status: 429 }),
                user: null,
            } as any);

            const req = new NextRequest('http://localhost:3000/api/mindmap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deckId: mockDeckId }),
            });

            const response = (await POST(req))!

            expect(response.status).toBe(429);
        });

        it('should return error when rate limit exceeded', async () => {
            vi.mocked(checkRateLimitFromRequest).mockResolvedValue(
                new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 }) as any
            );

            const req = new NextRequest('http://localhost:3000/api/mindmap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deckId: mockDeckId }),
            });

            const response = (await POST(req))!

            expect(response.status).toBe(429);
        });

        it('should handle LLM generation errors gracefully', async () => {
            vi.mocked(require('@/lib/llm/router').__mockGenerateObject).mockRejectedValue(new Error('LLM error'));

            const req = new NextRequest('http://localhost:3000/api/mindmap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deckId: mockDeckId }),
            });

            const response = (await POST(req))!
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe('Internal Server Error');
        });
    });

    describe('GET - Fetch existing mind map', () => {
        const mockNodes = [
            { id: '1', label: 'Root', isRoot: true, position: { x: 0, y: 0 } },
        ];
        const mockEdges = [
            { id: 'edge-1', source: '1', target: '2' },
        ];

        it('should fetch existing mind map', async () => {
            vi.mocked(db.mindMap.findUnique).mockResolvedValue({
                id: 'mindmap123',
                deckId: mockDeckId,
                nodes: JSON.stringify(mockNodes),
                edges: JSON.stringify(mockEdges),
            } as any);

            const req = new NextRequest(`http://localhost:3000/api/mindmap?deckId=${mockDeckId}`);
            const response = await GET(req);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.nodes).toEqual(mockNodes);
            expect(data.edges).toEqual(mockEdges);
        });

        it('should return empty arrays when mind map does not exist', async () => {
            vi.mocked(db.mindMap.findUnique).mockResolvedValue(null);

            const req = new NextRequest(`http://localhost:3000/api/mindmap?deckId=${mockDeckId}`);
            const response = await GET(req);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.nodes).toEqual([]);
            expect(data.edges).toEqual([]);
        });

        it('should return 400 for missing deckId', async () => {
            const req = new NextRequest('http://localhost:3000/api/mindmap');
            const response = await GET(req);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('deckId is required');
        });

        it('should return 404 for non-existent deck', async () => {
            vi.mocked(db.deck.findUnique).mockResolvedValue(null);

            const req = new NextRequest(`http://localhost:3000/api/mindmap?deckId=${mockDeckId}`);
            const response = await GET(req);
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error).toBe('Deck not found');
        });

        it('should return 403 for unauthorized deck access', async () => {
            vi.mocked(db.deck.findUnique).mockResolvedValue({
                ...mockDeck,
                userId: 'different-user',
            } as any);

            const req = new NextRequest(`http://localhost:3000/api/mindmap?deckId=${mockDeckId}`);
            const response = await GET(req);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.error).toBe('Unauthorized access to deck');
        });
    });

    describe('PUT - Update mind map', () => {
        const mockNodes = [
            { id: '1', label: 'Updated Root', isRoot: true, position: { x: 0, y: 0 } },
        ];
        const mockEdges = [
            { id: 'edge-1', source: '1', target: '2' },
        ];

        it('should update mind map successfully', async () => {
            const req = new NextRequest('http://localhost:3000/api/mindmap', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deckId: mockDeckId,
                    nodes: mockNodes,
                    edges: mockEdges,
                }),
            });

            const response = await PUT(req);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
        });

        it('should save updated mind map to database', async () => {
            const req = new NextRequest('http://localhost:3000/api/mindmap', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deckId: mockDeckId,
                    nodes: mockNodes,
                    edges: mockEdges,
                }),
            });

            await PUT(req);

            expect(db.mindMap.upsert).toHaveBeenCalledWith({
                where: { deckId: mockDeckId },
                create: {
                    deckId: mockDeckId,
                    nodes: JSON.stringify(mockNodes),
                    edges: JSON.stringify(mockEdges),
                },
                update: {
                    nodes: JSON.stringify(mockNodes),
                    edges: JSON.stringify(mockEdges),
                },
            });
        });

        it('should return 400 for missing deckId', async () => {
            const req = new NextRequest('http://localhost:3000/api/mindmap', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nodes: mockNodes,
                    edges: mockEdges,
                }),
            });

            const response = await PUT(req);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('deckId is required');
        });

        it('should return 404 for non-existent deck', async () => {
            vi.mocked(db.deck.findUnique).mockResolvedValue(null);

            const req = new NextRequest('http://localhost:3000/api/mindmap', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deckId: mockDeckId,
                    nodes: mockNodes,
                    edges: mockEdges,
                }),
            });

            const response = await PUT(req);
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error).toBe('Deck not found');
        });

        it('should return 403 for unauthorized deck access', async () => {
            vi.mocked(db.deck.findUnique).mockResolvedValue({
                ...mockDeck,
                userId: 'different-user',
            } as any);

            const req = new NextRequest('http://localhost:3000/api/mindmap', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deckId: mockDeckId,
                    nodes: mockNodes,
                    edges: mockEdges,
                }),
            });

            const response = await PUT(req);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.error).toBe('Unauthorized access to deck');
        });
    });
});
