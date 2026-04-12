/**
 * Integration tests for /api/quiz endpoint
 * 
 * Tests the migrated quiz endpoint using LLM Router with:
 * - Structured output generation
 * - Schema validation
 * - Quiz configuration (type, difficulty, timer)
 * - Hint generation
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
        summary: 'Test summary content for quiz generation',
        content: 'Test content',
      })),
    },
    quiz: {
      deleteMany: vi.fn(() => Promise.resolve({ count: 0 })),
      createMany: vi.fn(() => Promise.resolve({ count: 10 })),
      findMany: vi.fn(() => Promise.resolve([
        {
          id: '1',
          deckId: TEST_DECK_ID,
          question: 'What is the capital of France?',
          options: JSON.stringify(['Paris', 'London', 'Berlin', 'Madrid']),
          answer: 'Paris',
          hint: 'Think about the city known for the Eiffel Tower',
        },
        {
          id: '2',
          deckId: TEST_DECK_ID,
          question: 'The Earth is flat',
          options: JSON.stringify(['True', 'False']),
          answer: 'False',
          hint: 'Consider what scientists have proven about Earth\'s shape',
        },
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
        questions: [
          {
            question: 'What is photosynthesis?',
            options: ['Process of making food', 'Process of breathing', 'Process of digestion', 'Process of reproduction'],
            answer: 'Process of making food',
            type: 'multiple-choice',
            hint: 'Think about how plants create energy from sunlight',
          },
          {
            question: 'Water boils at 100°C',
            options: ['True', 'False'],
            answer: 'True',
            type: 'true-false',
            hint: 'Consider the standard boiling point at sea level',
          },
          {
            question: 'The powerhouse of the cell is the _____',
            options: [],
            answer: 'mitochondria',
            type: 'fill-in',
            hint: 'This organelle produces ATP for cellular energy',
          },
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
    quiz: { provider: 'groq', model: 'llama-3.1-8b-instant', priority: 'medium' },
  },
}));

describe('POST /api/quiz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should generate quiz with default configuration', async () => {
    const request = new NextRequest('http://localhost:3000/api/quiz', {
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
    expect(data.quizzes).toHaveLength(2);
    expect(data.timer).toBe('none');

    const { db } = await import('@/lib/db');
    expect(db.quiz.deleteMany).toHaveBeenCalledWith({
      where: { deckId: TEST_DECK_ID },
    });
    expect(db.quiz.createMany).toHaveBeenCalled();
  });

  it('should generate quiz with custom count', async () => {
    const request = new NextRequest('http://localhost:3000/api/quiz', {
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

  it('should generate quiz with custom type', async () => {
    const request = new NextRequest('http://localhost:3000/api/quiz', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deckId: TEST_DECK_ID,
        type: 'true-false',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  it('should generate quiz with custom difficulty', async () => {
    const request = new NextRequest('http://localhost:3000/api/quiz', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deckId: TEST_DECK_ID,
        difficulty: 'advanced',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  it('should generate quiz with timer setting', async () => {
    const request = new NextRequest('http://localhost:3000/api/quiz', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deckId: TEST_DECK_ID,
        timer: '10',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.timer).toBe('10');
  });

  it('should include hints in generated quiz', async () => {
    const request = new NextRequest('http://localhost:3000/api/quiz', {
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
    expect(data.quizzes[0].hint).toBeDefined();
    expect(data.quizzes[0].hint).toBeTruthy();
  });

  it('should pass correct parameters to LLM router', async () => {
    const request = new NextRequest('http://localhost:3000/api/quiz', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deckId: TEST_DECK_ID,
        count: 15,
        type: 'mixed',
        difficulty: 'expert',
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
        temperature: 0.3,
        feature: 'quiz',
      })
    );
  });

  it('should handle missing deckId', async () => {
    const request = new NextRequest('http://localhost:3000/api/quiz', {
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

    const request = new NextRequest('http://localhost:3000/api/quiz', {
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

    const request = new NextRequest('http://localhost:3000/api/quiz', {
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
    const request = new NextRequest('http://localhost:3000/api/quiz', {
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

  it('should handle invalid type value', async () => {
    const request = new NextRequest('http://localhost:3000/api/quiz', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deckId: TEST_DECK_ID,
        type: 'invalid',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid request body');
  });

  it('should filter out questions without answers', async () => {
    const { LLMRouter } = await import('@/lib/llm/router');
    
    // Mock router to return questions with and without answers
    vi.mocked(LLMRouter).mockImplementationOnce(function(this: any) {
      this.generateObject = vi.fn(async () => ({
        object: {
          questions: [
            {
              question: 'Valid question',
              options: ['A', 'B', 'C', 'D'],
              answer: 'A',
              type: 'multiple-choice',
              hint: 'Test hint',
            },
            {
              question: 'Invalid question',
              options: ['A', 'B', 'C', 'D'],
              answer: '', // Empty answer
              type: 'multiple-choice',
              hint: 'Test hint',
            },
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
    } as any);

    const request = new NextRequest('http://localhost:3000/api/quiz', {
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
    // Should only have 2 questions from the mock db.quiz.findMany (valid ones)
    expect(data.quizzes).toHaveLength(2);
  });

  it('should handle all questions without answers', async () => {
    const { LLMRouter } = await import('@/lib/llm/router');
    
    // Mock router to return only questions without answers
    vi.mocked(LLMRouter).mockImplementationOnce(function(this: any) {
      this.generateObject = vi.fn(async () => ({
        object: {
          questions: [
            {
              question: 'Invalid question 1',
              options: ['A', 'B', 'C', 'D'],
              answer: '',
              type: 'multiple-choice',
              hint: 'Test hint',
            },
            {
              question: 'Invalid question 2',
              options: ['A', 'B', 'C', 'D'],
              answer: '   ', // Whitespace only
              type: 'multiple-choice',
              hint: 'Test hint',
            },
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
    } as any);

    const request = new NextRequest('http://localhost:3000/api/quiz', {
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
    expect(data.error).toContain('No valid questions');
  });

  it('should increment feature usage after successful generation', async () => {
    const request = new NextRequest('http://localhost:3000/api/quiz', {
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
    expect(incrementFeatureUsage).toHaveBeenCalledWith(TEST_USER_ID, 'quiz');
  });

  it('should handle LLM router errors gracefully', async () => {
    const { LLMRouter } = await import('@/lib/llm/router');
    
    // Mock router to throw error
    vi.mocked(LLMRouter).mockImplementationOnce(function(this: any) {
      this.generateObject = vi.fn().mockRejectedValue(new Error('LLM service unavailable'));
    } as any);

    const request = new NextRequest('http://localhost:3000/api/quiz', {
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

describe('GET /api/quiz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch existing quizzes with hints', async () => {
    const request = new NextRequest(`http://localhost:3000/api/quiz?deckId=${TEST_DECK_ID}`, {
      method: 'GET',
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.quizzes).toHaveLength(2);
    expect(data.quizzes[0].question).toBe('What is the capital of France?');
    expect(data.quizzes[0].hint).toBe('Think about the city known for the Eiffel Tower');
  });

  it('should handle missing deckId in GET', async () => {
    const request = new NextRequest('http://localhost:3000/api/quiz', {
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

    const request = new NextRequest(`http://localhost:3000/api/quiz?deckId=${TEST_DECK_ID}`, {
      method: 'GET',
    });

    const response = await GET(request);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized access to deck');
  });
});

describe('DELETE /api/quiz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete quizzes', async () => {
    const request = new NextRequest(`http://localhost:3000/api/quiz?deckId=${TEST_DECK_ID}`, {
      method: 'DELETE',
    });

    const response = await DELETE(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);

    const { db } = await import('@/lib/db');
    expect(db.quiz.deleteMany).toHaveBeenCalledWith({
      where: { deckId: TEST_DECK_ID },
    });
  });

  it('should handle missing deckId in DELETE', async () => {
    const request = new NextRequest('http://localhost:3000/api/quiz', {
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

    const request = new NextRequest(`http://localhost:3000/api/quiz?deckId=${TEST_DECK_ID}`, {
      method: 'DELETE',
    });

    const response = await DELETE(request);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized access to deck');
  });
});
