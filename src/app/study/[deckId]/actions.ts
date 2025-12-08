'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

// ============ FLASHCARD ACTIONS ============

export async function updateFlashcard(cardId: string, front: string, back: string) {
    try {
        await db.card.update({
            where: { id: cardId },
            data: { front, back },
        });
        return { success: true };
    } catch (error) {
        console.error('Failed to update flashcard:', error);
        return { success: false, error: 'Failed to update flashcard' };
    }
}

export async function deleteFlashcard(cardId: string, deckId: string) {
    try {
        await db.card.delete({
            where: { id: cardId },
        });
        revalidatePath(`/study/${deckId}/flashcards`);
        return { success: true };
    } catch (error) {
        console.error('Failed to delete flashcard:', error);
        return { success: false, error: 'Failed to delete flashcard' };
    }
}

export async function createFlashcard(deckId: string, front: string, back: string) {
    try {
        const card = await db.card.create({
            data: { deckId, front, back },
        });
        revalidatePath(`/study/${deckId}/flashcards`);
        return { success: true, card };
    } catch (error) {
        console.error('Failed to create flashcard:', error);
        return { success: false, error: 'Failed to create flashcard' };
    }
}

export async function saveAllFlashcards(
    deckId: string,
    cards: Array<{ id?: string; front: string; back: string; isNew?: boolean; isDeleted?: boolean }>
) {
    try {
        // Process deletions
        const deletedCards = cards.filter(c => c.isDeleted && c.id);
        for (const card of deletedCards) {
            await db.card.delete({ where: { id: card.id } });
        }

        // Process updates and creates
        const activeCards = cards.filter(c => !c.isDeleted);
        for (const card of activeCards) {
            if (card.isNew || !card.id) {
                await db.card.create({
                    data: { deckId, front: card.front, back: card.back },
                });
            } else {
                await db.card.update({
                    where: { id: card.id },
                    data: { front: card.front, back: card.back },
                });
            }
        }

        revalidatePath(`/study/${deckId}/flashcards`);
        return { success: true };
    } catch (error) {
        console.error('Failed to save flashcards:', error);
        return { success: false, error: 'Failed to save flashcards' };
    }
}

// ============ QUIZ ACTIONS ============

export async function updateQuiz(
    quizId: string,
    question: string,
    options: string[],
    answer: string,
    hint?: string
) {
    try {
        await db.quiz.update({
            where: { id: quizId },
            data: {
                question,
                options: JSON.stringify(options),
                answer,
                hint: hint || null,
            },
        });
        return { success: true };
    } catch (error) {
        console.error('Failed to update quiz:', error);
        return { success: false, error: 'Failed to update quiz' };
    }
}

export async function deleteQuiz(quizId: string, deckId: string) {
    try {
        await db.quiz.delete({
            where: { id: quizId },
        });
        revalidatePath(`/study/${deckId}/quiz`);
        return { success: true };
    } catch (error) {
        console.error('Failed to delete quiz:', error);
        return { success: false, error: 'Failed to delete quiz' };
    }
}

export async function createQuiz(
    deckId: string,
    question: string,
    options: string[],
    answer: string,
    hint?: string
) {
    try {
        const quiz = await db.quiz.create({
            data: {
                deckId,
                question,
                options: JSON.stringify(options),
                answer,
                hint: hint || null,
            },
        });
        revalidatePath(`/study/${deckId}/quiz`);
        return { success: true, quiz };
    } catch (error) {
        console.error('Failed to create quiz:', error);
        return { success: false, error: 'Failed to create quiz' };
    }
}

export async function saveAllQuizzes(
    deckId: string,
    quizzes: Array<{
        id?: string;
        question: string;
        options: string[];
        answer: string;
        hint?: string;
        isNew?: boolean;
        isDeleted?: boolean;
    }>
) {
    try {
        // Process deletions
        const deletedQuizzes = quizzes.filter(q => q.isDeleted && q.id);
        for (const quiz of deletedQuizzes) {
            await db.quiz.delete({ where: { id: quiz.id } });
        }

        // Process updates and creates
        const activeQuizzes = quizzes.filter(q => !q.isDeleted);
        for (const quiz of activeQuizzes) {
            if (quiz.isNew || !quiz.id) {
                await db.quiz.create({
                    data: {
                        deckId,
                        question: quiz.question,
                        options: JSON.stringify(quiz.options),
                        answer: quiz.answer,
                        hint: quiz.hint || null,
                    },
                });
            } else {
                await db.quiz.update({
                    where: { id: quiz.id },
                    data: {
                        question: quiz.question,
                        options: JSON.stringify(quiz.options),
                        answer: quiz.answer,
                        hint: quiz.hint || null,
                    },
                });
            }
        }

        revalidatePath(`/study/${deckId}/quiz`);
        return { success: true };
    } catch (error) {
        console.error('Failed to save quizzes:', error);
        return { success: false, error: 'Failed to save quizzes' };
    }
}
