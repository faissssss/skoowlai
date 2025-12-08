import { redirect } from 'next/navigation';

export default async function StudyPage({ params }: { params: Promise<{ deckId: string }> }) {
    const { deckId } = await params;
    redirect(`/study/${deckId}/notes`);
}
