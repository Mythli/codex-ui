import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { VocabBackendAdapter, VocabCard, ReviewRating, CardTypeDefinition, VocabCardStatus, VocabReviewBatchOptions } from "../types";

export interface QueueItem {
  /** A unique key for this specific appearance of the card in the session */
  instanceKey: string;
  /** The actual card data */
  card: VocabCard;
}

interface VocabContextValue {
  queue: QueueItem[];
  currentIndex: number;
  isFlipped: boolean;
  isLoaded: boolean;
  stats: { reviewed: number };
  
  // Conveyor Belt State
  previousCard: VocabCard | null;
  currentCard: VocabCard | null;
  nextCard: VocabCard | null;
  cardRatings: Record<string, ReviewRating>;
  
  // Boss Mode Analytics
  history: VocabCard[];
  ratings: Record<ReviewRating, number>;
  startTime: number;
  endTime: number | null;
  
  // Tag Filtering
  activeTags: string[];
  setActiveTags: (tags: string[]) => void;
  toggleTag: (tagId: string) => void;
  clearTags: () => void;

  // Search & Status Filtering
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeStatuses: VocabCardStatus[];
  setActiveStatuses: (statuses: VocabCardStatus[]) => void;

  // Registry
  cardRegistry: CardTypeDefinition[];

  flipCard: () => void;
  rateCard: (rating: ReviewRating) => Promise<void>;
}

const VocabContext = createContext<VocabContextValue | null>(null);

export function useVocab() {
  const context = useContext(VocabContext);
  if (!context) {
    throw new Error('useVocab must be used within a VocabProvider');
  }
  return context;
}

interface VocabProviderProps {
  backend: VocabBackendAdapter;
  cardRegistry?: CardTypeDefinition[];
  initialCards?: VocabCard[];
  initialReviewOptions?: VocabReviewBatchOptions;
  children: React.ReactNode;
}

