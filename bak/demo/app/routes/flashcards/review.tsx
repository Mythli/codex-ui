import { createFileRoute } from '@tanstack/react-router';
import type { VocabCard, VocabReviewBatchOptions, VocabTag } from '@taylordb/learning-ui';
import { VocabReviewPage } from '../../features/vocab/VocabReviewPage';
import { fetchReviewBatchFn, fetchVocabTagsFn } from '../../features/vocab/server-fns';

export const Route = createFileRoute('/flashcards/review')({
  staticData: {
    moduleId: 'flashcards',
    moduleName: 'Flashcards',
    moduleOrder: 1,
    title: 'Review',
    order: 2,
    icon: '🃏',
  },
  component: VocabReview,
  loader: async ({ location }) => {
    const search = location.search as Record<string, string>;
    const [cards, tags] = await Promise.all([
      fetchReviewBatchFn({ data: search }),
      fetchVocabTagsFn(),
    ]);

    return {
      cards: cards || [],
      tags: tags || [],
      reviewOptions: {
        cardIds: search.cards ? search.cards.split(',').filter(Boolean) : undefined,
      },
    };
  }
});

function VocabReview() {
  const loaderData = Route.useLoaderData() as {
    cards: VocabCard[];
    tags: VocabTag[];
    reviewOptions?: VocabReviewBatchOptions;
  };

  return (
    <VocabReviewPage
      initialCards={loaderData.cards}
      initialTags={loaderData.tags}
      initialReviewOptions={loaderData.reviewOptions}
    />
  );
}
