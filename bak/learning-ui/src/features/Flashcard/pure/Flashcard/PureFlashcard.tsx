import React, { ReactNode } from 'react';
import { Button } from "../../../../common/Button/Button";
import { PureBadge, BadgeColor } from "../../../../common/Badge/PureBadge";
import { useLocale } from "../../../../system/LocaleContext";
import styles from "./PureFlashcard.module.css";

export interface FlashcardTag {
  id: string;
  label: string;
  color?: BadgeColor;
}

export interface PureFlashcardProps {
  /** The vocabulary word or question (Vocab Mode) */
  word?: string;
  /** The definition or answer (Vocab Mode) */
  definition?: ReactNode;
  /** Whether the card is currently showing the back (answer) */
  isFlipped: boolean;
  /** Whether the card has been added to the user's deck (Vocab Mode) */
  isAdded?: boolean;
  /** Whether the card is currently being saved to the backend */
  isAdding?: boolean;
  /** Whether the deck membership check is still loading */
  isAddStatePending?: boolean;
  /** Optional tags to display on the card */
  tags?: FlashcardTag[];
  /** Callback fired when the user clicks to flip the card */
  onFlip?: () => void;
  /** Callback fired when the user clicks the Add button (Vocab Mode) */
  onAdd?: () => void;
  /** The Front and Back compound components (Compound Mode) */
  children?: ReactNode;
  className?: string;
}

/**
 * A versatile Flashcard component that supports both a simple Vocab Mode 
 * (passing word/definition props) and a Compound Mode (passing Front/Back children).
 */
export function PureFlashcard({
  word,
  definition,
  isFlipped,
  isAdded = false,
  isAdding = false,
  isAddStatePending = false,
  tags = [],
  onFlip,
  onAdd,
  children,
  className = ''
}: PureFlashcardProps) {
  const { dict } = useLocale();

  // If children are provided, act as the base compound component
  if (children) {
    return (
      <div className={`${styles.container} ${isFlipped ? styles.flipped : ''} ${className}`}>
        <div className={styles.inner}>
          {children}
        </div>
      </div>
    );
  }

  const renderTags = () => {
    if (!tags || tags.length === 0) return null;
    return (
      <div className={styles.tagsContainer}>
        {tags.map(tag => (
          <PureBadge key={tag.id} variant="tinted" color={tag.color || 'default'} size="sm">
            {tag.label}
          </PureBadge>
        ))}
      </div>
    );
  };

  // Otherwise, act as the Vocab card
  return (
    <div className={`${styles.container} ${isFlipped ? styles.flipped : ''} ${className}`}>
      <div className={styles.inner}>
        
        {/* Front Face (Question) */}
        <div 
          className={`${styles.face} ${styles.front}`} 
          onClick={() => !isFlipped && onFlip?.()}
          role="button"
          tabIndex={0}
          aria-label={`Reveal definition for ${word}`}
          onKeyDown={(e) => {
            if (!isFlipped && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              onFlip?.();
            }
          }}
        >
          {renderTags()}
          <div className={styles.wordFront}>{word}</div>
          <div className={styles.hint}>
            {dict.vocab.clickToFlip}
          </div>
        </div>

        {/* Back Face (Answer) */}
        <div className={`${styles.face} ${styles.back}`}>
          {renderTags()}
          <div className={styles.wordBack}>{word}</div>
          <div className={styles.definition}>
            {definition}
          </div>
          <div className={styles.actions}>
            <button 
              className={styles.flipBackBtn} 
              onClick={onFlip} 
              type="button"
              aria-label="Flip back to word"
            >
              {dict.vocab.back}
            </button>
            <Button 
              variant={isAdded ? 'success' : 'primary'} 
              size="sm" 
              onClick={onAdd}
              disabled={isAdded || isAdding || isAddStatePending}
              isLoading={isAdding || isAddStatePending}
            >
              {isAdded ? dict.vocab.added : dict.vocab.addToDeck}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}

export interface FlashcardFaceProps {
  children: ReactNode;
  className?: string;
}

PureFlashcard.Front = function FlashcardFront({ children, className = '' }: FlashcardFaceProps) {
  return (
    <div className={`${styles.face} ${styles.front} ${className}`}>
      {children}
    </div>
  );
};

PureFlashcard.Back = function FlashcardBack({ children, className = '' }: FlashcardFaceProps) {
  return (
    <div className={`${styles.face} ${styles.back} ${className}`}>
      {children}
    </div>
  );
};
