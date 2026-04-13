/**
 * Integration tests for /api/generate-audio-notes endpoint
 * 
 * Tests the migrated generate-audio-notes endpoint using LLM Router with:
 * - Streaming response handling for note generation
 * - Audio transcription with Groq Whisper (unchanged)
 * - Error handling for transcription and generation
 * - Rate limit headers
 * 
 * Validates: Requirements 15.4, 15.7
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

// Hoist mock variables so they're available in vi.mock factories
const mockTranscriptionCreate = vi.hoisted(() => vi.fn(async () => ({
  text: 'This is a test transcription of the audio recording. It contains study material about physics and mathematics.',
})));

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

vi.mock('@/lib/usageVerifier', () => ({
  verifyUsageLimits: vi.fn(() => ({
    success: true,
    user: { id: 'test-user-id' },
  })),
  USAGE_LIMITS: {},
}));

// Mock Groq/OpenAI for audio transcription
vi.mock('openai', () => ({
  default: vi.fn(function(this: any) {
    this.audio = {
      transcriptions: {
        create: mockTranscriptionCreate,
      },
    };
  }),
  toFile: vi.fn(async (_buffer: Buffer, name?: string | null, opts?: object) => ({ name, ...opts })),
}));

// Mock the LLM service directly - bypasses all config/env var issues
const textContent = `# 📚 Study Notes: Physics and Mathematics

> **Executive Summary**
> This recording covers fundamental concepts in physics and mathematics.

---

## 1. 📖 Key Terminology & Definitions
* **Physics**: The study of matter and energy
* **Mathematics**: The study of numbers and patterns

---

## 2. 🔍 Comprehensive Analysis

### 2.1 Physics Concepts
* **Core Concept**: Understanding motion and forces
* **Supporting Detail**: Newton's laws of motion

### 2.2 Mathematics Concepts
* **Core Concept**: Algebraic equations
* **Supporting Detail**: Solving for unknown variables

---

## 3. 💡 Key Examples & Evidence
* **Example:** Free fall motion → **Relevance:** Demonstrates gravity

---

## 4. ✅ Summary & Key Takeaways
* Physics and mathematics are interconnected
* Understanding fundamentals is crucial
* Practice is essential for mastery`;

vi.mock('@/lib/llm/service', () => ({
  createLLMRouter: vi.fn(() => ({
    streamText: vi.fn(async () => ({
      text: Promise.resolve(textContent),
    })),
    generateObject: vi.fn(async () => ({
      object: {},
    })),
  })),
}));

// Mock MIME validator to allow test audio through
vi.mock('@/lib/mime-validator', () => ({
  validateMimeType: vi.fn(async () => ({ valid: true, detectedType: 'audio/webm' })),
  logMimeTypeMismatch: vi.fn(),
}));

// Mock size validator
vi.mock('@/lib/size-validator', () => ({
  validateFileSize: vi.fn(() => ({ valid: true })),
}));

describe('POST /api/generate-audio-notes', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset the transcription mock to default behavior after clearAllMocks
    mockTranscriptionCreate.mockResolvedValue({
      text: 'This is a test transcription of the audio recording. It contains study material about physics and mathematics.',
    });
    // Reset toFile mock
    const openai = await import('openai');
    vi.mocked(openai.toFile).mockImplementation(async (_buffer: any, name?: string | null, opts?: any) => ({ name, ...opts }) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should transcribe audio and generate notes using LLM router', async () => {
    // Create a simple base64-encoded audio data
    const audioData = Buffer.from('fake audio data').toString('base64');

    const request = new NextRequest('http://localhost:3000/api/generate-audio-notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio: audioData,
        mimeType: 'audio/webm',
        fileName: 'test-recording.webm',
      }),
    });

    const response = (await POST(request))!

    expect(response).toBeDefined();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.notes).toBeDefined();
    expect(data.transcript).toBeDefined();
    expect(data.title).toBeDefined();

    // Verify transcript was generated
    expect(data.transcript).toContain('test transcription');

    // Verify notes were generated
    expect(data.notes).toContain('Study Notes');
    expect(data.notes).toContain('Physics');

    // Verify title was extracted
    expect(data.title).toContain('Physics and Mathematics');
  });

  it('should handle missing audio data', async () => {
    const request = new NextRequest('http://localhost:3000/api/generate-audio-notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mimeType: 'audio/webm',
        fileName: 'test.webm',
      }),
    });

    const response = (await POST(request))!

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('No audio data provided');
  });

  it('should handle empty transcription', async () => {
    mockTranscriptionCreate.mockResolvedValueOnce({ text: '' });

    const audioData = Buffer.from('fake audio data').toString('base64');

    const request = new NextRequest('http://localhost:3000/api/generate-audio-notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio: audioData,
        mimeType: 'audio/webm',
        fileName: 'test.webm',
      }),
    });

    const response = (await POST(request))!

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Could not transcribe audio');
  });

  it('should use fallback notes when generation returns empty', async () => {
    const { createLLMRouter } = await import('@/lib/llm/service');
    
    // Mock router to return empty notes
    vi.mocked(createLLMRouter).mockImplementationOnce(() => ({
      streamText: vi.fn(async () => ({
        text: Promise.resolve(''),
      })),
      generateObject: vi.fn(),
    } as any));

    const audioData = Buffer.from('fake audio data').toString('base64');

    const request = new NextRequest('http://localhost:3000/api/generate-audio-notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio: audioData,
        mimeType: 'audio/webm',
        fileName: 'test.webm',
      }),
    });

    const response = (await POST(request))!

    expect(response.status).toBe(200);
    const data = await response.json();
    
    // Should use fallback format with transcript
    expect(data.notes).toContain('Audio Recording Notes');
    expect(data.notes).toContain('test transcription');
  });

  it('should pass correct parameters to LLM router', async () => {
    const audioData = Buffer.from('fake audio data').toString('base64');

    const request = new NextRequest('http://localhost:3000/api/generate-audio-notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio: audioData,
        mimeType: 'audio/webm',
        fileName: 'test.webm',
      }),
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
            content: expect.stringContaining('Create study notes from this transcript'),
          }),
        ]),
        temperature: 0.3,
        feature: 'generate-audio-notes',
        system: expect.stringContaining('Senior Academic Researcher'),
      })
    );

    // Verify system prompt includes note generation instructions
    const callArgs = vi.mocked(routerInstance.streamText).mock.calls[0][0];
    expect(callArgs.system).toContain('COMPREHENSIVE');
    expect(callArgs.system).toContain('LANGUAGE PROTOCOL');
  });

  it('should handle Groq transcription errors', async () => {
    mockTranscriptionCreate.mockRejectedValueOnce(new Error('Invalid API Key'));

    const audioData = Buffer.from('fake audio data').toString('base64');

    const request = new NextRequest('http://localhost:3000/api/generate-audio-notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio: audioData,
        mimeType: 'audio/webm',
        fileName: 'test.webm',
      }),
    });

    const response = (await POST(request))!

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toContain('Groq API key');
  });

  it('should handle rate limit errors', async () => {
    mockTranscriptionCreate.mockRejectedValueOnce(new Error('rate_limit exceeded'));

    const audioData = Buffer.from('fake audio data').toString('base64');

    const request = new NextRequest('http://localhost:3000/api/generate-audio-notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio: audioData,
        mimeType: 'audio/webm',
        fileName: 'test.webm',
      }),
    });

    const response = (await POST(request))!

    expect(response.status).toBe(429);
    const data = await response.json();
    expect(data.error).toContain('Rate limit exceeded');
  });

  it('should handle LLM router errors gracefully', async () => {
    const { createLLMRouter } = await import('@/lib/llm/service');
    
    // Mock router to throw error
    vi.mocked(createLLMRouter).mockImplementationOnce(() => ({
      streamText: vi.fn().mockRejectedValue(new Error('LLM service unavailable')),
      generateObject: vi.fn(),
    } as any));

    const audioData = Buffer.from('fake audio data').toString('base64');

    const request = new NextRequest('http://localhost:3000/api/generate-audio-notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio: audioData,
        mimeType: 'audio/webm',
        fileName: 'test.webm',
      }),
    });

    const response = (await POST(request))!

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Internal Server Error');
  });

  it('should verify usage limits before processing', async () => {
    const { verifyUsageLimits } = await import('@/lib/usageVerifier');

    const audioData = Buffer.from('fake audio data').toString('base64');

    const request = new NextRequest('http://localhost:3000/api/generate-audio-notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio: audioData,
        mimeType: 'audio/webm',
        fileName: 'test.webm',
      }),
    });

    await POST(request);

    expect(verifyUsageLimits).toHaveBeenCalledWith({
      inputType: 'audio',
      fileSize: expect.any(Number),
    });
  });

  it('should extract title from generated notes', async () => {
    const audioData = Buffer.from('fake audio data').toString('base64');

    const request = new NextRequest('http://localhost:3000/api/generate-audio-notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio: audioData,
        mimeType: 'audio/webm',
        fileName: 'test.webm',
      }),
    });

    const response = (await POST(request))!
    expect(response.status).toBe(200);

    const data = await response.json();
    
    // Title should be extracted from the first # heading
    expect(data.title).toBeTruthy();
    expect(data.title).not.toBe('Audio Recording'); // Should not be default
    expect(data.title).toContain('Physics and Mathematics');
  });

  it('should use default title when no heading found', async () => {
    const { createLLMRouter } = await import('@/lib/llm/service');
    
    // Mock router to return notes without heading
    vi.mocked(createLLMRouter).mockImplementationOnce(() => ({
      streamText: vi.fn(async () => ({
        text: Promise.resolve('Notes without heading'),
      })),
      generateObject: vi.fn(),
    } as any));

    const audioData = Buffer.from('fake audio data').toString('base64');

    const request = new NextRequest('http://localhost:3000/api/generate-audio-notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio: audioData,
        mimeType: 'audio/webm',
        fileName: 'test.webm',
      }),
    });

    const response = (await POST(request))!
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.title).toBe('Audio Recording'); // Should use default
  });

  it('should pass transcription to Groq Whisper with correct parameters', async () => {
    const audioData = Buffer.from('fake audio data').toString('base64');

    const request = new NextRequest('http://localhost:3000/api/generate-audio-notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio: audioData,
        mimeType: 'audio/webm',
        fileName: 'test-recording.webm',
      }),
    });

    await POST(request);

    expect(mockTranscriptionCreate).toHaveBeenCalledWith({
      file: expect.objectContaining({
        name: 'test-recording.webm',
      }),
      model: 'whisper-large-v3',
      temperature: 0,
      prompt: expect.stringContaining('student\'s study recording'),
    });
  });
});
