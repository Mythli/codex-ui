import React from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useVocab } from "../store/VocabContext";
import { PureReviewControls } from "../pure/Flashcard/PureReviewControls";

export function ReviewControls() {
  const { isFlipped, flipCard, rateCard, currentCard } = useVocab();

  // Space or Enter to flip the card
  useHotkeys('space, enter', (e) => {
    e.preventDefault();
    flipCard();
  }, { enabled: !isFlipped }, [isFlipped, flipCard]);

  // Number keys for ratings
  useHotkeys('1', () => rateCard('again'), { enabled: isFlipped }, [isFlipped, rateCard]);
  useHotkeys('2', () => rateCard('hard'), { enabled: isFlipped }, [isFlipped, rateCard]);
  useHotkeys('3', () => rateCard('good'), { enabled: isFlipped }, [isFlipped, rateCard]);
  useHotkeys('4', () => rateCard('easy'), { enabled: isFlipped }, [isFlipped, rateCard]);
  
  // Space or Enter defaults to 'good' when flipped
  useHotkeys('space, enter', (e) => {
    e.preventDefault();
    rateCard('good');
  }, { enabled: isFlipped }, [isFlipped, rateCard]);

  if (!currentCard) return null;

  return (
    <PureReviewControls
      isFlipped={isFlipped}
      onShowAnswer={flipCard}
      onRate={rateCard}
    />
  );
}
