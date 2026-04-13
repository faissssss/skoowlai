import { db, withRetry } from '@/lib/db';
import { notFound } from 'next/navigation';
import ClientQuiz from './ClientQuiz';

export default async function QuizPage({ params }: { params: Promise<{ deckId: string }> }) {
    const { deckId } = await params;
    const deck = await withRetry(() => db.deck.findUnique({
        where: { id: deckId },
        include: { quizzes: true },
    }));

    if (!deck) {
        notFound();
    }

    // Parse options JSON for initial quizzes
    const quizzes = deck.quizzes.map((q: any) => ({
        id: q.id,
        question: q.question,
        options: JSON.parse(q.options) as string[],
        answer: q.answer,
        hint: q.hint || undefined,
    }));

    return (
        <div className="max-w-3xl mx-auto">
            <ClientQuiz deckId={deckId} initialQuizzes={quizzes} />
        </div>
    );
}
