import { NextRequest, NextResponse } from 'next/server';
import OpenAI, { toFile } from 'openai';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { checkRateLimitFromRequest } from '@/lib/ratelimit';
import { verifyUsageLimits, USAGE_LIMITS } from '@/lib/usageVerifier';

export const maxDuration = 120; // Allow longer processing time for audio

// Initialize Groq client (OpenAI-compatible)
const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
});

const NOTE_GENERATION_PROMPT = `You are an expert academic tutor. You will be given a raw transcript of a lecture or study session. Your task is to rewrite this transcript into clear, structured Markdown study notes.

**CRITICAL LANGUAGE RULE:**
- Analyze the input text to determine its **dominant language** (e.g., Indonesian, English, Spanish, French, etc.)
- Your output MUST be in that **exact same language** - 100% consistency required
- Do NOT mix languages. Do NOT switch languages midway through your response
- If the input is in Indonesian, ALL headers, bullet points, summaries, and content must be in Indonesian
- If the input is in English, ALL content must be in English
- This applies to every element: titles, section headers, explanations, examples, and conclusions

CRITICAL FORMATTING RULES:
1. Create a Title based on the content (use # heading)
2. Use ## headers for main topics
3. Use bullet points for details
4. **Bold** key definitions and important terms
5. Remove all filler words (um, uh, like, you know, so, basically)
6. Remove repetitions and stammering
7. Organize information logically
8. Add blank lines between sections for readability

Output ONLY the Markdown notes, nothing else.`;

export async function POST(req: NextRequest) {
    // Rate limit check (uses User ID for authenticated users)
    const rateLimitResponse = await checkRateLimitFromRequest(req);
    if (rateLimitResponse) return rateLimitResponse;

    try {
        const body = await req.json();
        const { audio, mimeType, fileName } = body;

        if (!audio) {
            return NextResponse.json(
                { error: 'No audio data provided' },
                { status: 400 }
            );
        }

        console.log('🎤 Received audio data, converting from base64...');

        // Convert base64 to buffer
        const binaryString = atob(audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const buffer = Buffer.from(bytes);

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

        // Step 2: Generate structured notes with Gemini
        console.log('🤖 Generating notes with Gemini...');

        const { text: notes } = await generateText({
            model: google('gemini-2.5-flash'),
            system: NOTE_GENERATION_PROMPT,
            prompt: `Create study notes from this transcript:\n\n${transcript}`,
        });

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
                { error: error.message, details: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to process audio' },
            { status: 500 }
        );
    }
}
