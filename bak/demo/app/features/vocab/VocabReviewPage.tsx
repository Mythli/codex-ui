import React from 'react';
import {
  VocabPage,
  PageIntro,
  PureVocabArena,
  Conveyor,
  ReviewControls,
  type VocabCard,
  type VocabReviewBatchOptions,
  type VocabTag,
} from '@taylordb/learning-ui';
import { useModuleNavigation } from '../../core/navigation';

interface VocabReviewPageProps {
  initialCards: VocabCard[];
  initialTags: VocabTag[];
  initialReviewOptions?: VocabReviewBatchOptions;
}

export function VocabReviewPage({
  initialCards,
  initialTags,
  initialReviewOptions,
}: VocabReviewPageProps) {
  const navProps = useModuleNavigation();

  return (
    <VocabPage
      initialCards={initialCards}
      initialTags={initialTags}
      initialReviewOptions={initialReviewOptions}
      title="Vocabulary Review"
      {...navProps}
    >
      <PageIntro>
        <PageIntro.Title>Flashcards</PageIntro.Title>
        <PageIntro.Description>
          <p>
            Review your spaced repetition flashcards to strengthen your memory. Be honest with your
            ratings to optimize your learning schedule.
          </p>
        </PageIntro.Description>
      </PageIntro>

      <PureVocabArena>
        <Conveyor />
        <ReviewControls />
      </PureVocabArena>
    </VocabPage>
  );
}
