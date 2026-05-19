import { ReactNode } from 'react';
import { BadgeColor } from '../../common/Badge/PureBadge';

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';
export type VocabCardStatus = 'new' | 'learning' | 'due' | 'mastered';
export type VocabCardState = 0 | 1 | 2 | 3 | number;

export interface VocabTag {
  id: string;
  label: string;
  color?: BadgeColor;
}

export interface VocabReviewBatchOptions {
  tags?: string[];
  search?: string;
  statuses?: VocabCardStatus[];
  cardIds?: string[];
}

/**
 * A strict mapping of plugin IDs to their exact payload shapes.
 * This enables perfect type inference across the entire Flashcard feature.
 * 
 * Consumers can inject their own custom plugins into this registry using Module Augmentation:
 * 
 * declare module '@taylordb/learning-ui' {
 *   interface FlashcardPluginRegistry {
 *     'my-custom-card': MyCustomPayloadType;
 *   }
 * }
 */
export interface FlashcardPluginRegistry {
  'markdown': { type: 'markdown'; front: string; back: string };
}

/**
 * A card shape aligned with backend SRS cards by structure, without importing backend types.
 * Plugin type is carried by the payload so backend/API/UI can pass the same card object end to end.
 */
export type VocabCard<T extends keyof FlashcardPluginRegistry = keyof FlashcardPluginRegistry> = {
  [K in T]: {
    id: string;
    /** A deterministic ID linking this card to its source (e.g., a lesson item ID) */
    sourceId: string;
    /** The plugin-specific payload. It carries its own `type` discriminator. */
    payload: FlashcardPluginRegistry[K];
    /** Tags associated with this card */
    tags: string[];
    /** Hidden cards are excluded from review queues. */
    suspended?: boolean;

    /** SRS scheduling fields mirrored from backend cards when available. */
    state?: VocabCardState;
    due?: Date | string;
    stability?: number;
    difficulty?: number;
    elapsed_days?: number;
    scheduled_days?: number;
    reps?: number;
    lapses?: number;
    last_review?: Date | string;

    // Legacy fields for backward compatibility during migration
    frontMarkdown?: string;
    backMarkdown?: string;
  }
}[T];

export interface CardEditorProps<K extends keyof FlashcardPluginRegistry = keyof FlashcardPluginRegistry> {
  payload: FlashcardPluginRegistry[K];
  onChange: (payload: FlashcardPluginRegistry[K]) => void;
}

export interface CardRenderProps<K extends keyof FlashcardPluginRegistry = keyof FlashcardPluginRegistry> {
  payload: FlashcardPluginRegistry[K];
  isFlipped: boolean;
}

export type CardTypeDefinition<K extends keyof FlashcardPluginRegistry = keyof FlashcardPluginRegistry> = {
  [P in K]: {
    id: P;
    label: string;
    icon?: ReactNode;
    EditorComponent: React.ComponentType<CardEditorProps<P>>;
    RenderComponent: React.ComponentType<CardRenderProps<P>>;
  }
}[K];

export type CreateVocabCardInput<K extends keyof FlashcardPluginRegistry = keyof FlashcardPluginRegistry> = {
  [P in K]: {
    sourceId: string;
    payload: FlashcardPluginRegistry[P];
    tags?: string[];
  }
}[K];

export type UpdateVocabCardInput<K extends keyof FlashcardPluginRegistry = keyof FlashcardPluginRegistry> = {
  [P in K]: {
    payload?: FlashcardPluginRegistry[P];
    tags?: string[];
  }
}[K];

export function getVocabCardType(card: VocabCard): keyof FlashcardPluginRegistry {
  const payload = card.payload as { type?: unknown } | undefined;
  return typeof payload?.type === 'string' ? payload.type as keyof FlashcardPluginRegistry : 'markdown';
}

export function getVocabCardStatus(card: VocabCard): VocabCardStatus {
  if (card.state === 0) return 'new';
  if (card.state === 1 || card.state === 3) return 'learning';
  if (card.state === 2) {
    return card.due && new Date(card.due) <= new Date() ? 'due' : 'mastered';
  }
  return 'new';
}

export interface VocabBackendAdapter {
  /** 
   * Fetches the batch of cards the user needs to review in this session.
   * Accepts optional configuration to filter by specific tags, search query, statuses, or specific card IDs.
   */
  fetchReviewBatch: (options?: VocabReviewBatchOptions) => Promise<VocabCard[]>;
  
  /** 
   * Submits the user's rating for a specific card.
   * The backend is responsible for calculating the next SRS interval.
   */
  submitReview: (cardId: string, rating: ReviewRating) => Promise<void>;

  /**
   * Fetches all cards in the user's deck for management purposes.
   */
  fetchAllCards: () => Promise<VocabCard[]>;

  /**
   * Fetches specific cards by their deterministic source IDs.
   * Used by lesson pages to quickly check which vocabulary items are already in the deck.
   */
  fetchCardsBySourceIds: (sourceIds: string[]) => Promise<VocabCard[]>;

  /**
   * Creates a new flashcard.
   */
  createCard: <K extends keyof FlashcardPluginRegistry>(card: CreateVocabCardInput<K>) => Promise<VocabCard<K>>;

  /**
   * Updates an existing flashcard.
   */
  updateCard: <K extends keyof FlashcardPluginRegistry>(id: string, card: UpdateVocabCardInput<K>) => Promise<VocabCard<K>>;

  /**
   * Deletes a batch of flashcards and their review history.
   */
  deleteCards: (ids: string[]) => Promise<void>;

  /**
   * Fetches all unique tags currently used across the user's deck.
   */
  fetchAvailableTags: () => Promise<VocabTag[]>;
}
