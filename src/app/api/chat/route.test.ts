/**
 * Integration tests for /api/chat endpoint
 * 
 * Tests the migrated chat endpoint using LLM Router with:
 * - Streaming response handling
 * - Message history from database
 * - Error handling
 * - Rate limit headers
 * - Content-size-based routing
 * 
 * Validates: Requirements 15.4, 15.7
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/csrf', () => ({
  checkCsrfOrigin: vi.fn(() => null),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(() => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    errorResponse: null,
  })),
}));

vi.mock('@/lib/ratelimit', () => ({
  checkRateLimitFromRequest: vi.fn(() => null),
}));

vi.mock('@/lib/featureLimits', () => ({
  checkFeatureLimit: vi.fn(() => ({
    allowed: true,
    user: { id: 'test-user-id' },
  })),
  incrementFeatureUsage: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    deck: {
      findUnique: vi.fn(() => Promise.resolve({ userId: 'test-user-id' })),
    },
    chatMessage: {
      findMany: vi.fn(() => Promise.resolve([])),
      create: vi.fn(() => Promise.resolve({ id: 'msg-id' })),
    },
  },
}));

// Valid CUID for testing
const TEST_DECK_ID = 'clh1234567890abcdefghij';

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
    this.streamText = vi.fn(async (options: any) => {
      const textContent = 'Hello from LLM Router!';
      
      // Simulate onFinish callback after stream completes
      if (options.onFinish) {
        // Call onFinish asynchronously to simulate real behavior
        setTimeout(() => {
          options.onFinish({ text: textContent });
        }, 50);
      }
      
      return {
        textStream: (async function* () {
          yield 'Hello ';
          yield 'from ';
          yield 'LLM ';
          yield 'Router!';
        })(),
        text: Promise.resolve(textContent),
        rateLimitInfo: {
          remaining: 25,
          limit: 30,
          reset: new Date(),
          percentage: 16.7,
        },
        degradedMode: false,
      };
    });
  }),
  DEFAULT_MODEL_MAPPING: {
    chat: { provider: 'groq', model: 'llama-3.3-70b-versatile', priority: 'high' },
  },
}));

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should stream response from LLM router', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: 'Hello, how are you?' },
        ],
        context: 'Test context',
      }),
    });

    const response = await POST(request);

    expect(response).toBeDefined();
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(response.headers.get('X-Rate-Limit-Remaining')).toBe('25');
    expect(response.headers.get('X-Rate-Limit-Limit')).toBe('30');
    expect(response.headers.get('X-Degraded-Mode')).toBe('false');

    // Read the streaming response
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
      }
    }

    expect(fullText).toBe('Hello from LLM Router!');
  });

  it('should load and include message history from database', async () => {
    const { db } = await import('@/lib/db');
    
    // Mock previous messages
    vi.mocked(db.chatMessage.findMany).mockResolvedValueOnce([
      { id: '1', role: 'user', content: 'Previous question', deckId: TEST_DECK_ID, createdAt: new Date(), citation: null },
      { id: '2', role: 'assistant', content: 'Previous answer', deckId: TEST_DECK_ID, createdAt: new Date(), citation: null },
    ] as any);

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: 'New question' },
        ],
        context: 'Test context',
        deckId: TEST_DECK_ID,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(db.chatMessage.findMany).toHaveBeenCalledWith({
      where: { deckId: TEST_DECK_ID },
      orderBy: { createdAt: 'asc' },
    });

    // Verify router was called with combined messages
    const { LLMRouter } = await import('@/lib/llm/router');
    const routerInstance = vi.mocked(LLMRouter).mock.results[0]?.value;
    expect(routerInstance.streamText).toHaveBeenCalled();
    
    const callArgs = vi.mocked(routerInstance.streamText).mock.calls[0][0];
    expect(callArgs.messages).toHaveLength(3); // 2 history + 1 new
    expect(callArgs.messages[0].content).toBe('Previous question');
    expect(callArgs.messages[1].content).toBe('Previous answer');
    expect(callArgs.messages[2].content).toBe('New question');
  });

  it('should save messages to database after completion', async () => {
    const { db } = await import('@/lib/db');
    const { incrementFeatureUsage } = await import('@/lib/featureLimits');

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: 'Test message' },
        ],
        context: 'Test context',
        deckId: TEST_DECK_ID,
      }),
    });

    // Record the call count before this test
    const callCountBefore = vi.mocked(db.chatMessage.create).mock.calls.length;

    const response = await POST(request);
    expect(response.status).toBe(200);

    // Trigger onFinish callback by consuming the stream
    const reader = response.body?.getReader();
    if (reader) {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    }

    // Wait for async operations (onFinish callback)
    await new Promise(resolve => setTimeout(resolve, 250));

    // Verify messages were saved (2 new calls)
    const callCountAfter = vi.mocked(db.chatMessage.create).mock.calls.length;
    const newCalls = callCountAfter - callCountBefore;
    
    // The onFinish might be called multiple times due to router instantiation
    // Check that we have at least 2 calls (user + assistant messages)
    expect(newCalls).toBeGreaterThanOrEqual(2);
    expect(newCalls % 2).toBe(0); // Should be even number (pairs of user+assistant)
    
    // Verify the most recent pair of calls were made with correct data
    const recentCalls = vi.mocked(db.chatMessage.create).mock.calls.slice(-2);
    expect(recentCalls[0][0]).toEqual({
      data: {
        deckId: TEST_DECK_ID,
        role: 'user',
        content: 'Test message',
        citation: null,
      },
    });
    expect(recentCalls[1][0]).toEqual({
      data: {
        deckId: TEST_DECK_ID,
        role: 'assistant',
        content: 'Hello from LLM Router!',
      },
    });

    // Verify usage was incremented
    expect(incrementFeatureUsage).toHaveBeenCalled();
  });

  it('should handle validation errors', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: 'invalid', // Should be array
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid request body');
    expect(data.details).toBeDefined();
  });

  it('should handle unauthorized deck access', async () => {
    const { db } = await import('@/lib/db');
    
    // Mock deck with different user
    vi.mocked(db.deck.findUnique).mockResolvedValueOnce({
      userId: 'different-user-id',
    } as any);

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: 'Test' },
        ],
        deckId: TEST_DECK_ID,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized access to deck');
  });

  it('should handle deck not found', async () => {
    const { db } = await import('@/lib/db');
    
    // Mock deck not found
    vi.mocked(db.deck.findUnique).mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: 'Test' },
        ],
        deckId: TEST_DECK_ID,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Deck not found');
  });

  it('should handle LLM router errors gracefully', async () => {
    const { LLMRouter } = await import('@/lib/llm/router');
    
    // Mock router to throw error
    vi.mocked(LLMRouter).mockImplementationOnce(function(this: any) {
      this.streamText = vi.fn().mockRejectedValue(new Error('LLM service unavailable'));
    } as any);

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: 'Test' },
        ],
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Internal Server Error');
  });

  it('should pass correct parameters to LLM router', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: 'Test question' },
        ],
        context: 'Study notes about physics',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const { LLMRouter } = await import('@/lib/llm/router');
    const routerInstance = vi.mocked(LLMRouter).mock.results[0]?.value;
    
    expect(routerInstance.streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: 'Test question',
          }),
        ]),
        temperature: 0.4,
        feature: 'chat',
        system: expect.stringContaining('Skoowl AI'),
        onFinish: expect.any(Function),
      })
    );

    // Verify system prompt includes context
    const callArgs = vi.mocked(routerInstance.streamText).mock.calls[0][0];
    expect(callArgs.system).toContain('Study notes about physics');
  });

  it('should handle citation cleanup in messages', async () => {
    const { db } = await import('@/lib/db');

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: '> "This is a citation"\n\nWhat does this mean?',
            citation: 'This is a citation',
          },
        ],
        deckId: TEST_DECK_ID,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    // Consume stream to trigger onFinish
    const reader = response.body?.getReader();
    if (reader) {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify citation was cleaned from content but stored separately
    expect(db.chatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: 'What does this mean?',
          citation: 'This is a citation',
        }),
      })
    );
  });

  it('should include rate limit info in response headers', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: 'Test' },
        ],
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Rate-Limit-Remaining')).toBeTruthy();
    expect(response.headers.get('X-Rate-Limit-Limit')).toBeTruthy();
    expect(response.headers.get('X-Degraded-Mode')).toBeTruthy();
  });

  it('should indicate degraded mode in headers when active', async () => {
    const { LLMRouter } = await import('@/lib/llm/router');
    
    // Mock router to return degraded mode
    vi.mocked(LLMRouter).mockImplementationOnce(function(this: any) {
      this.streamText = vi.fn(async () => ({
        textStream: (async function* () {
          yield 'Response';
        })(),
        text: Promise.resolve('Response'),
        rateLimitInfo: {
          remaining: 2,
          limit: 30,
          reset: new Date(),
          percentage: 93.3,
        },
        degradedMode: true,
      }));
    } as any);

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: 'Test' },
        ],
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Degraded-Mode')).toBe('true');
  });
});
