import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { db } from '@/lib/db';
import { checkRateLimitFromRequest } from '@/lib/ratelimit';
import { checkFeatureLimit, incrementFeatureUsage } from '@/lib/featureLimits';

// Configuration types
type QuizTimer = 'none' | '5' | '10' | '15';
type QuizType = 'multiple-choice' | 'true-false' | 'fill-in' | 'mixed';
type QuizDifficulty = 'basic' | 'intermediate' | 'advanced' | 'expert';
type QuizScope = 'summary' | 'granular' | 'full';

export const maxDuration = 60;
export const runtime = 'edge'; // Use Edge runtime for faster cold starts

// Combined schema for quiz generation with hints
// IMPORTANT: answer.min(1) ensures answers are NEVER empty
const quizSchema = z.object({
    questions: z.array(z.object({
        question: z.string().min(1).describe('The quiz question'),
        options: z.array(z.string()).describe('Answer options (4 for MC, 2 for T/F, empty for fill-in)'),
        answer: z.string().min(1).describe('The correct answer - MUST be non-empty'),
        type: z.string().describe('Question type: multiple-choice, true-false, or fill-in'),
        hint: z.string().describe('A helpful hint that guides the student toward the answer without giving it away'),
    })).describe('A list of quiz questions with hints'),
});

function buildQuizPrompt(
    content: string,
    type: QuizType,
    difficulty: QuizDifficulty,
    count: number
): string {
    const typeInstructions = {
        'multiple-choice': 'Create multiple choice questions with exactly 4 options (A, B, C, D). One correct, three plausible distractors. Set type to "multiple-choice".',
        'true-false': 'Create true/false statements. Options should be ["True", "False"]. Answer is either "True" or "False". Set type to "true-false".',
        'fill-in': 'Create fill-in-the-blank questions. Leave options as empty array []. The answer is the word/phrase that fills the blank. Use _____ in the question for the blank. Set type to "fill-in".',
        'mixed': 'Create a mix of question types: some multiple-choice (4 options), some true/false (2 options), some fill-in (empty options). Vary the types.',
    };

    const difficultyInstructions = {
        basic: 'Direct recall questions like "What is X?" or "Define Y". Simple factual answers.',
        intermediate: 'Understanding questions like "Why did X happen?" or "Explain the relationship between X and Y".',
        advanced: 'Application questions like "How would you solve this using X?" or "Apply this concept to...".',
        expert: 'Complex analysis, edge cases, critical thinking. "Compare and contrast", "What would happen if...".',
    };

    // Generate a random seed to ensure variety
    const randomSeed = Math.random().toString(36).substring(2, 10);

    return `You are an expert quiz creator. Generate exactly ${count} high-quality quiz questions based on the provided content.

**RANDOMNESS SEED: ${randomSeed}** - Use this to ensure you create COMPLETELY DIFFERENT questions each time.

**CONFIGURATION:**
- **Question Type**: ${typeInstructions[type]}
- **Difficulty Level**: ${difficultyInstructions[difficulty]}

**REQUIREMENTS:**
1. Create exactly ${count} questions
2. Each question should test a different aspect of the content
3. **CRITICAL: EVERY question MUST have a valid, non-empty 'answer' field - this is MANDATORY**
4. Ensure all answers are correct and verifiable from the source
5. Match the difficulty level specified
6. For multiple-choice: make distractors plausible but clearly wrong. The 'answer' must be one of the options EXACTLY.
7. For true-false: include both true and false statements. The 'answer' must be exactly "True" or "False".
8. For fill-in: the blank should be for a key term or concept, use _____ to show the blank. The 'answer' must be the word/phrase that fills the blank.

**HINT REQUIREMENTS:**
- Each question MUST have a helpful hint
- Hints should guide students toward the answer without giving it away directly
- Good hints: "Think about what happens during photosynthesis...", "Consider the time period when this occurred..."
- Bad hints: "The answer is 'mitochondria'" (too direct)
- Hints should be 1-2 sentences maximum

**CONTENT TO CREATE QUIZ FROM:**
${content.slice(0, 25000)}

Generate ${count} UNIQUE quiz questions with helpful hints now.`;
}

// ... imports ...

