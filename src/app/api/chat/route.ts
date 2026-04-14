import { z } from 'zod';
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimitFromRequest } from '@/lib/ratelimit';
import { checkFeatureLimit, incrementFeatureUsage } from '@/lib/featureLimits';
import { requireAuth } from '@/lib/auth';
import { checkCsrfOrigin } from '@/lib/csrf';
import { createLLMRouter } from '@/lib/llm/service';
import { validateTextSize, MAX_TEXT_SIZE } from '@/lib/input-validator';

export const maxDuration = 60;
// Node.js runtime required: uses Prisma via requireAuth/db
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    const csrfError = checkCsrfOrigin(req);
    if (csrfError) return csrfError;

    // 1. Authenticate user first
    const { user, errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    // Rate limit check
    const rateLimitResponse = await checkRateLimitFromRequest(req);
    if (rateLimitResponse) return rateLimitResponse;

    // Check chat usage limit (20/day for free, 100/day for students)
    const limitCheck = await checkFeatureLimit('chat');
    if (!limitCheck.allowed) {
        return limitCheck.errorResponse;
    }

    try {
        const body = await req.json();
        console.log('Chat API Request Body:', JSON.stringify(body, null, 2));

        const chatSchema = z.object({
            messages: z.array(z.any()), // AI SDK messages format
            context: z.string().max(50000).optional(),
            deckId: z.string().cuid().optional()
        }).strict();

        const payload = chatSchema.safeParse(body);

        if (!payload.success) {
            console.error('Chat API Validation Error:', payload.error.flatten());
            return NextResponse.json({
                error: 'Invalid request body',
                details: payload.error.flatten()
            }, { status: 400 });
        }

        const { messages, context, deckId } = payload.data;
        console.log('Chat API Request:', { messagesLength: messages?.length, contextLength: context?.length, deckId });

        // Validate text size for context
        if (context) {
            const contextValidation = validateTextSize(context, MAX_TEXT_SIZE);
            if (!contextValidation.valid) {
                return NextResponse.json({
                    error: contextValidation.error
                }, { status: 413 });
            }
        }

        // Validate text size for messages
        for (const message of messages) {
            if (message.content && typeof message.content === 'string') {
                const messageValidation = validateTextSize(message.content, MAX_TEXT_SIZE);
                if (!messageValidation.valid) {
                    return NextResponse.json({
                        error: messageValidation.error
                    }, { status: 413 });
                }
            }
        }

        if (deckId) {
            // Verify deck ownership
            const deck = await db.deck.findUnique({
                where: { id: deckId },
                select: { userId: true }
            });

            if (!deck) {
                return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
            }

            if (deck.userId !== user.id) {
                return NextResponse.json({ error: 'Unauthorized access to deck' }, { status: 403 });
            }
        }

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

        // Store userId for increment in onFinish
        const userId = limitCheck.user?.id;

        const systemPrompt = `You are Skoowl AI, a friendly study assistant. Help students understand their notes clearly and concisely.

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
`;

        // Initialize LLM Router with error handling
        try {
            const router = await createLLMRouter(30000);
            const result = await router.streamText({
                messages: allMessages,
                temperature: 0.4, // Slightly higher for conversational responses
                system: systemPrompt,
                feature: 'chat',
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

                        // Increment chat usage count
                        if (userId) {
                            await incrementFeatureUsage(userId, 'chat');
                        }
                    }
                },
            });

            // Convert router's streaming response to Vercel AI SDK format
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                async start(controller) {
                    try {
                        for await (const chunk of result.textStream) {
                            controller.enqueue(encoder.encode(chunk));
                        }
                        controller.close();
                    } catch (error) {
                        controller.error(error);
                    }
                },
            });

            return new Response(stream, {
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'X-Rate-Limit-Remaining': result.rateLimitInfo?.remaining.toString() || '0',
                    'X-Rate-Limit-Limit': result.rateLimitInfo?.limit.toString() || '0',
                    'X-Degraded-Mode': result.degradedMode ? 'true' : 'false',
                },
            });
        } catch (error) {
            console.error('Failed to load LLM configuration:', error);
            return NextResponse.json({
                error: 'LLM Configuration Error',
                details: error instanceof Error ? error.message : 'Failed to load LLM configuration'
            }, { status: 500 });
        }
    } catch (error) {
        const isProd = process.env.NODE_ENV === 'production';
        console.error('Chat API Error Details:', {
            name: (error as Error).name,
            message: (error as Error).message,
            stack: (error as Error).stack,
            cause: (error as Error).cause
        });

        return NextResponse.json({
            error: 'Internal Server Error',
            details: isProd ? 'An error occurred while processing your request.' : (error as Error).message
        }, { status: 500 });
    }
}
