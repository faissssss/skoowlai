import { NextRequest, NextResponse } from 'next/server';
import OpenAI, { toFile } from 'openai';
import { z } from 'zod';
import { checkRateLimitFromRequest } from '@/lib/ratelimit';
import { verifyUsageLimits } from '@/lib/usageVerifier';
import { requireAuth } from '@/lib/auth';
import { checkCsrfOrigin } from '@/lib/csrf';
import { createLLMRouter } from '@/lib/llm/service';
import { downloadPrivateBlobToBuffer } from '@/lib/blob-storage';
import { validateFileSize } from '@/lib/size-validator';
import { validateMimeType } from '@/lib/mime-validator';

export const maxDuration = 120;
export const runtime = 'nodejs';

const requestSchema = z.object({
  blob: z.object({
    pathname: z.string().min(1),
    contentType: z.string().optional(),
    originalName: z.string().optional(),
  }),
}).strict();

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

const NOTE_GENERATION_PROMPT = `**Role:** Senior Academic Researcher & Note Taker
**Task:** Create comprehensive, detail-rich study notes from the audio transcript.
**Goal:** Capture ALL relevant information. Do not over-summarize; prioritize completeness.

**1. STRICT LANGUAGE PROTOCOL:**
* **Detect:** Identify the Dominant Language of the transcript.
* **Consistency:** The ENTIRE output MUST be in that Dominant Language.
* **NO MIXING:** Keep headers and explanations in one language only.

**2. TRANSCRIPT CLEANUP:**
* Remove filler words
* Remove repetitions and stammering
* Organize information logically

**3. OUTPUT TEMPLATE:**
# [Study Notes: {Title based on content}]
## 1. [Key Terminology & Definitions]
## 2. [Comprehensive Analysis]
## 3. [Key Examples & Evidence]
## 4. [Summary & Key Takeaways]

Output ONLY the Markdown notes, nothing else.`;

export async function POST(req: NextRequest) {
  const csrfError = checkCsrfOrigin(req);
  if (csrfError) return csrfError;

  const { errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const rateLimitResponse = await checkRateLimitFromRequest(req);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await req.json();
    const payload = requestSchema.safeParse(body);
    if (!payload.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: payload.error.flatten() },
        { status: 400 }
      );
    }

    const { blob } = payload.data;
    const { buffer, contentType } = await downloadPrivateBlobToBuffer(blob.pathname);

    const sizeValidation = validateFileSize(buffer.length, 'audio');
    if (!sizeValidation.valid) {
      return NextResponse.json(
        { error: 'Audio file too large', details: sizeValidation.error },
        { status: 413 }
      );
    }

    const mimeValidation = await validateMimeType(buffer, 'audio');
    if (!mimeValidation.valid) {
      return NextResponse.json(
        {
          error: 'Invalid audio format',
          details: 'The audio format is not supported. Please use WebM, MP3, WAV, or M4A.',
        },
        { status: 400 }
      );
    }

    const usageCheck = await verifyUsageLimits({
      inputType: 'audio',
      fileSize: buffer.length,
    });
    if (!usageCheck.success) return usageCheck.errorResponse!;

    const audioFile = await toFile(buffer, blob.originalName || 'audio.webm', {
      type: mimeValidation.detectedType || contentType || 'audio/webm',
    });

    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-large-v3',
      temperature: 0,
      prompt: 'This is a student study recording. It may contain academic terms, technical vocabulary, and educational content.',
    });

    const transcript = transcription.text;
    if (!transcript || transcript.trim().length === 0) {
      return NextResponse.json(
        { error: 'Could not transcribe audio. Please ensure clear audio quality.' },
        { status: 400 }
      );
    }

    let router: Awaited<ReturnType<typeof createLLMRouter>>;
    try {
      router = await createLLMRouter(30000);
    } catch (error) {
      return NextResponse.json(
        {
          error: 'LLM Configuration Error',
          details: error instanceof Error ? error.message : 'Failed to load LLM configuration',
        },
        { status: 500 }
      );
    }

    const result = await router.streamText({
      messages: [{ role: 'user', content: `Create study notes from this transcript:\n\n${transcript}` }],
      temperature: 0.3,
      system: NOTE_GENERATION_PROMPT,
      feature: 'generate-audio-notes',
    });

    const notes = await result.text;
    const finalNotes = notes && notes.trim().length > 0
      ? notes
      : `# Audio Recording Notes\n\n${transcript}`;

    let title = 'Audio Recording';
    const titleMatch = finalNotes.match(/^#\s*(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    return NextResponse.json({
      notes: finalNotes,
      transcript,
      title,
    });
  } catch (error) {
    console.error('Audio blob processing error:', error);

    if (error instanceof Error) {
      const isProd = process.env.NODE_ENV === 'production';
      if (error.message.includes('Invalid API Key')) {
        return NextResponse.json({ error: 'Groq API key is invalid or missing' }, { status: 401 });
      }
      if (error.message.includes('rate_limit')) {
        return NextResponse.json({ error: 'Rate limit exceeded. Please try again in a moment.' }, { status: 429 });
      }

      return NextResponse.json(
        { error: 'Internal Server Error', details: isProd ? 'Audio processing failed' : error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Failed to process audio' }, { status: 500 });
  }
}
