import { NextRequest, NextResponse } from 'next/server';
import OpenAI, { toFile } from 'openai';
import { checkRateLimitFromRequest } from '@/lib/ratelimit';
import { verifyUsageLimits } from '@/lib/usageVerifier';
import { requireAuth } from '@/lib/auth';
import { checkCsrfOrigin } from '@/lib/csrf';
import { createLLMRouter } from '@/lib/llm/service';

export const maxDuration = 120; // Allow longer processing time for audio
// Node.js runtime required: uses OpenAI SDK/Buffer
export const runtime = 'nodejs';

async function parseAudioRequest(req: NextRequest): Promise<{
    audioBuffer: Buffer | null;
    mimeType: string;
    fileName: string;
    errorResponse?: NextResponse;
}> {
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
        const formData = await req.formData();
        const audioFile = formData.get('audio');

        if (!(audioFile instanceof File)) {
            return {
                audioBuffer: null,
                mimeType: 'audio/webm',
                fileName: 'audio.webm',
                errorResponse: NextResponse.json(
                    { error: 'No audio file provided' },
                    { status: 400 }
                ),
            };
        }

        return {
            audioBuffer: Buffer.from(await audioFile.arrayBuffer()),
            mimeType: audioFile.type || 'audio/webm',
            fileName: audioFile.name || 'audio.webm',
        };
    }

    const body = await req.json();
    const { audio, mimeType, fileName } = body ?? {};

    if (!audio) {
        return {
            audioBuffer: null,
            mimeType: mimeType || 'audio/webm',
            fileName: fileName || 'audio.webm',
            errorResponse: NextResponse.json(
                { error: 'No audio data provided' },
                { status: 400 }
            ),
        };
    }

    const binaryString = atob(audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    return {
        audioBuffer: Buffer.from(bytes),
        mimeType: mimeType || 'audio/webm',
        fileName: fileName || 'audio.webm',
    };
}

// Initialize Groq client (OpenAI-compatible)
const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
});

const NOTE_GENERATION_PROMPT = `**Role:** Senior Academic Researcher & Note Taker
**Task:** Create comprehensive, detail-rich study notes from the audio transcript.
**Goal:** Capture ALL relevant information. Do not over-summarize; prioritize completeness.

**1. STRICT LANGUAGE PROTOCOL:**
* **Detect:** Identify the Dominant Language of the transcript.
* **Consistency:** The ENTIRE output (headers, bullets, explanations) MUST be in that Dominant Language.
* **Translation:** Translate section headers into the Dominant Language naturally.
* **NO MIXING:** If input is Korean, headers must be in Korean. If Indonesian, use Indonesian entirely.

**2. TRANSCRIPT CLEANUP:**
* Remove all filler words (um, uh, like, you know, so, basically)
* Remove repetitions and stammering
* Organize information logically

**3. THE "COMPREHENSIVE" TEMPLATE:**

# 📚 [Study Notes: {Title based on content}]

> **[Executive Summary]**
> *(2-3 sentence summary of the lecture/session)*

---

## 1. 📖 [Key Terminology & Definitions]
* **[Term 1]**: (Definition)
* **[Term 2]**: (Definition)

---

## 2. 🔍 [Comprehensive Analysis]
*(Mirror the lecture's structure - create subsections for each main topic discussed)*

### 2.1 [Main Topic 1]
* **[Core Concept]**: (Detailed explanation)
* **[Supporting Detail]**: (Specific points mentioned)

### 2.2 [Main Topic 2]
* *(Continue for all topics covered...)*

---

## 3. 💡 [Key Examples & Evidence]
* **Example:** (Description) → **Relevance:** (What it illustrates)

---

## 4. ✅ [Summary & Key Takeaways]
* [Key takeaway 1]
* [Key takeaway 2]
* [Key takeaway 3]

---

**FORMATTING RULES:**
* **Bold** all key terms
* Use bullet points for readability
* Use proper markdown headers (# ## ###)
* Add horizontal rules (---) between sections
* **NO** mixing languages
* **NO** hallucinated info - only use what is in the transcript

Output ONLY the Markdown notes, nothing else.`;

