import React, { ReactNode } from 'react';
import styles from "./FlashcardConveyor.module.css";

export interface FlashcardConveyorProps<T> {
  /** The full array of items in the session */
  items: T[];
  /** The index of the currently active item */
  currentIndex: number;
  /** Function to extract a unique React key from an item */
  getItemId: (item: T) => string;
  /** Optional function to get the rating of an item to color the left card */
  getItemRating?: (item: T) => 'again' | 'hard' | 'good' | 'easy' | undefined;
  /** Render prop to build the card UI */
  renderCard: (item: T, isCurrent: boolean) => ReactNode;
}

/**
 * A pure layout component that creates a 3D "Conveyor Belt" effect for flashcards.
 * It smoothly animates cards sliding in from the right, coming into focus in the center,
 * and sliding out to the left as the user progresses through the queue.
 */
export function FlashcardConveyor<T>({ items, currentIndex, getItemId, getItemRating, renderCard }: FlashcardConveyorProps<T>) {
  return (
    <div className={styles.conveyor}>
      {items.map((item, index) => {
        const offset = index - currentIndex;
        
        // Only render the active card and its immediate neighbors (max 3 cards)
        if (offset < -1 || offset > 1) return null;

        let slotClass = '';
        if (offset === -1) slotClass = styles.slotLeft;
        else if (offset === 0) slotClass = styles.slotCenter;
        else if (offset === 1) slotClass = styles.slotRight;

        const rating = getItemRating ? getItemRating(item) : undefined;

        return (
          <div 
            key={getItemId(item)} 
            className={`${styles.slot} ${slotClass}`}
            data-rating={rating}
          >
            {renderCard(item, offset === 0)}
          </div>
        );
      })}
    </div>
  );
}
