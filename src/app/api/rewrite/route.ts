import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { NextRequest } from 'next/server';
import { checkRateLimitFromRequest } from '@/lib/ratelimit';

export const maxDuration = 60;

const REWRITE_PROMPTS: Record<string, string> = {
    improve: 'Improve the writing quality, clarity, and flow while maintaining the core message.',
    shorten: 'Make this text more concise while preserving the key information. Remove unnecessary words.',
    paraphrase: 'Rewrite this text in a different way while keeping the same meaning.',
    simplify: 'Rewrite this text using simpler language that is easier to understand.',
    detailed: 'Expand this text with more details, examples, or explanations while keeping it relevant.',
};

export async function POST(req: NextRequest) {
    // Rate limit check (uses User ID for authenticated users)
    const rateLimitResponse = await checkRateLimitFromRequest(req);
    if (rateLimitResponse) return rateLimitResponse;

    const { text, action } = await req.json();

    if (!text || !action || !REWRITE_PROMPTS[action]) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const instruction = REWRITE_PROMPTS[action];

    const result = streamText({
        model: google('gemini-2.5-flash'),
        messages: [
            {
                role: 'user',
                content: text,
            },
        ],
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
}
