import { NextRequest, NextResponse } from 'next/server';
import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { db } from '@/lib/db';
import { checkRateLimitFromRequest } from '@/lib/ratelimit';
import { requireAuth } from '@/lib/auth';
import { verifyUsageLimits, incrementUsage, USAGE_LIMITS, InputType } from '@/lib/usageVerifier';

// Route segment config
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    console.log('🚀 API route hit - starting processing');

    // Rate limit check (uses User ID for authenticated users)
    const rateLimitResponse = await checkRateLimitFromRequest(req);
    if (rateLimitResponse) return rateLimitResponse;

    try {
        let text = '';
        let title = 'Study Set';
        let sourceType = 'doc'; // Track source: 'doc', 'youtube', or 'audio'
        let parts: any[] = [];

        const contentType = req.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            const body = await req.json();
            console.log('📦 Received JSON body keys:', Object.keys(body));
            console.log('📦 audioNotes exists:', !!body.audioNotes);
            console.log('📦 audioNotes length:', body.audioNotes?.length || 0);

            // Handle pre-processed audio notes from /api/generate-audio-notes
            if (body.audioNotes) {
                console.log('🎤 Processing pre-transcribed audio notes');

                // Verify usage limits (audio notes already validated in generate-audio-notes)
                const usageCheck = await verifyUsageLimits({ inputType: 'audio' });
                if (!usageCheck.success) return usageCheck.errorResponse!;

                const deck = await db.deck.create({
                    data: {
                        userId: usageCheck.user.id,
                        title: body.title || 'Audio Recording',
                        content: body.audioTranscript || 'Audio Content',
                        summary: body.audioNotes,
                        sourceType: 'audio',
                    } as any,
                });

                // Increment usage count after successful creation
                await incrementUsage(usageCheck.user.id);

                return NextResponse.json({ deckId: deck.id });
            }

            if (body.youtubeUrl) {
                console.log('📺 Processing YouTube URL:', body.youtubeUrl);

                // Verify usage limits for YouTube
                const usageCheck = await verifyUsageLimits({
                    inputType: 'youtube',
                    youtubeUrl: body.youtubeUrl
                });
                if (!usageCheck.success) return usageCheck.errorResponse!;

                // Extract video ID from various YouTube URL formats
                const videoIdMatch = body.youtubeUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/|youtube\.com\/shorts\/)([^&\n?#]+)/);
                if (!videoIdMatch) {
                    return NextResponse.json({
                        error: 'Invalid YouTube URL',
                        details: 'Please provide a valid YouTube video URL'
                    }, { status: 400 });
                }
                const videoId = videoIdMatch[1];
                console.log('🎬 Video ID:', videoId);

                try {
                    // Use Supadata API for transcript (supports auto-fallback to AI transcription)
                    const supadataApiKey = process.env.SUPADATA_API_KEY;
                    if (!supadataApiKey) {
                        console.error('❌ SUPADATA_API_KEY not configured');
                        return NextResponse.json({
                            error: 'Configuration error',
                            details: 'YouTube transcript service is not configured. Please contact support.'
                        }, { status: 500 });
                    }

                    const youtubeFullUrl = `https://www.youtube.com/watch?v=${videoId}`;
                    const supadataUrl = `https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(youtubeFullUrl)}&mode=auto`;

                    console.log('🔄 Fetching transcript from Supadata...');
                    const supadataRes = await fetch(supadataUrl, {
                        method: 'GET',
                        headers: {
                            'x-api-key': supadataApiKey,
                        },
                    });

                    if (!supadataRes.ok) {
                        const errorData = await supadataRes.json().catch(() => ({}));
                        console.error('❌ Supadata API error:', supadataRes.status, errorData);

                        if (supadataRes.status === 404) {
                            return NextResponse.json({
                                error: 'Video not found',
                                details: 'Could not find this video. It may be private, age-restricted, or unavailable.'
                            }, { status: 400 });
                        }

                        return NextResponse.json({
                            error: 'Failed to get transcript',
                            details: errorData.message || 'Unable to extract transcript from this video. Please try a different video.'
                        }, { status: 400 });
                    }

                    const supadataData = await supadataRes.json();
                    console.log('📝 Supadata response:', JSON.stringify(supadataData).slice(0, 200));

                    // Extract transcript text from Supadata response
                    // Supadata returns { content: [{ text: "...", offset: 0, duration: 5 }, ...] }
                    if (!supadataData.content || supadataData.content.length === 0) {
                        return NextResponse.json({
                            error: 'No transcript available',
                            details: 'Could not extract transcript from this video. The video may not have any spoken content.'
                        }, { status: 400 });
                    }

                    text = supadataData.content.map((segment: any) => segment.text).join(' ');

                    if (!text || text.trim().length < 50) {
                        return NextResponse.json({
                            error: 'Transcript too short',
                            details: 'The video transcript is too short to generate meaningful notes. Please try a longer video.'
                        }, { status: 400 });
                    }

                    // Try to get video title from oEmbed API
                    try {
                        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
                        const oembedRes = await fetch(oembedUrl);
                        if (oembedRes.ok) {
                            const oembedData = await oembedRes.json();
                            title = oembedData.title || 'YouTube Video';
                        } else {
                            title = 'YouTube Video';
                        }
                    } catch {
                        title = 'YouTube Video';
                    }

                    console.log('✅ Transcript fetched via Supadata, length:', text.length, 'Title:', title);
                    sourceType = 'youtube';

                } catch (transcriptErr: any) {
                    console.error('❌ Transcript fetch error:', transcriptErr);
                    return NextResponse.json({
                        error: 'Failed to process video',
                        details: transcriptErr.message || 'An error occurred while processing this video. Please try again.'
                    }, { status: 500 });
                }
            }
        } else if (contentType.includes('multipart/form-data')) {
            const formData = await req.formData();
            const file = formData.get('file') as File;

            console.log('📄 File received:', file?.name, file?.type, file?.size);

            if (!file) {
                return NextResponse.json({ error: 'No file provided' }, { status: 400 });
            }

            // Determine input type and verify usage limits
            const inputType: InputType = file.type.startsWith('audio/') ? 'audio' : 'document';
            const usageCheck = await verifyUsageLimits({
                inputType,
                fileSize: file.size
            });
            if (!usageCheck.success) return usageCheck.errorResponse!;

            title = file.name;
            const buffer = Buffer.from(await file.arrayBuffer());

            console.log('🔄 Starting file parsing for type:', file.type);

            if (file.type === 'application/pdf') {
                console.log('📑 Parsing PDF...');
                const pdfParse = require('pdf-parse');
                const data = await pdfParse(buffer);
                text = data.text;
                console.log('✅ PDF parsed, text length:', text.length);
            } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                console.log('📝 Parsing DOCX...');
                const mammoth = await import('mammoth');
                const result = await mammoth.extractRawText({ buffer });
                text = result.value;
                console.log('✅ DOCX parsed, text length:', text.length);
            } else if (file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
                console.log('📊 Parsing PPT...');
                const officeParser = require('officeparser');
                text = await officeParser.parseOfficeAsync(buffer);
                console.log('✅ PPT parsed, text length:', text.length);
            } else if (file.type === 'text/plain') {
                console.log('📄 Parsing TXT...');
                text = buffer.toString('utf-8');
                console.log('✅ TXT parsed, text length:', text.length);
            } else if (file.type.startsWith('audio/')) {
                console.log('🎤 Processing Audio with Groq Whisper...');

                // Use Groq Whisper for transcription
                const OpenAI = require('openai');
                const groq = new OpenAI({
                    apiKey: process.env.GROQ_API_KEY,
                    baseURL: 'https://api.groq.com/openai/v1',
                });

                try {
                    const transcription = await groq.audio.transcriptions.create({
                        file: file,
                        model: 'whisper-large-v3',
                        temperature: 0,
                        prompt: 'This is a student\'s study recording. It may contain academic terms, technical vocabulary, and educational content.',
                    });

                    text = transcription.text;
                    title = file.name || 'Audio Recording';
                    sourceType = 'audio';
                    console.log('✅ Audio transcribed, text length:', text.length);
                } catch (transcribeErr: any) {
                    console.error('❌ Groq transcription error:', transcribeErr);
                    return NextResponse.json({
                        error: 'Failed to transcribe audio',
                        details: transcribeErr.message || 'Audio transcription failed'
                    }, { status: 400 });
                }
            } else {
                console.log('❌ Unsupported file type:', file.type);
                return NextResponse.json({ error: 'Unsupported file type.' }, { status: 400 });
            }
        }

        // Validate input
        if ((!text || text.trim().length === 0) && parts.length === 0) {
            console.log('❌ No content to process');
            return NextResponse.json({ error: 'Could not extract content' }, { status: 400 });
        }

        // Prepare prompt
        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
        }

        console.log('🤖 Starting AI generation...');
        console.log('📝 Text content preview (first 500 chars):', text?.slice(0, 500) || 'NO TEXT');

        // Construct the messages for generateObject
        const promptText = `**Role:** Senior Academic Researcher & Note Taker
**Task:** Create comprehensive, detail-rich study notes from the input text.
**Goal:** Capture ALL relevant information. Do not over-summarize; prioritize completeness.

**1. STRICT LANGUAGE PROTOCOL:**
* **Detect:** Identify the Dominant Language of the input text.
* **Consistency:** The ENTIRE output (headers, bullets, explanations) MUST be in that Dominant Language.
* **Translation:** Translate the bracketed section headers below into the Dominant Language naturally.
* **NO MIXING:** If input is Korean, "Key Terminology" must be written as "핵심 용어". If Indonesian, use Indonesian headers entirely.

**2. THE "COMPREHENSIVE" TEMPLATE:**

# 📚 [Study Notes: {Insert Title of Source Material}]

> **[Executive Summary]**
> *(Provide a concise 2-3 sentence summary of the entire document here.)*

---

## 1. 📖 [Key Terminology & Definitions]
*(List every major technical term, acronym, or concept defined in the text.)*
* **[Term 1]**: (Definition)
* **[Term 2]**: (Definition)
* *(Continue for all important terms...)*

---

## 2. 🔍 [Comprehensive Analysis]
*(CRITICAL INSTRUCTION: Analyze the source text's structure. If the source has 3 main chapters/arguments, create 3 subsections below. Mirror the source structure - do not miss any sections.)*

### 2.1 [Main Topic 1 from Source]
* **[Core Concept]**: (Detailed explanation)
* **[Supporting Detail]**: (Data, dates, or specific arguments mentioned)
* *Context:* (Why is this important?)

### 2.2 [Main Topic 2 from Source]
* *(Continue mirroring the source text's flow...)*

### 2.3 [Main Topic 3 from Source]
* *(Add as many subsections as needed to cover ALL content...)*

---

## 3. 💡 [Key Examples & Evidence]
*(Extract specific examples, case studies, or scenarios mentioned in the text to illustrate the concepts.)*
* **Example 1:** (Describe the example) → **Relevance:** (What does it prove?)
* **Example 2:** (Describe the example) → **Relevance:** (What does it prove?)

---

## 4. 📊 [Important Formulas / Dates / Figures]
*(If applicable. If the source contains no formulas, dates, or figures, OMIT this section entirely.)*
* (List equations, historical dates, statistics, or key people mentioned)

---

## 5. ✅ [Summary & Key Takeaways]
*(Bullet points of the "Big Picture" conclusions from the source material)*
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
* Use emojis strategically to enhance readability (but don't overuse)
* **NO** mixing languages - 100% consistency required
* **NO** hallucinated info - only use what is explicitly in the source
* **NO** tables - use bullet points or clear text formatting instead
* ALWAYS complete every sentence and section - never cut off mid-thought

**CRITICAL: Base your notes ONLY on the source content provided below. Do NOT invent or add information not present in the source material.**

${text ? `**SOURCE CONTENT TO ANALYZE (CREATE NOTES FROM THIS EXACT CONTENT):**

