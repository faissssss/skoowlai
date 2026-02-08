import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { z } from 'zod';
import { NextRequest } from 'next/server';
import { checkRateLimitFromRequest } from '@/lib/ratelimit';
import { requireAuth } from '@/lib/auth';

export const maxDuration = 120; // Allow longer processing time for audio
// Node.js runtime required: uses Prisma via requireAuth/db
export const runtime = 'nodejs';

const REWRITE_PROMPTS: Record<string, string> = {
    improve: 'Improve the writing quality, clarity, and flow while maintaining the core message.',
    shorten: 'Make this text more concise while preserving the key information. Remove unnecessary words.',
    paraphrase: 'Rewrite this text in a different way while keeping the same meaning.',
    simplify: 'Rewrite this text using simpler language that is easier to understand.',
    detailed: 'Expand this text with more details, examples, or explanations while keeping it relevant.',
};

export async function POST(req: NextRequest) {
    // 1. Authenticate user first
    const { user, errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    // Rate limit check (uses User ID for authenticated users)
    const rateLimitResponse = await checkRateLimitFromRequest(req);
    if (rateLimitResponse) return rateLimitResponse;

    try {
        const body = await req.json();
        console.log('Rewrite API Request Body:', JSON.stringify(body, null, 2));

        const rewriteSchema = z.object({
            text: z.string().min(1).max(5000), // Prevent massive payloads
            action: z.enum(['improve', 'shorten', 'paraphrase', 'simplify', 'detailed']),
            deckId: z.string().cuid().optional().nullable() // Client may send deckId (or null)
        }).strict();

        const payload = rewriteSchema.safeParse(body);

        if (!payload.success) {
            console.error('Rewrite API Validation Error:', payload.error.flatten());
            return new Response(JSON.stringify({ error: 'Invalid request', details: payload.error.flatten() }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { text, action } = payload.data;

        const instruction = REWRITE_PROMPTS[action];

        const result = streamText({
            model: google('gemini-2.5-flash'),
            messages: [
                {
                    role: 'user',
                    content: text,
                },
            ],
            temperature: 0.3, // Lower for consistent rewriting quality
            system: `**Role:** Professional Multi-lingual Editor
**Task:** Rewrite the user's input text based on the selected action: "${action}" (${instruction}).

**CRITICAL RULES (MUST FOLLOW):**

1. **STRICT LANGUAGE MATCHING (HIGHEST PRIORITY):**
   * **Detect** the language of the input text (e.g., Indonesian, English, Spanish, Korean, Japanese, Chinese, etc.).
   * **Output** the rewritten text in the **EXACT SAME LANGUAGE** as the input.
   * **DO NOT translate.** If input is Korean, output MUST be Korean. If Spanish, output Spanish.
   * Example: Input "Saya suka belajar" (Indonesian) → Output MUST be in Indonesian, NOT English.

2. **PLAIN TEXT ONLY:**
   * Return pure, raw text only.
   * **NO MARKDOWN:** Do NOT wrap output in bold tags (\`**\`), italics (\`*\` or \`_\`), or quotes.
   * **NO META-COMMENTARY:** Do not add "Here is the rewritten version:" or "Result:" or "Sure!".
   * **NO HIGHLIGHTING:** Do not bold changes or key terms.

3. **OUTPUT RULES:**
   * Return ONLY the rewritten text - nothing else
   * Preserve paragraph structure if present
   * Output the transformed text directly with no decorations`,
        });

        return result.toTextStreamResponse();

    } catch (error) {
        const isProd = process.env.NODE_ENV === 'production';
        console.error('Rewrite API Error Details:', {
            name: (error as Error).name,
            message: (error as Error).message,
            stack: (error as Error).stack,
            cause: (error as Error).cause
        });

        return new Response(JSON.stringify({
            error: 'Internal Server Error',
            details: isProd ? 'An error occurred while processing your request.' : (error as Error).message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
