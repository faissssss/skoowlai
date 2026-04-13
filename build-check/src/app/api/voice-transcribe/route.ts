import { NextRequest, NextResponse } from 'next/server';
import OpenAI, { toFile } from 'openai';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { checkRateLimitFromRequest } from '@/lib/ratelimit';
import { checkCsrfOrigin } from '@/lib/csrf';

export const maxDuration = 30;

// Initialize Groq client (OpenAI-compatible)
const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
});

export async function POST(req: NextRequest) {
    const csrfError = checkCsrfOrigin(req);
    if (csrfError) return csrfError;

    // 1. Authenticate user first
    const { user, errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    // Rate limit check
    const rateLimitResponse = await checkRateLimitFromRequest(req);
    if (rateLimitResponse) return rateLimitResponse;

    try {
        const body = await req.json();

        const voiceTranscribeSchema = z.object({
            audio: z.string().min(1), // Base64 string
            mimeType: z.string().regex(/^audio\/.+/).optional() // Optional but must be audio type if present
        }).strict();

        const payload = voiceTranscribeSchema.safeParse(body);

        if (!payload.success) {
            return NextResponse.json(
                { error: 'Invalid request', details: payload.error.flatten() },
                { status: 400 }
            );
        }

        const { audio, mimeType } = payload.data;

        console.log('🎙️ Voice note received, transcribing with Groq Whisper...');

        // Convert base64 to buffer
        const binaryString = atob(audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const buffer = Buffer.from(bytes);

        // Create a File-like object for Groq
        const audioFile = await toFile(buffer, 'voice_note.webm', {
            type: mimeType || 'audio/webm',
        });

        // Transcribe with Groq Whisper
        const transcription = await groq.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-large-v3',
            temperature: 0,
            prompt: 'This is a voice message from a student asking questions about their study material.',
        });

        const transcript = transcription.text;

        console.log('✅ Voice note transcribed:', transcript.slice(0, 100));

        return NextResponse.json({
            transcript: transcript.trim(),
        });

    } catch (error) {
        console.error('❌ Voice transcription error:', error);

        if (error instanceof Error) {
            const isProd = process.env.NODE_ENV === 'production';
            if (error.message.includes('Invalid API Key')) {
                return NextResponse.json(
                    { error: 'Groq API key is invalid' },
                    { status: 401 }
                );
            }
            return NextResponse.json(
                { error: 'Internal Server Error', details: isProd ? 'Transcription failed' : error.message },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to transcribe voice note' },
            { status: 500 }
        );
    }
}
