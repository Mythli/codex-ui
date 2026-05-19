import React from 'react';
import { useVocab } from "../store/VocabContext";
import { FlashcardConveyor } from "../pure/Flashcard/FlashcardConveyor";
import { PureMarkdownFlashcard } from "../pure/Flashcard/PureMarkdownFlashcard";
import { FlashcardPluginRegistry, getVocabCardType } from '../types';

export function Conveyor() {
  const { queue, currentIndex, cardRatings, isFlipped, cardRegistry } = useVocab();

  return (
    <FlashcardConveyor
      items={queue}
      currentIndex={currentIndex}
      getItemId={(item) => item.instanceKey}
      getItemRating={(item) => cardRatings[item.instanceKey]}
      renderCard={(item, isCurrent) => {
        const card = item.card;
        
        const cardType = getVocabCardType(card);

        // 1. Try to use the registry if a type is specified
        if (cardType && cardRegistry && cardRegistry.length > 0) {
          const def = cardRegistry.find(r => r.id === cardType);
          if (def) {
            const RenderComponent = def.RenderComponent as React.ComponentType<{ payload: unknown; isFlipped: boolean }>;
            return <RenderComponent payload={card.payload} isFlipped={isCurrent ? isFlipped : false} />;
          }
        }

        // 2. Fallback to legacy markdown fields if no registry match
        let frontMd = card.frontMarkdown || '';
        let backMd = card.backMarkdown || '';

        if (cardType === 'markdown') {
          const mdPayload = card.payload as FlashcardPluginRegistry['markdown'];
          frontMd = mdPayload.front || frontMd;
          backMd = mdPayload.back || backMd;
        } else if (card.payload && typeof card.payload === 'object') {
          if ('front' in card.payload) frontMd = String(card.payload.front) || frontMd;
          if ('back' in card.payload) backMd = String(card.payload.back) || backMd;
        }

        return (
          <PureMarkdownFlashcard
            isFlipped={isCurrent ? isFlipped : false}
            frontMarkdown={frontMd}
            backMarkdown={backMd}
          />
        );
      }}
    />
  );
}