export async function POST(req: NextRequest) {
    const csrfError = checkCsrfOrigin(req);
    if (csrfError) return csrfError;

    // 1. Authenticate user first
        const { errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    // Rate limit check (uses User ID for authenticated users)
    const rateLimitResponse = await checkRateLimitFromRequest(req);
    if (rateLimitResponse) return rateLimitResponse;

    try {
        const parsedRequest = await parseAudioRequest(req);
        if (parsedRequest.errorResponse) return parsedRequest.errorResponse;

        const { audioBuffer: buffer, mimeType, fileName } = parsedRequest;

        if (!buffer) {
            return NextResponse.json(
                { error: 'No audio data provided' },
                { status: 400 }
            );
        }

        console.log('🎤 Received audio data, preparing transcription...');

        // SECURITY: Validate file size FIRST
        const { validateFileSize } = await import('@/lib/size-validator');
        const sizeValidation = validateFileSize(buffer.length, 'audio');
        
        if (!sizeValidation.valid) {
            console.warn('[Security] Audio file size limit exceeded', {
                fileName: fileName || 'audio.webm',
                fileSize: buffer.length,
                maxSize: sizeValidation.maxSize,
            });
            return NextResponse.json({
                error: 'Audio file too large',
                details: sizeValidation.error
            }, { status: 413 });
        }

        // SECURITY: Validate MIME type using magic number detection
        const { validateMimeType } = await import('@/lib/mime-validator');
        const mimeValidation = await validateMimeType(buffer, 'audio');
        
        if (!mimeValidation.valid) {
            console.warn('[Security] Audio MIME type validation failed', {
                fileName: fileName || 'audio.webm',
                clientType: mimeType || 'audio/webm',
                detectedType: mimeValidation.detectedType,
                error: mimeValidation.error,
            });
            return NextResponse.json({
                error: 'Invalid audio format',
                details: 'The audio format is not supported. Please use WebM, MP3, WAV, or M4A.'
            }, { status: 400 });
        }

        // Verify usage limits with audio file size
        const usageCheck = await verifyUsageLimits({
            inputType: 'audio',
            fileSize: buffer.length
        });
        if (!usageCheck.success) return usageCheck.errorResponse!;

        // Create a File-like object for Groq
        const audioFile = await toFile(buffer, fileName || 'audio.webm', {
            type: mimeType || 'audio/webm',
        });

        // Step 1: Transcribe with Groq Whisper
        console.log('🔊 Starting transcription with Groq Whisper...');

        const transcription = await groq.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-large-v3',
            temperature: 0,
            prompt: 'This is a student\'s study recording. It may contain academic terms, technical vocabulary, and educational content.',
        });

        const transcript = transcription.text;

        if (!transcript || transcript.trim().length === 0) {
            return NextResponse.json(
                { error: 'Could not transcribe audio. Please ensure clear audio quality.' },
                { status: 400 }
            );
        }

        console.log('✅ Transcription complete, length:', transcript.length);
        console.log('📝 Transcript preview:', transcript.slice(0, 200));

        // Step 2: Generate structured notes with LLM Router
        console.log('🤖 Generating notes with LLM Router...');

        // Initialize LLM Router with error handling
        let router: ReturnType<typeof createLLMRouter>;
        try {
            router = createLLMRouter(30000);
        } catch (error) {
            console.error('Failed to load LLM configuration:', error);
            return NextResponse.json({
                error: 'LLM Configuration Error',
                details: error instanceof Error ? error.message : 'Failed to load LLM configuration'
            }, { status: 500 });
        }

        // Use LLM Router for streaming text generation
        const result = await router.streamText({
            messages: [
                { role: 'user', content: `Create study notes from this transcript:\n\n${transcript}` }
            ],
            temperature: 0.3,
            system: NOTE_GENERATION_PROMPT,
            feature: 'generate-audio-notes',
        });

        // Await the full text
        const notes = await result.text;

        console.log('✅ Notes generated successfully.');
        console.log('📝 Notes length:', notes?.length || 0);
        console.log('📝 Notes preview:', notes?.slice(0, 100) || 'EMPTY');

        // Fallback: if notes are empty, use the transcript as notes
        const finalNotes = notes && notes.trim().length > 0
            ? notes
            : `# Audio Recording Notes\n\n${transcript}`;

        // Extract title from generated notes (first # heading)
        let title = 'Audio Recording';
        const titleMatch = finalNotes.match(/^#\s*(.+)$/m);
        if (titleMatch) {
            title = titleMatch[1].trim();
            console.log('📝 Extracted audio title:', title);
        }

        return NextResponse.json({
            notes: finalNotes,
            transcript: transcript,
            title: title,
        });

    } catch (error) {
        console.error('❌ Audio notes generation error:', error);

        if (error instanceof Error) {
            const isProd = process.env.NODE_ENV === 'production';
            // Handle specific Groq errors
            if (error.message.includes('Invalid API Key')) {
                return NextResponse.json(
                    { error: 'Groq API key is invalid or missing' },
                    { status: 401 }
                );
            }
            if (error.message.includes('rate_limit')) {
                return NextResponse.json(
                    { error: 'Rate limit exceeded. Please try again in a moment.' },
                    { status: 429 }
                );
            }
            return NextResponse.json(
                { error: 'Internal Server Error', details: isProd ? 'Audio processing failed' : error.message },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to process audio' },
            { status: 500 }
        );
    }
}
