import React, { ReactNode, useEffect, useState } from 'react';
import { VocabProvider, useVocab } from '../store/VocabContext';
import { VocabCard, VocabCardStatus, VocabReviewBatchOptions } from '../types';
import { STATUS_OPTIONS } from '../constants';
import { Header } from "../../../common/Header";
import { BurgerButton } from "../../Layout/connected/BurgerButton";
import { PageShell } from "../../Layout/pure/PageShell";
import { PageFooterNav } from "../../Layout/pure/PageFooterNav";
import { PureVocabArena } from "../pure/Flashcard/PureVocabArena";
import { PureSessionSummary } from "../pure/Flashcard/PureSessionSummary";
import { PureVocabFilterBar } from "../pure/Flashcard/PureVocabFilterBar";
import { PureVocabEmptyState } from "../pure/Flashcard/PureVocabEmptyState";
import { FilterTag as VocabFilterTag } from "../pure/Flashcard/PureVocabFilterBar";
import { Stack } from "../../../common/Stack/Stack";
import {
  requireLearningUIDependency,
  useLearningUIConfig
} from '../../../system/LocaleContext';

export interface VocabPageProps {
  /** Pre-fetched cards to bypass the initial loading state */
  initialCards?: VocabCard[];
  /** Pre-fetched tags to render filters during SSR without a client loading pass */
  initialTags?: VocabFilterTag[];
  /** Initial review query used by SSR and subsequent client refetches */
  initialReviewOptions?: VocabReviewBatchOptions;
  /** The title of the vocabulary session */
  title: string;
  /** The label for the previous page button */
  prevLabel?: string;
  /** Callback fired when the previous button is clicked */
  onPrev?: () => void;
  /** The label for the next page button and the footer card */
  nextLabel?: string;
  /** Callback fired when the next button or footer card is clicked */
  onNext?: () => void;
  /** Callback fired when the session summary is completed */
  onFinish?: () => void;
  children: ReactNode;
}

/**
 * Internal content wrapper that consumes the VocabContext to drive the Header and layout.
 */
