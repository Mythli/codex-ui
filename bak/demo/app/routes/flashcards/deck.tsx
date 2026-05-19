import { createFileRoute } from '@tanstack/react-router';
import type { VocabCard, VocabTag } from '@taylordb/learning-ui';
import { VocabDeckPage } from '../../features/vocab/VocabDeckPage';
import { fetchAllVocabCardsFn, fetchVocabTagsFn } from '../../features/vocab/server-fns';

export const Route = createFileRoute('/flashcards/deck')({
  staticData: {
    moduleId: 'flashcards',
    moduleName: 'Flashcards',
    moduleOrder: 1,
    title: 'Manage Deck',
    order: 1,
    icon: '🃏',
  },
  component: DeckRoute,
  loader: async () => {
    const [cards, tags] = await Promise.all([
      fetchAllVocabCardsFn(),
      fetchVocabTagsFn(),
    ]);

    return {
      cards: cards || [],
      tags: tags || [],
    };
  },
});

function DeckRoute() {
  const loaderData = Route.useLoaderData() as {
    cards: VocabCard[];
    tags: VocabTag[];
  };

  return (
    <VocabDeckPage
      initialCards={loaderData.cards}
      initialTags={loaderData.tags}
    />
  );
}
