/**
 * Integration tests for /api/generate endpoint
 * 
 * Tests the migrated generate endpoint using LLM Router with:
 * - Note generation from text
 * - YouTube transcript processing
 * - Audio transcription
 * - Document parsing (PDF, DOCX, TXT)
 * - Duplicate detection
 * - Error handling
 * 
 * Validates: Requirements 15.4, 15.7
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from './route';
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

vi.mock('@/lib/usageVerifier', () => ({
  verifyUsageLimits: vi.fn(() => Promise.resolve({
    success: true,
    user: { id: TEST_USER_ID },
  })),
  incrementUsage: vi.fn(() => Promise.resolve()),
  USAGE_LIMITS: {},
}));

vi.mock('@/lib/noteConfig', () => ({
  DEFAULT_NOTE_CONFIG: {
    depth: 'standard',
    style: 'mixed',
    tone: 'neutral',
  },
  buildSystemPrompt: vi.fn(() => 'System prompt for note generation'),
}));

vi.mock('@/lib/db', () => ({
  db: {
    deck: {
      create: vi.fn(() => Promise.resolve({ id: TEST_DECK_ID })),
      findFirst: vi.fn(() => Promise.resolve(null)),
    },
  },
}));

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(() => Promise.resolve()),
}));

// Mock the LLM service directly - bypasses all config/env var issues
vi.mock('@/lib/llm/service', () => ({
  createLLMRouter: vi.fn(() => ({
    streamText: vi.fn(async () => ({
      text: Promise.resolve('# Study Notes\n\nGenerated content from LLM Router'),
    })),
    generateObject: vi.fn(async () => ({
      object: {},
    })),
  })),
}));

// Mock MIME validator to allow test files through
vi.mock('@/lib/mime-validator', () => ({
  validateMimeType: vi.fn(async () => ({ valid: true, detectedType: 'text/plain' })),
  logMimeTypeMismatch: vi.fn(),
}));

// Mock size validator
vi.mock('@/lib/size-validator', () => ({
  validateFileSize: vi.fn(() => ({ valid: true })),
}));

describe('POST /api/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set required environment variables for all tests
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-google-api-key';
    process.env.SUPADATA_API_KEY = 'test-supadata-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should generate notes from YouTube URL', async () => {
    // Mock YouTube transcript API with Supadata format
    const longTranscript = 'Long transcript content here '.repeat(5);

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: longTranscript, offset: 0, duration: 30 }],
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ title: 'Test Video Title' }),
      } as any);

    const request = new NextRequest('http://localhost:3000/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        youtubeUrl: 'https://www.youtube.com/watch?v=test123',
      }),
    });

    const response = (await POST(request))!

    if (response.status !== 200) {
      const errorData = await response.json();
      console.error('Error response:', errorData);
    }

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.deckId).toBe(TEST_DECK_ID);

    const { db } = await import('@/lib/db');
    expect(db.deck.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: TEST_USER_ID,
          title: 'Test Video Title',
          sourceType: 'youtube',
        }),
      })
    );
  });

  it('should generate notes from text file', async () => {
    const textContent = 'This is test content for note generation';
    const file = new File([textContent], 'test.txt', { type: 'text/plain' });
    
    const formData = new FormData();
    formData.append('file', file);

    const request = new NextRequest('http://localhost:3000/api/generate', {
      method: 'POST',
      body: formData,
    });

    const response = (await POST(request))!

    if (response.status !== 200) {
      const errorData = await response.json();
      console.error('Error response:', errorData);
    }

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.deckId).toBe(TEST_DECK_ID);

    const { db } = await import('@/lib/db');
    expect(db.deck.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: TEST_USER_ID,
          sourceType: 'doc',
        }),
      })
    );
  });

  it('should handle pre-processed audio notes', async () => {
    const request = new NextRequest('http://localhost:3000/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audioNotes: 'Pre-generated notes from audio',
        audioTranscript: 'Original audio transcript',
        title: 'Audio Recording',
      }),
    });

    const response = (await POST(request))!

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.deckId).toBe(TEST_DECK_ID);

    const { db } = await import('@/lib/db');
    expect(db.deck.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: TEST_USER_ID,
          title: 'Audio Recording',
          sourceType: 'audio',
          summary: 'Pre-generated notes from audio',
        }),
      })
    );
  });

  it('should detect and return duplicate uploads', async () => {
    const { db } = await import('@/lib/db');
    
    // Mock existing deck
    vi.mocked(db.deck.findFirst).mockResolvedValueOnce({
      id: 'existing-deck-id',
      userId: TEST_USER_ID,
      title: 'test.txt',
      sourceType: 'doc',
      createdAt: new Date(),
    } as any);

    const textContent = 'This is test content';
    const file = new File([textContent], 'test.txt', { type: 'text/plain' });
    
    const formData = new FormData();
    formData.append('file', file);

    const request = new NextRequest('http://localhost:3000/api/generate', {
      method: 'POST',
      body: formData,
    });

    const response = (await POST(request))!

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.deckId).toBe('existing-deck-id');
    expect(data.isDuplicate).toBe(true);
    
    // Should not create new deck
    expect(db.deck.create).not.toHaveBeenCalled();
  });

  it('should handle invalid YouTube URL', async () => {
    const request = new NextRequest('http://localhost:3000/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        youtubeUrl: 'https://invalid-url.com',
      }),
    });

    const response = (await POST(request))!

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid YouTube URL');
  });

  it('should handle YouTube transcript fetch failure', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({}),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        youtubeUrl: 'https://www.youtube.com/watch?v=test123',
      }),
    });

    const response = (await POST(request))!

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Video not found');
  });

  it('should handle unsupported file type', async () => {
    // Override mime validator to return invalid for this test
    const { validateMimeType } = await import('@/lib/mime-validator');
    vi.mocked(validateMimeType).mockResolvedValueOnce({ valid: false, detectedType: 'application/xyz', error: 'Unsupported type' });

    const file = new File(['content'], 'test.xyz', { type: 'application/xyz' });
    
    const formData = new FormData();
    formData.append('file', file);

    const request = new NextRequest('http://localhost:3000/api/generate', {
      method: 'POST',
      body: formData,
    });

    const response = (await POST(request))!

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid file type');
  });

  it('should handle missing file in form data', async () => {
    const formData = new FormData();

    const request = new NextRequest('http://localhost:3000/api/generate', {
      method: 'POST',
      body: formData,
    });

    const response = (await POST(request))!

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('No file provided');
  });

  it('should pass correct parameters to LLM router', async () => {
    const textContent = 'Test content for generation';
    const file = new File([textContent], 'test.txt', { type: 'text/plain' });
    
    const formData = new FormData();
    formData.append('file', file);

    const request = new NextRequest('http://localhost:3000/api/generate', {
      method: 'POST',
      body: formData,
    });

    const response = (await POST(request))!
    expect(response.status).toBe(200);

    const { createLLMRouter } = await import('@/lib/llm/service');
    const routerInstance = vi.mocked(createLLMRouter).mock.results[0]?.value;
    
    expect(routerInstance.streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
          }),
        ]),
        temperature: 0.3,
        feature: 'generate',
      })
    );
  });

  it('should handle custom note configuration', async () => {
    const textContent = 'Test content';
    const file = new File([textContent], 'test.txt', { type: 'text/plain' });
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('noteConfig', JSON.stringify({
      depth: 'detailed',
      style: 'bullet',
      tone: 'formal',
    }));

    const request = new NextRequest('http://localhost:3000/api/generate', {
      method: 'POST',
      body: formData,
    });

    const response = (await POST(request))!
    expect(response.status).toBe(200);

    const { db } = await import('@/lib/db');
    expect(db.deck.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          noteConfig: {
            depth: 'detailed',
            style: 'bullet',
            tone: 'formal',
          },
        }),
      })
    );
  });

  it('should increment usage after successful generation', async () => {
    const textContent = 'Test content';
    const file = new File([textContent], 'test.txt', { type: 'text/plain' });
    
    const formData = new FormData();
    formData.append('file', file);

    const request = new NextRequest('http://localhost:3000/api/generate', {
      method: 'POST',
      body: formData,
    });

    const response = (await POST(request))!
    expect(response.status).toBe(200);

    const { incrementUsage } = await import('@/lib/usageVerifier');
    expect(incrementUsage).toHaveBeenCalledWith(TEST_USER_ID);
  });

  it('should log audit trail', async () => {
    const textContent = 'Test content';
    const file = new File([textContent], 'test.txt', { type: 'text/plain' });
    
    const formData = new FormData();
    formData.append('file', file);

    const request = new NextRequest('http://localhost:3000/api/generate', {
      method: 'POST',
      body: formData,
    });

    const response = (await POST(request))!
    expect(response.status).toBe(200);

    // Wait for async audit log
    await new Promise(resolve => setTimeout(resolve, 100));

    const { logAudit } = await import('@/lib/audit');
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: TEST_USER_ID,
        action: 'GENERATE_DECK',
        resourceId: TEST_DECK_ID,
      })
    );
  });
});
