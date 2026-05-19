import React, { useState, useEffect, useMemo } from 'react';
import { LearningMarkdown } from '../../../common/Markdown';
import { requireLearningUIDependency, useLearningUIConfig } from '../../../system/LocaleContext';
import { PureVocabularySection } from '../pure/VocabularySection/PureVocabularySection';
import { PureFlashcard } from '../pure/Flashcard/PureFlashcard';
import { VocabCard } from '../types';

export interface VocabularyItem {
  id: string;
  word: string;
  definition: string;
  tags?: string[];
}

export interface VocabularySectionProps {
  /** The title of the section. Defaults to "Key Vocabulary" */
  title?: string;
  /** Optional description text to display below the title */
  description?: React.ReactNode;
  /** The vocabulary items to display and potentially add to the deck */
  items: VocabularyItem[];
  /** Cards already present in the user's deck, usually supplied by an SSR route loader */
  initialExistingCards?: VocabCard[];
}

/**
 * A smart wrapper for the VocabularySection.
 * Automatically fetches the user's existing deck to determine which cards are already added,
 * handles the "Add to Deck" actions, and prevents duplicates using deterministic source IDs.
 */
export function VocabularySection({ title, description, items, initialExistingCards }: VocabularySectionProps) {
  const learningUI = useLearningUIConfig();
  const resolvedBackend = requireLearningUIDependency(
    learningUI.adapters?.vocab,
    'VocabularySection backend'
  );
  const itemIds = useMemo(() => items.map(i => i.id).join(','), [items]);
  const [existingCards, setExistingCards] = useState<VocabCard[]>(() => initialExistingCards || []);
  const [loadedItemIds, setLoadedItemIds] = useState<string | null>(() => (
    initialExistingCards ? itemIds : null
  ));
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());
  const [addingCards, setAddingCards] = useState<Set<string>>(new Set());
  const [isAddingAll, setIsAddingAll] = useState(false);

  // Fetch only the specific cards for this lesson to hydrate the "isAdded" state
  useEffect(() => {
    let mounted = true;
    if (loadedItemIds === itemIds) return;
    if (items.length === 0) {
      setExistingCards([]);
      setLoadedItemIds(itemIds);
      return;
    }

    const sourceIds = items.map(i => i.id);
    
    resolvedBackend.fetchCardsBySourceIds(sourceIds)
      .then(cards => {
        if (mounted) {
          setExistingCards(cards);
          setLoadedItemIds(itemIds);
        }
      })
      .catch(err => {
        console.error("Failed to fetch existing cards", err);
        if (mounted) setLoadedItemIds(itemIds);
      });
    
    return () => { mounted = false; };
  }, [resolvedBackend, items, itemIds, loadedItemIds]);

  const isExistingCardsLoaded = loadedItemIds === itemIds;

  // Helper to check if an item is already in the user's deck
  const isItemAdded = (item: VocabularyItem) => {
    return existingCards.some(c => c.sourceId === item.id);
  };

  const handleAdd = async (item: VocabularyItem) => {
    if (!isExistingCardsLoaded || isItemAdded(item) || addingCards.has(item.id)) return;
    
    setAddingCards(prev => new Set(prev).add(item.id));
    
    try {
      const newCard = await resolvedBackend.createCard<'markdown'>({
        sourceId: item.id,
        payload: {
          type: 'markdown',
          front: `# ${item.word}`,
          back: `**${item.word}**\n\n${item.definition}`
        },
        tags: item.tags || []
      });
      
      setExistingCards(prev => [...prev, newCard]);
    } catch (e) {
      console.error("Failed to add card", e);
    } finally {
      setAddingCards(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const handleAddAll = async () => {
    setIsAddingAll(true);
    try {
      const unaddedItems = items.filter(item => !isItemAdded(item));
      const promises = unaddedItems.map(item => handleAdd(item));
      await Promise.all(promises);
    } finally {
      setIsAddingAll(false);
    }
  };

  const isAllAdded = isExistingCardsLoaded && items.length > 0 && items.every(isItemAdded);

  return (
    <PureVocabularySection
      title={title}
      description={description}
      onAddAll={handleAddAll}
      isAllAdded={isAllAdded}
      isAddingAll={isAddingAll || !isExistingCardsLoaded}
    >
      {items.map(item => (
        <PureFlashcard
          key={item.id}
          word={item.word}
          definition={<LearningMarkdown>{item.definition}</LearningMarkdown>}
          isFlipped={flippedCards.has(item.id)}
          isAdded={isItemAdded(item)}
          isAdding={addingCards.has(item.id)}
          isAddStatePending={!isExistingCardsLoaded}
          onFlip={() => {
            setFlippedCards(prev => {
              const next = new Set(prev);
              if (next.has(item.id)) next.delete(item.id);
              else next.add(item.id);
              return next;
            });
          }}
          onAdd={() => handleAdd(item)}
        />
      ))}
    </PureVocabularySection>
  );
}
