import { NextRequest, NextResponse } from 'next/server';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { db } from '@/lib/db';
import { checkRateLimitFromRequest } from '@/lib/ratelimit';

// Configuration types
type QuizTimer = 'none' | '5' | '10' | '15';
type QuizType = 'multiple-choice' | 'true-false' | 'fill-in' | 'mixed';
type QuizDifficulty = 'basic' | 'intermediate' | 'advanced' | 'expert';
type QuizScope = 'summary' | 'granular' | 'full';

// Combined schema for quiz generation with hints
const quizSchema = z.object({
    questions: z.array(z.object({
        question: z.string().describe('The quiz question'),
        options: z.array(z.string()).describe('Answer options (4 for MC, 2 for T/F, empty for fill-in)'),
        answer: z.string().describe('The correct answer'),
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
3. Ensure all answers are correct and verifiable from the source
4. Match the difficulty level specified
5. For multiple-choice: make distractors plausible but clearly wrong
6. For true-false: include both true and false statements
7. For fill-in: the blank should be for a key term or concept, use _____ to show the blank

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

export async function POST(req: NextRequest) {
    // Rate limit check (uses User ID for authenticated users)
    const rateLimitResponse = await checkRateLimitFromRequest(req);
    if (rateLimitResponse) return rateLimitResponse;

    try {
        const body = await req.json();
        const { deckId, timer, type, difficulty, count } = body;

        if (!deckId) {
            return NextResponse.json({ error: 'deckId is required' }, { status: 400 });
        }

        // Get deck content
        const deck = await db.deck.findUnique({
            where: { id: deckId },
        });

        if (!deck) {
            return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
        }

        // Use summary or content for generation
        const sourceContent = deck.summary || deck.content;

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
        });

        // Delete existing quizzes for this deck first (fresh generation)
        await db.quiz.deleteMany({
            where: { deckId },
        });

        // Store generated quizzes in database WITH HINTS
        await db.quiz.createMany({
            data: object.questions.map((q) => ({
                deckId,
                question: q.question,
                options: JSON.stringify(q.options),
                answer: q.answer,
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

        return NextResponse.json({
            success: true,
            count: quizzes.length,
            quizzes: parsedQuizzes,
            timer: timer || 'none', // Return timer setting for UI
        });

    } catch (error) {
        console.error('Quiz generation error:', error);
        return NextResponse.json({
            error: 'Failed to generate quiz',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

// GET endpoint to fetch existing quizzes
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const deckId = searchParams.get('deckId');

        if (!deckId) {
            return NextResponse.json({ error: 'deckId is required' }, { status: 400 });
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
    try {
        const { searchParams } = new URL(req.url);
        const deckId = searchParams.get('deckId');

        if (!deckId) {
            return NextResponse.json({ error: 'deckId is required' }, { status: 400 });
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