---BEGIN TRANSCRIPT---
${text.slice(0, 50000)}
---END TRANSCRIPT---

Remember: Your notes must be based ONLY on the content between BEGIN TRANSCRIPT and END TRANSCRIPT markers above.` : ''}
`;

        const messages: any[] = [
            { role: 'user', content: promptText }
        ];

        if (parts.length > 0) {
            messages[0].experimental_attachments = parts.map(p => ({
                name: 'audio',
                contentType: p.inlineData.mimeType,
                url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`
            }));
        }

        console.log('📨 Sending messages to AI:', JSON.stringify(messages.map(m => ({
            ...m,
            experimental_attachments: m.experimental_attachments?.map((a: any) => ({ ...a, url: '[BASE64 DATA]' }))
        })), null, 2));

        // Use streamText to keep connection alive during generation (prevents Vercel timeouts)
        const result = streamText({
            model: google('gemini-2.5-flash'),
            messages: messages,
        });

        // Await the full text - connection stays open while streaming
        const generatedSummary = await result.text;

        console.log('✅ AI generation complete, summary length:', generatedSummary.length);

        // Extract content-based title from generated summary (first # heading)
        const titleMatch = generatedSummary.match(/^#\s*📚?\s*(.+)$/m);
        if (titleMatch) {
            const extractedTitle = titleMatch[1].trim();
            // Use extracted title if it's meaningful (longer than 3 chars)
            if (extractedTitle.length > 3) {
                title = extractedTitle;
                console.log('📝 Extracted content title:', title);
            }
        }

        // 3. Save to Database - Get authenticated user
        const { user, errorResponse } = await requireAuth();
        if (errorResponse) return errorResponse;

        const deck = await db.deck.create({
            data: {
                userId: user.id,
                title: title,
                content: text || 'Audio Content',
                summary: generatedSummary,
                sourceType: sourceType,
            } as any,
        });

        // Increment usage count after successful deck creation
        await incrementUsage(user.id);

        return NextResponse.json({ deckId: deck.id });

    } catch (error) {
        console.error('❌ Generation error:', error);
        return NextResponse.json({
            error: 'Failed to generate study set',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