export async function POST(req: NextRequest) {
    // 1. Authenticate user first
    const { user, errorResponse } = await requireAuth();
    if (errorResponse) return errorResponse;

    // Rate limit check
    const rateLimitResponse = await checkRateLimitFromRequest(req);
    if (rateLimitResponse) return rateLimitResponse;

    // Check feature usage limit
    const limitCheck = await checkFeatureLimit('quiz');
    if (!limitCheck.allowed) {
        return limitCheck.errorResponse;
    }

    try {
        const body = await req.json();

        // Strict input validation
        const generateQuizSchema = z.object({
            deckId: z.string(), // IDs are CUIDs from Prisma
            count: z.number().int().min(1).max(50).default(10),
            type: z.enum(['multiple-choice', 'true-false', 'fill-in', 'mixed']).default('multiple-choice'),
            difficulty: z.enum(['basic', 'intermediate', 'advanced', 'expert']).default('basic'),
            timer: z.enum(['none', '5', '10', '15']).default('none')
        }).strict();

        const payload = generateQuizSchema.safeParse(body);

        if (!payload.success) {
            return NextResponse.json({
                error: 'Invalid request body',
                details: payload.error.flatten()
            }, { status: 400 });
        }

        const { deckId, timer, type, difficulty, count } = payload.data;

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

        // ... rest of generation logic ...
        // Build prompt with configuration
        const finalCount = Math.min(Math.max(count || 10, 1), 50); // Clamp between 1-50
        const prompt = buildQuizPrompt(
            sourceContent,
            type || 'multiple-choice',
            difficulty || 'basic',
            finalCount
        );

        // Generate quiz questions
        const { object } = await generateObject({
            model: google('gemini-2.5-flash'),
            schema: quizSchema,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3, // Lower for consistent, accurate quiz questions
        });

        // Delete existing quizzes for this deck first (fresh generation)
        await db.quiz.deleteMany({
            where: { deckId },
        });

        // CRITICAL: Filter out any questions without valid answers
        // This ensures "No answer set" is IMPOSSIBLE
        const validQuestions = object.questions.filter(q => {
            const hasAnswer = q.answer && q.answer.trim().length > 0;
            if (!hasAnswer) {
                console.warn('Filtered out question without answer:', q.question);
            }
            return hasAnswer;
        });

        if (validQuestions.length === 0) {
            return NextResponse.json({
                error: 'Failed to generate quiz: No valid questions with answers were created',
            }, { status: 500 });
        }

        // Store generated quizzes in database WITH HINTS
        await db.quiz.createMany({
            data: validQuestions.map((q) => ({
                deckId,
                question: q.question,
                options: JSON.stringify(q.options),
                answer: q.answer.trim(), // Ensure trimmed answer
                hint: q.hint || null, // Store the generated hint
            })),
        });

        // Fetch the created quizzes to return
        const quizzes = await db.quiz.findMany({
            where: { deckId },
        });

        // Parse options back to arrays for response
        const parsedQuizzes = quizzes.map(q => ({
            id: q.id,
            question: q.question,
            options: JSON.parse(q.options) as string[],
            answer: q.answer,
            hint: q.hint || undefined, // Include hint in response
        }));

        // Increment usage count after successful generation
        if (limitCheck.user) {
            await incrementFeatureUsage(limitCheck.user.id, 'quiz');
        }

        return NextResponse.json({
            success: true,
            count: quizzes.length,
            quizzes: parsedQuizzes,
            timer: timer || 'none', // Return timer setting for UI
        });

    } catch (error) {
        console.error('Quiz generation error:', error);
        // Generic error message for client, detailed log for server
        return NextResponse.json({
            error: 'Internal Server Error',
            details: 'Failed to generate quiz. Please try again later.'
        }, { status: 500 });
    }
}

// GET endpoint to fetch existing quizzes
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

        // Verify deck ownership before fetching quizzes
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

        const quizzes = await db.quiz.findMany({
            where: { deckId },
        });

        // Parse options back to arrays and include hints
        const parsedQuizzes = quizzes.map(q => ({
            id: q.id,
            question: q.question,
            options: JSON.parse(q.options) as string[],
            answer: q.answer,
            hint: q.hint || undefined, // Include hint in response
        }));

        return NextResponse.json({ quizzes: parsedQuizzes });

    } catch (error) {
        console.error('Quiz fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch quizzes' }, { status: 500 });
    }
}

// DELETE endpoint to clear quizzes
export async function DELETE(req: NextRequest) {
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

        await db.quiz.deleteMany({
            where: { deckId },
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Quiz delete error:', error);
        return NextResponse.json({ error: 'Failed to delete quizzes' }, { status: 500 });
    }
}