export function VocabProvider({ backend, cardRegistry = [], initialCards, initialReviewOptions, children }: VocabProviderProps) {
  const [queue, setQueue] = useState<QueueItem[]>(() => {
    if (initialCards) {
      // Use deterministic keys for the initial SSR render to prevent hydration mismatches
      return initialCards.map((card, index) => ({
        instanceKey: `${card.id}-initial-${index}`,
        card
      }));
    }
    return [];
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoaded, setIsLoaded] = useState(!!initialCards);
  const [stats, setStats] = useState({ reviewed: 0 });

  // Filtering State
  const [activeTags, setActiveTags] = useState<string[]>(initialReviewOptions?.tags || []);
  const [searchQuery, setSearchQuery] = useState<string>(initialReviewOptions?.search || '');
  const [activeStatuses, setActiveStatuses] = useState<VocabCardStatus[]>(initialReviewOptions?.statuses || []);

  // Conveyor Belt State (Keyed by instanceKey, not card.id)
  const [cardRatings, setCardRatings] = useState<Record<string, ReviewRating>>({});

  // Boss Mode Analytics State
  const [history, setHistory] = useState<VocabCard[]>([]);
  const [ratings, setRatings] = useState<Record<ReviewRating, number>>({ again: 0, hard: 0, good: 0, easy: 0 });
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [endTime, setEndTime] = useState<number | null>(null);

  // Locks and Queues
  const isProcessingRef = useRef(false);
  const pendingReviewsRef = useRef<{cardId: string, rating: ReviewRating}[]>([]);
  const isSyncingRef = useRef(false);
  const skipInitialFetchRef = useRef(initialCards !== undefined);
  const initialCardIdsRef = useRef(initialReviewOptions?.cardIds);

  const toggleTag = useCallback((tagId: string) => {
    setActiveTags(prev => 
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    );
  }, []);

  const clearTags = useCallback(() => {
    setActiveTags([]);
  }, []);

  // Background Sync Processor
  const processPendingReviews = useCallback(async () => {
    if (isSyncingRef.current || pendingReviewsRef.current.length === 0) return;
    isSyncingRef.current = true;
    
    const toProcess = [...pendingReviewsRef.current];
    pendingReviewsRef.current = [];
    
    for (const review of toProcess) {
      try {
        await backend.submitReview(review.cardId, review.rating);
      } catch (e) {
        console.error("Failed to submit review, queueing for retry", e);
        // Put it back in the queue to try again later
        pendingReviewsRef.current.push(review);
      }
    }
    
    isSyncingRef.current = false;
  }, [backend]);

  useEffect(() => {
    let mounted = true;
    
    const loadBatch = async () => {
      if (skipInitialFetchRef.current) {
        skipInitialFetchRef.current = false;
        return;
      }

      try {
        const cards = await backend.fetchReviewBatch({ 
          tags: activeTags.length > 0 ? activeTags : undefined,
          search: searchQuery ? searchQuery : undefined,
          statuses: activeStatuses.length > 0 ? activeStatuses : undefined,
          cardIds: initialCardIdsRef.current && initialCardIdsRef.current.length > 0 ? initialCardIdsRef.current : undefined
        });
        
        if (mounted) {
          // Wrap the raw cards in QueueItems to separate the data entity from the session instance
          const initialQueue = cards.map((card, index) => ({
            instanceKey: `${card.id}-${Date.now()}-${index}`,
            card
          }));
          
          setQueue(initialQueue);
          setCurrentIndex(0);
          setIsFlipped(false);
          setStartTime(Date.now());
          setIsLoaded(true);
        }
      } catch (error) {
        console.error("Failed to fetch vocab batch", error);
        if (mounted) setIsLoaded(true); // Still mark loaded to show empty state/error
      }
    };

    loadBatch();

    return () => { mounted = false; };
  }, [backend, activeTags, searchQuery, activeStatuses]);

  // Track when the session finishes to lock in the end time
  useEffect(() => {
    if (isLoaded && queue.length > 0 && currentIndex >= queue.length && !endTime) {
      setEndTime(Date.now());
      // Final flush of any pending reviews
      processPendingReviews();
    }
  }, [currentIndex, queue.length, isLoaded, endTime, processPendingReviews]);

  const previousCard = currentIndex > 0 ? queue[currentIndex - 1].card : null;
  const currentCard = currentIndex < queue.length ? queue[currentIndex].card : null;
  const nextCard = currentIndex < queue.length - 1 ? queue[currentIndex + 1].card : null;

  const flipCard = useCallback(() => {
    if (!isFlipped && currentCard) {
      setIsFlipped(true);
    }
  }, [isFlipped, currentCard]);

  const rateCard = useCallback(async (rating: ReviewRating) => {
    const currentItem = queue[currentIndex];
    if (!currentItem || isProcessingRef.current) return;

    // Lock the UI for a fraction of a second to prevent double-clicks
    isProcessingRef.current = true;

    const card = currentItem.card;

    // 1. Optimistic UI Updates (Instant)
    setCardRatings(prev => ({ ...prev, [currentItem.instanceKey]: rating }));
    setRatings(prev => ({ ...prev, [rating]: prev[rating] + 1 }));
    
    // Deduplicate history based on the original card ID
    setHistory(prev => {
      if (!prev.find(c => c.id === card.id)) {
        return [...prev, card];
      }
      return prev;
    });

    // If the user forgot the card, push a NEW instance of it to the end of the queue
    if (rating === 'again') {
      setQueue(prev => [
        ...prev, 
        { 
          instanceKey: `${card.id}-retry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, 
          card 
        }
      ]);
    }

    // Advance to next card
    setCurrentIndex(prev => prev + 1);
    setIsFlipped(false);
    setStats(prev => ({ reviewed: prev.reviewed + 1 }));

    // 2. Background Save (Resilient)
    pendingReviewsRef.current.push({ cardId: card.id, rating });
    processPendingReviews();

    // 3. Release the lock after the conveyor animation finishes (~400ms)
    setTimeout(() => {
      isProcessingRef.current = false;
    }, 400);

  }, [queue, currentIndex, processPendingReviews]);

  return (
    <VocabContext.Provider value={{
      queue,
      currentIndex,
      isFlipped,
      isLoaded,
      stats,
      previousCard,
      currentCard,
      nextCard,
      cardRatings,
      history,
      ratings,
      startTime,
      endTime,
      activeTags,
      setActiveTags,
      toggleTag,
      clearTags,
      searchQuery,
      setSearchQuery,
      activeStatuses,
      setActiveStatuses,
      cardRegistry,
      flipCard,
      rateCard
    }}>
      {children}
    </VocabContext.Provider>
  );
}