function VocabPageContent({
  title,
  prevLabel,
  onPrev,
  nextLabel,
  onNext,
  onFinish,
  availableTags = [],
  children
}: Omit<VocabPageProps, 'initialCards' | 'initialTags' | 'initialReviewOptions'> & { availableTags: VocabFilterTag[] }) {
  const { 
    isLoaded, 
    queue, 
    currentIndex, 
    history, 
    ratings, 
    startTime, 
    endTime,
    activeTags,
    setActiveTags,
    searchQuery,
    setSearchQuery,
    activeStatuses,
    setActiveStatuses
  } = useVocab();

  const total = queue.length;
  const done = Math.min(currentIndex, total);

  // Separate the PureVocabArena from other content (like PageIntro) so we can swap it out
  // while keeping the rest of the page layout intact.
  const childrenArray = React.Children.toArray(children);
  const arena = childrenArray.find(child => React.isValidElement(child) && child.type === PureVocabArena);
  const otherChildren = childrenArray.filter(child => child !== arena);

  const activeTagObjects = availableTags.filter(t => activeTags.includes(t.id));

  const filtersNode = (
    <PureVocabFilterBar
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="Search practice cards..."
      availableTags={availableTags}
      activeTags={activeTags}
      onTagsChange={setActiveTags}
      availableStatuses={STATUS_OPTIONS}
      activeStatuses={activeStatuses}
      onStatusesChange={(statuses) => setActiveStatuses(statuses as VocabCardStatus[])}
    />
  );

  const hasFilters = activeTags.length > 0 || searchQuery !== '' || activeStatuses.length > 0;
  const handleClearFilters = () => {
    setActiveTags([]);
    setSearchQuery('');
    setActiveStatuses([]);
  };

  let contentNode: ReactNode;

  if (!isLoaded) {
    contentNode = (
      <Stack gap={6}>
        {otherChildren}
        {filtersNode}
        <PureVocabArena.Skeleton />
      </Stack>
    );
  } else if (queue.length === 0) {
    contentNode = (
      <Stack gap={6}>
        {otherChildren}
        {filtersNode}
        <PureVocabEmptyState 
          activeTags={activeTagObjects}
          onClearFilters={hasFilters ? handleClearFilters : undefined}
        />
      </Stack>
    );
  } else if (currentIndex >= queue.length) {
    // Calculate Analytics
    const totalAttempts = ratings.again + ratings.hard + ratings.good + ratings.easy;
    const correct = ratings.good + ratings.easy;
    const accuracy = totalAttempts > 0 ? Math.round((correct / totalAttempts) * 100) : 0;
    
    const finalEndTime = endTime || Date.now();
    const seconds = Math.floor((finalEndTime - startTime) / 1000);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    const timeSpent = `${m}:${s.toString().padStart(2, '0')}`;

    contentNode = (
      <Stack gap={6}>
        {otherChildren}
        <PureSessionSummary 
          title="Review Complete"
          cardsReviewed={history.length} 
          accuracy={accuracy}
          timeSpent={timeSpent}
          onFinish={onFinish || onNext || (() => window.history.back())} 
          stepNumber={1}
          activeTags={activeTagObjects}
        />
      </Stack>
    );
  } else {
    contentNode = (
      <Stack gap={6}>
        {otherChildren}
        {filtersNode}
        {arena}
      </Stack>
    );
  }

  return (
    <PageShell
      header={
        <Header>
          <Header.Left>
            <BurgerButton />
            {onPrev && (
              <Header.NavButton direction="prev" label={prevLabel} onClick={onPrev} />
            )}
          </Header.Left>
          <Header.Center>
            <Header.Title title={title}>
              <Header.Progress value={done} max={total} label="Cards" />
            </Header.Title>
          </Header.Center>
          <Header.Right>
            {onNext && (
              <Header.NavButton direction="next" label={nextLabel} onClick={onNext} />
            )}
          </Header.Right>
        </Header>
      }
      footer={
        onNext && nextLabel ? (
          <PageFooterNav>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onNext();
              }}
              style={{ textDecoration: 'none', display: 'contents' }}
            >
              <PageFooterNav.Card title={nextLabel} />
            </a>
          </PageFooterNav>
        ) : undefined
      }
    >
      {contentNode}
    </PageShell>
  );
}

/**
 * The root provider and layout wrapper for a Vocabulary Review Page.
 * Initializes the SRS state engine and provides context to all child components.
 */
export function VocabPage({
  initialCards,
  initialTags,
  initialReviewOptions,
  title,
  prevLabel,
  onPrev,
  nextLabel,
  onNext,
  onFinish,
  children
}: VocabPageProps) {
  const learningUI = useLearningUIConfig();
  const resolvedBackend = requireLearningUIDependency(
    learningUI.adapters?.vocab,
    'VocabPage backend'
  );
  const resolvedCardRegistry = requireLearningUIDependency(
    learningUI.plugins?.vocabCards,
    'VocabPage cardRegistry'
  );
  const [availableTags, setAvailableTags] = useState<VocabFilterTag[]>(initialTags || []);

  useEffect(() => {
    if (initialTags) return;

    resolvedBackend.fetchAvailableTags()
      .then(setAvailableTags)
      .catch(err => console.error("Failed to fetch available tags", err));
  }, [resolvedBackend, initialTags]);

  return (
    <VocabProvider
      backend={resolvedBackend}
      cardRegistry={resolvedCardRegistry}
      initialCards={initialCards}
      initialReviewOptions={initialReviewOptions}
    >
      <VocabPageContent
        title={title}
        prevLabel={prevLabel}
        onPrev={onPrev}
        nextLabel={nextLabel}
        onNext={onNext}
        onFinish={onFinish}
        availableTags={availableTags}
      >
        {children}
      </VocabPageContent>
    </VocabProvider>
  );
}
