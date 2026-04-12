/**
 * Integration tests for /api/flashcards endpoint
 * 
 * Tests the migrated flashcards endpoint using LLM Router with:
 * - Structured output generation
 * - Schema validation
 * - Flashcard configuration (focus, format, detail)
 * - Error handling
 * - Authorization checks
 * 
 * Validates: Requirements 15.4, 15.5, 15.6
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST, GET, DELETE } from './route';
import { NextRequest } from 'next/server';

// Valid CUID for testing
const TEST_USER_ID = 'clh1234567890abcdefghij';
const TEST_DECK_ID = 'clh9876543210zyxwvutsrq';

// Mock dependencies
vi.mock('@/lib/csrf', () => ({
  checkCsrfOrigin: vi.fn(() => null),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(() => ({
    user: { id: TEST_USER_ID, email: 'test@example.com' },
    errorResponse: null,
  })),
}));

vi.mock('@/lib/ratelimit', () => ({
  checkRateLimitFromRequest: vi.fn(() => null),
}));

vi.mock('@/lib/featureLimits', () => ({
  checkFeatureLimit: vi.fn(() => Promise.resolve({
    allowed: true,
    user: { id: TEST_USER_ID },
  })),
  incrementFeatureUsage: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/db', () => ({
  db: {
    deck: {
      findUnique: vi.fn(() => Promise.resolve({
        id: TEST_DECK_ID,
        userId: TEST_USER_ID,
        summary: 'Test summary content for flashcard generation',
        content: 'Test content',
      })),
    },
    card: {
      deleteMany: vi.fn(() => Promise.resolve({ count: 0 })),
      createMany: vi.fn(() => Promise.resolve({ count: 10 })),
      findMany: vi.fn(() => Promise.resolve([
        { id: '1', deckId: TEST_DECK_ID, front: 'Term 1', back: 'Definition 1' },
        { id: '2', deckId: TEST_DECK_ID, front: 'Term 2', back: 'Definition 2' },
      ])),
    },
  },
}));

vi.mock('@/lib/llm/config', () => ({
  ProviderConfig: {
    load: vi.fn(() => ({
      getPrimaryProvider: () => 'groq',
      getFallbackProvider: () => 'gemini',
      isFallbackEnabled: () => true,
      isContentSizeRoutingEnabled: () => true,
      getContentSizeThreshold: () => 6000,
    })),
  },
}));

vi.mock('@/lib/llm/router', () => ({
  LLMRouter: vi.fn(function(this: any) {
    this.generateObject = vi.fn(async () => ({
      object: {
        flashcards: [
          { front: 'Generated Term 1', back: 'Generated Definition 1' },
          { front: 'Generated Term 2', back: 'Generated Definition 2' },
          { front: 'Generated Term 3', back: 'Generated Definition 3' },
          { front: 'Generated Term 4', back: 'Generated Definition 4' },
          { front: 'Generated Term 5', back: 'Generated Definition 5' },
          { front: 'Generated Term 6', back: 'Generated Definition 6' },
          { front: 'Generated Term 7', back: 'Generated Definition 7' },
          { front: 'Generated Term 8', back: 'Generated Definition 8' },
          { front: 'Generated Term 9', back: 'Generated Definition 9' },
          { front: 'Generated Term 10', back: 'Generated Definition 10' },
        ],
      },
      rateLimitInfo: {
        remaining: 25,
        limit: 30,
        reset: new Date(),
        percentage: 16.7,
      },
      degradedMode: false,
    }));
  }),
  DEFAULT_MODEL_MAPPING: {
    flashcards: { provider: 'groq', model: 'llama-3.1-8b-instant', priority: 'medium' },
  },
}));

describe('POST /api/flashcards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should generate flashcards with default configuration', async () => {
    const request = new NextRequest('http://localhost:3000/api/flashcards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deckId: TEST_DECK_ID,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.count).toBe(2);
    expect(data.cards).toHaveLength(2);

    const { db } = await import('@/lib/db');
    expect(db.card.deleteMany).toHaveBeenCalledWith({
      where: { deckId: TEST_DECK_ID },
    });
    expect(db.card.createMany).toHaveBeenCalled();
  });

  it('should generate flashcards with custom count', async () => {
    const request = new NextRequest('http://localhost:3000/api/flashcards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deckId: TEST_DECK_ID,
        count: 20,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  it('should generate flashcards with custom focus', async () => {
    const request = new NextRequest('http://localhost:3000/api/flashcards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deckId: TEST_DECK_ID,
        focus: 'terms',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  it('should generate flashcards with custom format', async () => {
    const request = new NextRequest('http://localhost:3000/api/flashcards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deckId: TEST_DECK_ID,
        format: 'qa',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  it('should generate flashcards with custom detail level', async () => {
    const request = new NextRequest('http://localhost:3000/api/flashcards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deckId: TEST_DECK_ID,
        detail: 'detailed',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  it('should pass correct parameters to LLM router', async () => {
    const request = new NextRequest('http://localhost:3000/api/flashcards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deckId: TEST_DECK_ID,
        count: 15,
        focus: 'concepts',
        format: 'practical',
        detail: 'brief',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const { LLMRouter } = await import('@/lib/llm/router');
    const routerInstance = vi.mocked(LLMRouter).mock.results[0]?.value;
    
    expect(routerInstance.generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        schema: expect.any(Object),
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('15'),
          }),
        ]),
        temperature: 0.4,
        feature: 'flashcards',
      })
    );
  });

  it('should handle missing deckId', async () => {
    const request = new NextRequest('http://localhost:3000/api/flashcards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid request body');
  });

  it('should handle deck not found', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.deck.findUnique).mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost:3000/api/flashcards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deckId: TEST_DECK_ID,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Deck not found');
  });

  it('should handle unauthorized deck access', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.deck.findUnique).mockResolvedValueOnce({
      id: TEST_DECK_ID,
      userId: 'different-user-id',
      summary: 'Test summary',
      content: 'Test content',
    } as any);

    const request = new NextRequest('http://localhost:3000/api/flashcards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deckId: TEST_DECK_ID,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized access to deck');
  });

  it('should handle invalid count value', async () => {
    const request = new NextRequest('http://localhost:3000/api/flashcards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deckId: TEST_DECK_ID,
        count: 100, // Exceeds max of 50
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid request body');
  });

  it('should handle invalid focus value', async () => {
    const request = new NextRequest('http://localhost:3000/api/flashcards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deckId: TEST_DECK_ID,
        focus: 'invalid',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid request body');
  });

  it('should increment feature usage after successful generation', async () => {
    const request = new NextRequest('http://localhost:3000/api/flashcards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deckId: TEST_DECK_ID,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const { incrementFeatureUsage } = await import('@/lib/featureLimits');
    expect(incrementFeatureUsage).toHaveBeenCalledWith(TEST_USER_ID, 'flashcard');
  });

  it('should handle LLM router errors gracefully', async () => {
    const { LLMRouter } = await import('@/lib/llm/router');
    
    // Mock router to throw error
    vi.mocked(LLMRouter).mockImplementationOnce(function(this: any) {
      this.generateObject = vi.fn().mockRejectedValue(new Error('LLM service unavailable'));
    } as any);

    const request = new NextRequest('http://localhost:3000/api/flashcards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deckId: TEST_DECK_ID,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Internal Server Error');
  });
});

describe('GET /api/flashcards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch existing flashcards', async () => {
    const request = new NextRequest(`http://localhost:3000/api/flashcards?deckId=${TEST_DECK_ID}`, {
      method: 'GET',
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.cards).toHaveLength(2);
    expect(data.cards[0].front).toBe('Term 1');
  });

  it('should handle missing deckId in GET', async () => {
    const request = new NextRequest('http://localhost:3000/api/flashcards', {
      method: 'GET',
    });

    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('deckId is required');
  });

  it('should handle unauthorized access in GET', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.deck.findUnique).mockResolvedValueOnce({
      userId: 'different-user-id',
    } as any);

    const request = new NextRequest(`http://localhost:3000/api/flashcards?deckId=${TEST_DECK_ID}`, {
      method: 'GET',
    });

    const response = await GET(request);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized access to deck');
  });
});

describe('DELETE /api/flashcards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete flashcards', async () => {
    const request = new NextRequest(`http://localhost:3000/api/flashcards?deckId=${TEST_DECK_ID}`, {
      method: 'DELETE',
    });

    const response = await DELETE(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);

    const { db } = await import('@/lib/db');
    expect(db.card.deleteMany).toHaveBeenCalledWith({
      where: { deckId: TEST_DECK_ID },
    });
  });

  it('should handle missing deckId in DELETE', async () => {
    const request = new NextRequest('http://localhost:3000/api/flashcards', {
      method: 'DELETE',
    });

    const response = await DELETE(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('deckId is required');
  });

  it('should handle unauthorized access in DELETE', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.deck.findUnique).mockResolvedValueOnce({
      userId: 'different-user-id',
    } as any);

    const request = new NextRequest(`http://localhost:3000/api/flashcards?deckId=${TEST_DECK_ID}`, {
      method: 'DELETE',
    });

    const response = await DELETE(request);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized access to deck');
  });
});
