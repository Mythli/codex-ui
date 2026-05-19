import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { VocabManagementPage, type VocabCard, type VocabTag } from '@taylordb/learning-ui';
import { useModuleNavigation } from '../../core/navigation';

interface VocabDeckPageProps {
  initialCards: VocabCard[];
  initialTags: VocabTag[];
}

export function VocabDeckPage({ initialCards, initialTags }: VocabDeckPageProps) {
  const navProps = useModuleNavigation();
  const navigate = useNavigate();

  return (
    <VocabManagementPage
      title="Manage Deck"
      initialCards={initialCards}
      initialTags={initialTags}
      onNavigateToReview={(ids) => {
        navigate({ to: '/flashcards/review', search: { cards: ids.join(',') } as any });
      }}
      {...navProps}
    />
  );
}
