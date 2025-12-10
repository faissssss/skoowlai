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
                    const { YoutubeTranscript } = await import('@danielxceron/youtube-transcript');

                    // Try to get transcript with the video ID directly (this package has InnerTube fallback)
                    const transcript = await YoutubeTranscript.fetchTranscript(videoId);

                    if (!transcript || transcript.length === 0) {
                        return NextResponse.json({
                            error: 'No captions available',
                            details: 'This video does not have captions/subtitles available. Please try a video with closed captions enabled.'
                        }, { status: 400 });
                    }

                    text = transcript.map(t => t.text).join(' ');

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

                    console.log('✅ Transcript fetched, length:', text.length, 'Title:', title);
                    sourceType = 'youtube'; // Mark as YouTube source

                } catch (transcriptErr: any) {
                    console.error('❌ Transcript fetch error:', transcriptErr);

                    // Provide user-friendly error messages
                    let errorMessage = 'Failed to fetch video transcript';
                    let details = transcriptErr.message || String(transcriptErr);

                    if (details.includes('disabled') || details.includes('Transcript is disabled')) {
                        errorMessage = 'Captions are disabled';
                        details = 'The video owner has disabled captions for this video. Please try a different video with enabled subtitles.';
                    } else if (details.includes('not available') || details.includes('Could not find')) {
                        errorMessage = 'No captions available';
                        details = 'This video does not have captions/subtitles. Please try a video with closed captions enabled.';
                    } else if (details.includes('private') || details.includes('unavailable')) {
                        errorMessage = 'Video unavailable';
                        details = 'This video is private, age-restricted, or unavailable. Please try a different video.';
                    }

                    return NextResponse.json({
                        error: errorMessage,
                        details: details
                    }, { status: 400 });
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
        const promptText = `You are an expert educational content creator specializing in creating comprehensive, well-structured study notes. Your goal is to transform the provided content into beautifully formatted, highly readable study notes that students will love.

**CRITICAL REQUIREMENTS:**

1. **Create COMPREHENSIVE notes** - Cover ALL important concepts, definitions, examples, and details from the source material
2. **Use CLEAR STRUCTURE** - Organize content logically with proper heading hierarchy
3. **Make it VISUALLY APPEALING** - Use emojis strategically to enhance readability (but don't overuse them)
4. **Write in CLEAR, SIMPLE language** - Explain complex concepts in an easy-to-understand way
5. **Include PLENTY OF EXAMPLES** - Provide code examples, real-world applications, or illustrations where relevant
6. **Use BULLET POINTS and LISTS** for easy scanning
7. **Highlight KEY TERMS** with **bold text**
8. **Create LOGICAL SECTIONS** that flow naturally

**REQUIRED STRUCTURE for the 'summary' field:**

# 📚 [Clear, Descriptive Title]

> [One-sentence overview that captures the essence of the topic]

---

## 🎯 Learning Objectives

After studying these notes, you will be able to:
- [Objective 1]
- [Objective 2]
- [Objective 3]

---

## 📖 Overview

[2-3 paragraphs providing context and background. Explain what this topic is about, why it matters, and how it fits into the bigger picture.]

---

## 🔑 Key Concepts

### [Concept 1 Name]
**Definition:** [Clear definition]

**Explanation:** [Detailed explanation in simple terms]

**Example:**
\`\`\`
[Code example or practical illustration]
\`\`\`

**Key Points:**
- [Important detail 1]
- [Important detail 2]

### [Concept 2 Name]
[Same structure as above]

[... Continue for all major concepts ...]

---

## 💡 Detailed Content

### [Section 1 - Descriptive Title]

[Comprehensive explanation of this section's topic]

**Important Points:**
- [Point 1 with details]
- [Point 2 with details]
- [Point 3 with details]

**Example:**
\`\`\`
[Relevant code or example]
\`\`\`

### [Section 2 - Descriptive Title]
[Continue with the same detailed approach]

[... Add as many sections as needed to cover all content ...]

---

## ⚙️ Practical Applications

[How is this topic used in real-world scenarios? Provide 2-3 concrete examples]

1. **[Use Case 1]**
   - [Description]
   - [Why it's useful]

2. **[Use Case 2]**
   - [Description]
   - [Why it's useful]

---

## ⚠️ Common Mistakes & Tips

**Common Mistakes:**
- ❌ [Mistake 1] - [Why it's wrong]
- ❌ [Mistake 2] - [Why it's wrong]

**Pro Tips:**
- ✅ [Tip 1]
- ✅ [Tip 2]
- ✅ [Tip 3]

---

## 📝 Summary & Key Takeaways

**In summary:**
[2-3 sentences summarizing the main points]

**Remember these key points:**
1. [Key takeaway 1]
2. [Key takeaway 2]
3. [Key takeaway 3]

---

## 🔗 Related Topics

- [Related topic 1]
- [Related topic 2]
- [Related topic 3]

**IMPORTANT FORMATTING RULES:**
- Use proper markdown headers (# ## ###)
- Add blank lines between sections for readability
- Use code blocks (\`\`\`) for code examples
- Use **bold** for key terms and definitions
- Use bullet points (-) for lists
- Use numbered lists (1. 2. 3.) for sequential steps
- Add horizontal rules (---) between major sections
- Choose emojis that are relevant and helpful, not random
- DO NOT use tables - use bullet points or clear text formatting instead
- Be CONCISE but COMPLETE - avoid unnecessary padding or repetition
- Focus on key information and insights, skip filler content
- ALWAYS complete every sentence and section - never cut off mid-thought
- Prioritize finishing the content over making it longer

**CRITICAL: You MUST base your notes ONLY on the source content provided below. Do NOT invent, hallucinate, or add information that is not present in the source material. If the source is about thermodynamics, your notes must be about thermodynamics.**

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
