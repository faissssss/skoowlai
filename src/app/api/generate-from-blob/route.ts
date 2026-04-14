import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from '@/lib/db';
import { checkRateLimitFromRequest } from '@/lib/ratelimit';
import { requireAuth } from '@/lib/auth';
import { verifyUsageLimits, incrementUsage, type InputType } from '@/lib/usageVerifier';
import { NoteConfig, DEFAULT_NOTE_CONFIG, buildSystemPrompt } from '@/lib/noteConfig';
import { checkCsrfOrigin } from '@/lib/csrf';
import { downloadPrivateBlobToBuffer } from '@/lib/blob-storage';
import { validateFileSize } from '@/lib/size-validator';
import { validateMimeType, logMimeTypeMismatch } from '@/lib/mime-validator';
import { createLLMRouter } from '@/lib/llm/service';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const blobGenerateSchema = z.object({
  blob: z.object({
    pathname: z.string().min(1),
    contentType: z.string().optional(),
    originalName: z.string().optional(),
    size: z.number().optional(),
  }),
  noteConfig: z.object({
    depth: z.enum(['brief', 'standard', 'detailed']).optional(),
    style: z.enum(['bullet_points', 'cornell', 'cheatsheet', 'outline']).optional(),
    tone: z.enum(['academic', 'simplify_eli5', 'professional']).optional(),
  }).optional(),
}).strict();

