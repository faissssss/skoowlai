import { NextRequest, NextResponse } from 'next/server';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { db } from '@/lib/db';
import { checkRateLimitFromRequest } from '@/lib/ratelimit';
import { checkFeatureLimit, incrementFeatureUsage } from '@/lib/featureLimits';
import { requireAuth } from '@/lib/auth';
import { checkCsrfOrigin } from '@/lib/csrf';

// Schema for flashcards
const flashcardsSchema = z.object({
    flashcards: z.array(z.object({
        front: z.string().describe('The front of the flashcard (term/question/scenario).'),
        back: z.string().describe('The back of the flashcard (definition/answer/solution).'),
    })).describe('A list of 10 flashcards generated from the content.'),
});

// Configuration types
type FlashcardFocus = 'terms' | 'concepts' | 'data' | 'mix';
type FlashcardFormat = 'classic' | 'qa' | 'practical';
type FlashcardDetail = 'brief' | 'standard' | 'detailed';

export const maxDuration = 60;
// Node.js runtime required: uses Prisma via requireAuth/db
export const runtime = 'nodejs';

function buildFlashcardPrompt(
    content: string,
    focus: FlashcardFocus,
    format: FlashcardFormat,
    detail: FlashcardDetail,
    count: number
): string {
    const focusInstructions = {
        terms: 'Focus on terminology, definitions, jargon, and key vocabulary. Extract specific terms and their precise meanings.',
        concepts: 'Focus on main theories, core ideas, principles, and "how things work" explanations.',
        data: 'Focus on specific dates, formulas, statistics, numbers, and factual data points.',
        mix: 'Create a balanced mix of terms, concepts, and data for comprehensive coverage.',
    };

    const formatInstructions = {
        classic: 'Front: Term or key phrase. Back: Clear definition or explanation.',
        qa: 'Front: A question about the content. Back: The answer to that question.',
        practical: 'Front: A real-world scenario, problem, or application. Back: The solution or approach.',
    };

    const detailInstructions = {
        brief: 'Keep answers very concise - keywords and short phrases only. Maximum 10 words per side.',
        standard: 'Provide one clear, complete sentence for each side. Enough context to understand.',
        detailed: 'Include context, bullet points if needed, and examples. Comprehensive explanations.',
    };

    // Generate a random seed to ensure variety
    const randomSeed = Math.random().toString(36).substring(2, 10);

    return `You are an expert flashcard creator. Generate exactly ${count} high-quality flashcards based on the provided content.

**RANDOMNESS SEED: ${randomSeed}** - Use this to ensure you create COMPLETELY DIFFERENT flashcards each time. Do NOT reuse or repeat cards from previous generations.

**CONFIGURATION:**
- **Focus**: ${focusInstructions[focus]}
- **Format**: ${formatInstructions[format]}
- **Detail Level**: ${detailInstructions[detail]}

**REQUIREMENTS:**
1. Create exactly ${count} flashcards
2. Each flashcard should be distinct and cover different aspects
3. Make the content memorable and study-effective
4. Ensure accuracy based on the source material
5. Follow the format and detail level strictly
6. **IMPORTANT: Generate FRESH, UNIQUE flashcards every time. Vary the topics, phrasing, and aspects covered.**

**CONTENT TO CREATE FLASHCARDS FROM:**
${content.slice(0, 25000)}

Generate ${count} UNIQUE flashcards now.`;
}

