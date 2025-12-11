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
        system: `You are a text editing assistant. Rewrite the text according to this instruction: ${instruction}

**CRITICAL FORMATTING RULE:**
Return PURE PLAIN TEXT only. Do NOT use any markdown formatting:
- Do NOT use bolding (\`**\` or \`__\`)
- Do NOT use italics (\`*\` or \`_\`)  
- Do NOT use quotes around the output
- Do NOT wrap the output in markdown syntax of any kind
- Just give me the raw, unformatted text

ADDITIONAL RULES:
1. Return ONLY the rewritten text - nothing else
2. Do NOT include phrases like "Here is the rewritten text:" or "Sure!" or any conversational filler
3. Preserve paragraph structure if present
4. Output the transformed text directly with no decorations`,
    });

    return result.toTextStreamResponse();
}