export async function POST(req: NextRequest) {
  const csrfError = checkCsrfOrigin(req);
  if (csrfError) return csrfError;

  const { user, errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const rateLimitResponse = await checkRateLimitFromRequest(req);
  if (rateLimitResponse) return rateLimitResponse;

  const isProd = process.env.NODE_ENV === 'production';

  try {
    const body = await req.json();
    const payload = blobGenerateSchema.safeParse(body);

    if (!payload.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: payload.error.flatten() },
        { status: 400 }
      );
    }

    const { blob, noteConfig: rawNoteConfig } = payload.data;
    const noteConfig: NoteConfig = {
      depth: rawNoteConfig?.depth || DEFAULT_NOTE_CONFIG.depth,
      style: rawNoteConfig?.style || DEFAULT_NOTE_CONFIG.style,
      tone: rawNoteConfig?.tone || DEFAULT_NOTE_CONFIG.tone,
    };

    const { buffer, contentType } = await downloadPrivateBlobToBuffer(blob.pathname);
    const inputType: InputType = contentType.startsWith('audio/') ? 'audio' : 'document';

    const sizeValidation = validateFileSize(buffer.length, inputType);
    if (!sizeValidation.valid) {
      return NextResponse.json(
        { error: 'File too large', details: sizeValidation.error },
        { status: 413 }
      );
    }

    const usageCheck = await verifyUsageLimits({
      inputType,
      fileSize: buffer.length,
    });
    if (!usageCheck.success) return usageCheck.errorResponse!;

    const mimeValidation = await validateMimeType(buffer, inputType);
    if (!mimeValidation.valid) {
      return NextResponse.json(
        {
          error: inputType === 'audio' ? 'Invalid audio format' : 'Invalid file type',
          details: inputType === 'audio'
            ? 'The audio format is not supported. Please use WebM, MP3, WAV, or M4A.'
            : 'The file type is not supported or the file may be corrupted.',
        },
        { status: 400 }
      );
    }

    if (mimeValidation.detectedType && blob.contentType && mimeValidation.detectedType !== blob.contentType) {
      logMimeTypeMismatch(user.id, blob.originalName || blob.pathname, blob.contentType, mimeValidation.detectedType);
    }

    let text = '';
    let title = blob.originalName || 'Study Set';
    let sourceType = inputType === 'audio' ? 'audio' : 'doc';

    const resolvedMimeType = mimeValidation.detectedType || contentType;
    const createDocumentParseError = (message: string) => NextResponse.json({
      error: 'Failed to read document',
      details: message,
    }, { status: 400 });

    if (resolvedMimeType === 'application/pdf') {
      try {
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(buffer);
        text = data.text;
      } catch {
        return createDocumentParseError('We could not read that PDF. Please try another file.');
      }
    } else if (resolvedMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      try {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } catch {
        return createDocumentParseError('We could not read that DOCX file. Please try another file.');
      }
    } else if (resolvedMimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      try {
        const officeParser = require('officeparser');
        text = await officeParser.parseOfficeAsync(buffer);
      } catch {
        return createDocumentParseError('We could not read that PPTX file. Please try another file.');
      }
    } else if (resolvedMimeType === 'text/plain') {
      text = buffer.toString('utf-8');
    } else if (resolvedMimeType.startsWith('audio/')) {
      const OpenAI = require('openai');
      const groq = new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
      });

      try {
        const file = new File([new Uint8Array(buffer)], blob.originalName || 'audio.webm', { type: resolvedMimeType });
        const transcription = await groq.audio.transcriptions.create({
          file,
          model: 'whisper-large-v3',
          temperature: 0,
          prompt: 'This is a student study recording. It may contain academic terms, technical vocabulary, and educational content.',
        });

        text = transcription.text;
        sourceType = 'audio';
      } catch (transcribeErr: any) {
        return NextResponse.json(
          { error: 'Failed to transcribe audio', details: transcribeErr.message || 'Audio transcription failed' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json({ error: 'Unsupported file type.' }, { status: 400 });
    }

    if (!resolvedMimeType.startsWith('audio/') && !text.trim()) {
      return NextResponse.json(
        {
          error: 'No readable content found',
          details: 'The uploaded file appears empty or does not contain extractable text.',
        },
        { status: 400 }
      );
    }

    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

    const recentSameDeck = await db.deck.findFirst({
      where: {
        userId: user.id,
        title,
        sourceType,
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000),
        },
      },
    });

    if (recentSameDeck) {
      return NextResponse.json({ deckId: recentSameDeck.id, isDuplicate: true, fileHash });
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Could not extract content' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const customSystemPrompt = buildSystemPrompt(noteConfig);
    const promptText = `${customSystemPrompt}

---

**ADDITIONAL INSTRUCTIONS:**

**Role:** Senior Academic Researcher & Note Taker
**Task:** Create comprehensive, detail-rich study notes from the input text.
**Goal:** Capture ALL relevant information. Do not over-summarize; prioritize completeness.

**1. STRICT LANGUAGE PROTOCOL:**
* **Detect:** Identify the Dominant Language of the input text.
* **Consistency:** The ENTIRE output (headers, bullets, explanations) MUST be in that Dominant Language.
* **Translation:** Translate the bracketed section headers below into the Dominant Language naturally.
* **NO MIXING:** If input is Korean, "Key Terminology" must be written in Korean. If Indonesian, use Indonesian headers entirely.

**2. THE "COMPREHENSIVE" TEMPLATE:**

# [Study Notes: {Insert Title of Source Material}]

> **[Executive Summary]**
> *(Provide a concise 2-3 sentence summary of the entire document here.)*

---

## 1. [Key Terminology & Definitions]
* **[Term 1]**: (Definition)
* **[Term 2]**: (Definition)

---

## 2. [Comprehensive Analysis]
*(Mirror the source structure and cover every major section.)*

### 2.1 [Main Topic 1 from Source]
* **[Core Concept]**: (Detailed explanation)
* **[Supporting Detail]**: (Data, dates, or specific arguments mentioned)

### 2.2 [Main Topic 2 from Source]
* *(Continue mirroring the source text's flow... )*

---

## 3. [Key Examples & Evidence]
* **Example 1:** (Describe the example) -> **Relevance:** (What does it prove?)

---

## 4. [Important Formulas / Dates / Figures]
*(Omit this section if not applicable.)*

---

## 5. [Summary & Key Takeaways]
* [Key takeaway 1]
* [Key takeaway 2]
* [Key takeaway 3]

---

**3. FORMATTING RULES:**
* **Bold** all key terms and definitions
* Use **Bullet points** for readability and easy scanning
* Use proper markdown headers (# ## ###)
* Add blank lines between sections for readability
* Add horizontal rules (---) between major sections
* **NO** mixing languages
* **NO** hallucinated info - only use what is explicitly in the source
* **NO** tables
* ALWAYS complete every sentence and section

**CRITICAL: Base your notes ONLY on the source content provided below. Do NOT invent or add information not present in the source material.**

**SOURCE CONTENT TO ANALYZE (CREATE NOTES FROM THIS EXACT CONTENT):**

---BEGIN TRANSCRIPT---
${text.slice(0, 30000)}
---END TRANSCRIPT---
`;

    let router: ReturnType<typeof createLLMRouter>;
    try {
      router = createLLMRouter(120000);
    } catch (error) {
      return NextResponse.json(
        {
          error: 'LLM Configuration Error',
          details: isProd
            ? 'Study generation is temporarily unavailable due to a server configuration issue.'
            : (error instanceof Error ? error.message : 'Failed to load LLM configuration'),
        },
        { status: 500 }
      );
    }

    const result = await router.streamText({
      messages: [{ role: 'user', content: promptText.slice(0, 35000) }],
      temperature: 0.3,
      feature: 'generate',
    });

    const generatedSummary = await result.text;
    const titleMatch = generatedSummary.match(/^#\s*(.+)$/m);
    if (titleMatch && titleMatch[1].trim().length > 3) {
      title = titleMatch[1].trim();
    }

    const deck = await db.deck.create({
      data: {
        userId: user.id,
        title,
        content: text || 'Audio Content',
        summary: generatedSummary,
        sourceType,
        noteConfig,
      } as any,
    });

    await incrementUsage(user.id);

    const { logAudit } = await import('@/lib/audit');
    logAudit({
      userId: user.id,
      action: 'GENERATE_DECK',
      resourceId: deck.id,
      details: { title, sourceType, inputLength: text.length, blobPathname: blob.pathname },
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
    }).catch(() => {});

    return NextResponse.json({ deckId: deck.id });
  } catch (error) {
    console.error('Generate from blob error:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: 'Failed to generate study set. Please try again later.',
      },
      { status: 500 }
    );
  }
}
