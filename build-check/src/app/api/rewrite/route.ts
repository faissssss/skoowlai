import { z } from 'zod';
import { NextRequest } from 'next/server';
import { checkRateLimitFromRequest } from '@/lib/ratelimit';
import { requireAuth } from '@/lib/auth';
import { checkCsrfOrigin } from '@/lib/csrf';
import { createLLMRouter } from '@/lib/llm/service';
import type { StreamTextResult } from '@/lib/llm/router';
import { validateTextSize } from '@/lib/input-validator';

console.log('🟢 [REWRITE] Module loaded successfully');

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
    console.log('🔵 [REWRITE] POST endpoint called');
    
    const csrfError = checkCsrfOrigin(req);
    if (csrfError) {
        console.log('🔴 [REWRITE] CSRF check failed');
        return csrfError;
    }

    // 1. Authenticate user first
    const { errorResponse } = await requireAuth();
    if (errorResponse) {
        console.log('🔴 [REWRITE] Auth check failed');
        return errorResponse;
    }

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

        // Validate text size (already limited to 5000 chars in schema, but check bytes)
        const textValidation = validateTextSize(text);
        if (!textValidation.valid) {
            return new Response(JSON.stringify({ error: textValidation.error }), {
                status: 413,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const instruction = REWRITE_PROMPTS[action];

        // Initialize LLM Router with error handling
        let result: StreamTextResult;
        try {
            const router = createLLMRouter(30000);
            result = await router.streamText({
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
                feature: 'rewrite',
            });
        } catch (error) {
            console.error('Failed to load LLM configuration:', error);
            return new Response(JSON.stringify({
                error: 'LLM Configuration Error',
                details: error instanceof Error ? error.message : 'Failed to load LLM configuration'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Create a simple text stream response
        // Don't access result.text as it consumes the stream
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // Iterate over the text stream chunks
                    for await (const textChunk of result.textStream) {
                        controller.enqueue(encoder.encode(textChunk));
                    }
                    controller.close();
                } catch (error) {
                    console.error('[REWRITE] Stream error:', error);
                    controller.error(error);
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache',
                'X-Rate-Limit-Remaining': result.rateLimitInfo?.remaining.toString() || '0',
                'X-Rate-Limit-Limit': result.rateLimitInfo?.limit.toString() || '0',
                'X-Degraded-Mode': result.degradedMode ? 'true' : 'false',
            },
        });

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
