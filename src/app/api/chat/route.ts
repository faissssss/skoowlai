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

Guidelines:
- Be conversational and encouraging
- Keep explanations clear and easy to understand
- Use bullet points when listing multiple items
- Only use bold for truly important terms, not every concept
- Use analogies when explaining complex topics
- Keep paragraphs short (2-3 sentences max)

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

                await db.chatMessage.createMany({
                    data: [
                        {
                            deckId,
                            role: 'user',
                            content: dbContent, // Save clean content
                            citation: userMessage.citation || null,
                        },
                        {
                            deckId,
                            role: 'assistant',
                            content: text,
                        },
                    ],
                });
            }
        },
    });

    return result.toTextStreamResponse();
}
