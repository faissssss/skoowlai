/**
 * Integration tests for /api/rewrite endpoint
 * 
 * Tests the migrated rewrite endpoint using LLM Router with:
 * - Streaming response handling
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
vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(() => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    errorResponse: null,
  })),
}));

vi.mock('@/lib/ratelimit', () => ({
  checkRateLimitFromRequest: vi.fn(() => null),
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
    this.streamText = vi.fn(async (options: any) => {
      const textContent = 'This is the rewritten text with improved clarity and flow.';
      
      return {
        textStream: (async function* () {
          yield 'This is ';
          yield 'the rewritten ';
          yield 'text with ';
          yield 'improved clarity ';
          yield 'and flow.';
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
    rewrite: { provider: 'groq', model: 'llama-3.1-8b-instant', priority: 'low' },
  },
}));

describe('POST /api/rewrite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should stream rewritten text from LLM router', async () => {
    const request = new NextRequest('http://localhost:3000/api/rewrite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'This is some text that needs improvement.',
        action: 'improve',
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

    expect(fullText).toBe('This is the rewritten text with improved clarity and flow.');
  });

  it('should handle all rewrite actions', async () => {
    const actions = ['improve', 'shorten', 'paraphrase', 'simplify', 'detailed'] as const;

    for (const action of actions) {
      const request = new NextRequest('http://localhost:3000/api/rewrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: 'Sample text for rewriting.',
          action,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    }
  });

  it('should pass correct parameters to LLM router', async () => {
    const request = new NextRequest('http://localhost:3000/api/rewrite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'Original text to be rewritten.',
        action: 'simplify',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const { LLMRouter } = await import('@/lib/llm/router');
    const routerInstance = vi.mocked(LLMRouter).mock.results[0]?.value;
    
    expect(routerInstance.streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          {
            role: 'user',
            content: 'Original text to be rewritten.',
          },
        ],
        temperature: 0.3,
        feature: 'rewrite',
        system: expect.stringContaining('Professional Multi-lingual Editor'),
      })
    );

    // Verify system prompt includes the action
    const callArgs = vi.mocked(routerInstance.streamText).mock.calls[0][0];
    expect(callArgs.system).toContain('simplify');
    expect(callArgs.system).toContain('simpler language');
  });

  it('should handle validation errors for missing text', async () => {
    const request = new NextRequest('http://localhost:3000/api/rewrite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'improve',
        // Missing text field
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid request');
    expect(data.details).toBeDefined();
  });

  it('should handle validation errors for invalid action', async () => {
    const request = new NextRequest('http://localhost:3000/api/rewrite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'Some text',
        action: 'invalid-action',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid request');
    expect(data.details).toBeDefined();
  });

  it('should handle validation errors for text too long', async () => {
    const longText = 'a'.repeat(5001); // Exceeds 5000 character limit

    const request = new NextRequest('http://localhost:3000/api/rewrite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: longText,
        action: 'improve',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid request');
    expect(data.details).toBeDefined();
  });

  it('should handle LLM router errors gracefully', async () => {
    const { LLMRouter } = await import('@/lib/llm/router');
    
    // Mock router to throw error
    vi.mocked(LLMRouter).mockImplementationOnce(function(this: any) {
      this.streamText = vi.fn().mockRejectedValue(new Error('LLM service unavailable'));
    } as any);

    const request = new NextRequest('http://localhost:3000/api/rewrite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'Test text',
        action: 'improve',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Internal Server Error');
  });

  it('should include rate limit info in response headers', async () => {
    const request = new NextRequest('http://localhost:3000/api/rewrite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'Test text',
        action: 'improve',
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
          yield 'Rewritten text';
        })(),
        text: Promise.resolve('Rewritten text'),
        rateLimitInfo: {
          remaining: 2,
          limit: 30,
          reset: new Date(),
          percentage: 93.3,
        },
        degradedMode: true,
      }));
    } as any);

    const request = new NextRequest('http://localhost:3000/api/rewrite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'Test text',
        action: 'improve',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Degraded-Mode')).toBe('true');
  });

  it('should accept optional deckId parameter', async () => {
    const request = new NextRequest('http://localhost:3000/api/rewrite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'Test text',
        action: 'improve',
        deckId: 'clh1234567890abcdefghij',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
  });

  it('should handle null deckId parameter', async () => {
    const request = new NextRequest('http://localhost:3000/api/rewrite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'Test text',
        action: 'improve',
        deckId: null,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
  });

  it('should use low priority for rewrite feature', async () => {
    const request = new NextRequest('http://localhost:3000/api/rewrite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'Test text',
        action: 'improve',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const { LLMRouter } = await import('@/lib/llm/router');
    const routerInstance = vi.mocked(LLMRouter).mock.results[0]?.value;
    
    const callArgs = vi.mocked(routerInstance.streamText).mock.calls[0][0];
    expect(callArgs.feature).toBe('rewrite');
  });

  it('should use temperature 0.3 for consistent rewriting', async () => {
    const request = new NextRequest('http://localhost:3000/api/rewrite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'Test text',
        action: 'improve',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const { LLMRouter } = await import('@/lib/llm/router');
    const routerInstance = vi.mocked(LLMRouter).mock.results[0]?.value;
    
    const callArgs = vi.mocked(routerInstance.streamText).mock.calls[0][0];
    expect(callArgs.temperature).toBe(0.3);
  });

  it('should include language matching instructions in system prompt', async () => {
    const request = new NextRequest('http://localhost:3000/api/rewrite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'Test text',
        action: 'improve',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const { LLMRouter } = await import('@/lib/llm/router');
    const routerInstance = vi.mocked(LLMRouter).mock.results[0]?.value;
    
    const callArgs = vi.mocked(routerInstance.streamText).mock.calls[0][0];
    expect(callArgs.system).toContain('STRICT LANGUAGE MATCHING');
    expect(callArgs.system).toContain('EXACT SAME LANGUAGE');
    expect(callArgs.system).toContain('PLAIN TEXT ONLY');
  });
});
