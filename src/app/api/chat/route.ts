import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { checkRateLimitFromRequest } from '@/lib/ratelimit';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    // Rate limit check (uses User ID for authenticated users)
    const rateLimitResponse = await checkRateLimitFromRequest(req);
    if (rateLimitResponse) return rateLimitResponse;

    const { messages, context, deckId } = await req.json();
    console.log('Chat API Request:', { messagesLength: messages?.length, contextLength: context?.length, deckId });

    // Load previous conversation history from database
    const previousMessages = await db.chatMessage.findMany({
        where: { deckId },
        orderBy: { createdAt: 'asc' },
    });

    // Convert database messages to AI SDK format
    // Note: We don't pass citation to AI SDK messages as it doesn't support it natively
    // The citation is already part of the content string if it was sent that way, 
    // or we rely on the UI to render it from the DB data.
    const conversationHistory = previousMessages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
    }));

    // Combine history with new messages
    const allMessages = [...conversationHistory, ...messages];

    const result = streamText({
        model: google('gemini-2.5-flash'),
        messages: allMessages,
        system: `You are Skoowl AI, a friendly study assistant. Help students understand their notes clearly and concisely.

**CRITICAL FORMATTING RULES:**

1. **ABSOLUTELY NO HEADERS OR TITLES:**
   - Do NOT use ### headers
   - Do NOT add bold titles like "**Inventor of Entropy**" or "**Key Concepts**"
   - Do NOT create section headers of any kind
   - Just answer directly without any title or header text

2. **COMPACT OUTPUT:**
   - Single line breaks between items, no extra blank lines
   - Lists should be tight: "- Item 1\\n- Item 2" NOT "- Item 1\\n\\n- Item 2"

3. **DIRECT ANSWERS:**
   - Start with the answer immediately
   - No introductory phrases like "Here's the answer"
   - No restating the question

4. **SIMPLE FORMATTING:**
   - Use **bold** only for key terms within sentences
   - Use bullet points (-) or numbered lists for multiple items
   - Keep it minimal and clean

**Good example for "who invented entropy":**
The concept was introduced by German physicist **Rudolf Clausius** in the 1850s as part of his work on thermodynamics.

**Bad example (DO NOT DO THIS):**
**Inventor of Entropy**
The concept was introduced...

Here are the student's notes for reference:
${context}
`,
        async onFinish({ text }) {
            // Save both user message and assistant response to database
            if (deckId) {
                const userMessage = messages[messages.length - 1];

                // Clean up content for DB storage: remove the prepended citation if it exists
                let dbContent = userMessage.content;
                if (userMessage.citation) {
                    const citationPart = `> "${userMessage.citation}"\n\n`;
                    if (dbContent.startsWith(citationPart)) {
                        dbContent = dbContent.slice(citationPart.length);
                    } else if (dbContent.startsWith(`> "${userMessage.citation}"`)) {
                        dbContent = dbContent.replace(`> "${userMessage.citation}"`, '').trim();
                    }
                }

                // Save messages SEQUENTIALLY to ensure correct ordering
                // User message first
                await db.chatMessage.create({
                    data: {
                        deckId,
                        role: 'user',
                        content: dbContent,
                        citation: userMessage.citation || null,
                    },
                });

                // Small delay to ensure distinct timestamps, then assistant message
                await db.chatMessage.create({
                    data: {
                        deckId,
                        role: 'assistant',
                        content: text,
                    },
                });
            }
        },
    });

    return result.toTextStreamResponse();
}
