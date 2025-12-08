import { NextRequest, NextResponse } from 'next/server';
import OpenAI, { toFile } from 'openai';

export const maxDuration = 30;

// Initialize Groq client (OpenAI-compatible)
const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { audio, mimeType } = body;

        if (!audio) {
            return NextResponse.json(
                { error: 'No audio data provided' },
                { status: 400 }
            );
        }

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
            if (error.message.includes('Invalid API Key')) {
                return NextResponse.json(
                    { error: 'Groq API key is invalid' },
                    { status: 401 }
                );
            }
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to transcribe voice note' },
            { status: 500 }
        );
    }
}