export async function POST(req: NextRequest) {
    const csrfError = checkCsrfOrigin(req);
    if (csrfError) return csrfError;

    // 1. Authenticate user first
    const { user, errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    // Rate limit check
    const rateLimitResponse = await checkRateLimitFromRequest(req);
    if (rateLimitResponse) return rateLimitResponse;

    // Check feature usage limit
    const limitCheck = await checkFeatureLimit('flashcard');
    if (!limitCheck.allowed) {
        return limitCheck.errorResponse;
    }

    try {
        const body = await req.json();

        // Strict input validation
        const generateFlashcardsSchema = z.object({
            deckId: z.string(), // IDs are CUIDs, not UUIDs
            count: z.number().int().min(1).max(50).default(10),
            focus: z.enum(['terms', 'concepts', 'data', 'mix']).default('mix'),
            format: z.enum(['classic', 'qa', 'practical']).default('classic'),
            detail: z.enum(['brief', 'standard', 'detailed']).default('standard')
        }).strict();

        const payload = generateFlashcardsSchema.safeParse(body);

        if (!payload.success) {
            return NextResponse.json({
                error: 'Invalid request body',
                details: payload.error.flatten()
            }, { status: 400 });
        }

        const { deckId, focus, format, detail, count } = payload.data;

        if (!deckId) {
            return NextResponse.json({ error: 'deckId is required' }, { status: 400 });
        }

        // Verify deck ownership (Authorization)
        const deck = await db.deck.findUnique({
            where: { id: deckId },
        });

        if (!deck) {
            return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
        }

        if (deck.userId !== user.id) {
            return NextResponse.json({ error: 'Unauthorized access to deck' }, { status: 403 });
        }

        // Use summary or content for generation
        const sourceContent = deck.summary || deck.content;

        // Build prompt with configuration
        const finalCount = Math.min(Math.max(count || 10, 1), 50); // Clamp between 1-50
        const prompt = buildFlashcardPrompt(
            sourceContent,
            focus || 'mix',
            format || 'classic',
            detail || 'standard',
            finalCount
        );

        // Generate flashcards
        const { object } = await generateObject({
            model: google('gemini-2.5-flash'),
            schema: flashcardsSchema,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.4, // Balanced creativity for varied flashcards
        });

        // Delete existing cards for this deck first (fresh generation)
        await db.card.deleteMany({
            where: { deckId },
        });

        // Store generated flashcards in database
        const createdCards = await db.card.createMany({
            data: object.flashcards.map((card) => ({
                deckId,
                front: card.front,
                back: card.back,
            })),
        });

        // Fetch the created cards to return
        const cards = await db.card.findMany({
            where: { deckId },
        });

        // Increment usage count after successful generation
        if (limitCheck.user) {
            await incrementFeatureUsage(limitCheck.user.id, 'flashcard');
        }

        return NextResponse.json({
            success: true,
            count: cards.length,
            cards
        });

    } catch (error) {
        // Enhanced error logging for debugging
        console.error('Flashcard generation error:', error);

        // Log specific Google API error if available
        if (error instanceof Error) {
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }

        // Generic error message for client, detailed log for server
        return NextResponse.json({
            error: 'Internal Server Error',
            details: 'Failed to generate flashcards. Please try again later.',
            // Include error message in development for easier debugging
            ...(process.env.NODE_ENV === 'development' && { debug: error instanceof Error ? error.message : String(error) })
        }, { status: 500 });
    }
}

// GET endpoint to fetch existing flashcards
export async function GET(req: NextRequest) {
    // Authenticate user
    const { user, errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    try {
        const { searchParams } = new URL(req.url);
        const deckId = searchParams.get('deckId');

        if (!deckId) {
            return NextResponse.json({ error: 'deckId is required' }, { status: 400 });
        }

        // Verify deck ownership before fetching cards
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

        const cards = await db.card.findMany({
            where: { deckId },
        });

        return NextResponse.json({ cards });

    } catch (error) {
        console.error('Flashcard fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch flashcards' }, { status: 500 });
    }
}

// DELETE endpoint to clear flashcards
export async function DELETE(req: NextRequest) {
    const csrfError = checkCsrfOrigin(req);
    if (csrfError) return csrfError;

    // Authenticate user
    const { user, errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    try {
        const { searchParams } = new URL(req.url);
        const deckId = searchParams.get('deckId');

        if (!deckId) {
            return NextResponse.json({ error: 'deckId is required' }, { status: 400 });
        }

        // Verify deck ownership before deleting
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

        await db.card.deleteMany({
            where: { deckId },
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Flashcard delete error:', error);
        return NextResponse.json({ error: 'Failed to delete flashcards' }, { status: 500 });
    }
}
