import { createServerFn } from '@tanstack/react-start';
import type { VocabCard, VocabTag } from '@taylordb/learning-ui';

type ReviewSearch = Record<string, string | undefined>;

export const fetchReviewBatchFn = createServerFn({ method: 'GET', strict: false })
  .inputValidator((search: ReviewSearch) => search)
  .handler(async ({ data }) => {
    const { getDependencies } = await import('../../../api/core/dependencies');
    const { srsService } = getDependencies();

    const cardIds = data.cards ? data.cards.split(',').filter(Boolean) : undefined;
    const cards = await srsService.getReviewBatch({}, { cardIds }, 20);

    return cards as VocabCard[];
  });

export const fetchAllVocabCardsFn = createServerFn({ method: 'GET', strict: false })
  .handler(async () => {
    const { getDependencies } = await import('../../../api/core/dependencies');
    const { srsService } = getDependencies();
    const cards = await srsService.getAllCards({});

    return cards as VocabCard[];
  });

export const fetchVocabCardsBySourceIdsFn = createServerFn({ method: 'GET', strict: false })
  .inputValidator((sourceIds: string[]) => sourceIds)
  .handler(async ({ data }) => {
    const { getDependencies } = await import('../../../api/core/dependencies');
    const { srsService } = getDependencies();
    const cards = await srsService.getCardsBySourceIds({}, data);

    return cards as VocabCard[];
  });

export const fetchVocabTagsFn = createServerFn({ method: 'GET', strict: false })
  .handler(async () => {
    const { getDependencies } = await import('../../../api/core/dependencies');
    const { srsService } = getDependencies();
    const tags = await srsService.getAvailableTags({});

    return tags.map((tag: string): VocabTag => ({ id: tag, label: tag }));
  });
