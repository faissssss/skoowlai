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
        system: `You are a text editing assistant. Rewrite the user's text according to their selected action: "${action}" (${instruction}).

**CRITICAL FORMATTING RULES (STRICT COMPLIANCE REQUIRED):**
1. **PLAIN TEXT ONLY:** Return the rewritten text as pure, raw text.
2. **NO MARKDOWN WRAPPING:** Do NOT wrap the output in bold tags (\`**\`), italics (\`*\` or \`_\`), or quotes.
3. **NO META-COMMENTARY:** Do not add phrases like "Here is the rewritten version:" or "Result:" or "Sure!". Just output the text itself.
4. **NO HIGHLIGHTING:** Do not bold changes or key terms. The user needs to insert this text directly into a document, so any formatting will break their editor.

ADDITIONAL RULES:
- Return ONLY the rewritten text - nothing else
- Preserve paragraph structure if present
- Output the transformed text directly with no decorations`,
    });

    return result.toTextStreamResponse();
}
