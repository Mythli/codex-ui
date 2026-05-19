import React from 'react';
import { useLocale } from "../../../../system/LocaleContext";
import { ReviewRating } from "../../types";
import styles from "./PureReviewControls.module.css";

export interface PureReviewControlsProps {
  isFlipped: boolean;
  onShowAnswer: () => void;
  onRate: (rating: ReviewRating) => void;
}

export function PureReviewControls({
  isFlipped,
  onShowAnswer,
  onRate
}: PureReviewControlsProps) {
  const { dict } = useLocale();
  
  if (!isFlipped) {
    return (
      <div className={styles.container}>
        <button 
          className={styles.showAnswerBtn} 
          onClick={onShowAnswer}
        >
          {dict.vocab.showAnswer} <span className={styles.ratingShortcut}>{dict.vocab.space}</span>
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.ratingGroup}>
        <button 
          className={`${styles.ratingBtn} ${styles.btnAgain}`} 
          onClick={() => onRate('again')}
        >
          <span className={styles.ratingLabel}>{dict.vocab.again}</span>
          <span className={styles.ratingShortcut}>1</span>
        </button>
        
        <button 
          className={`${styles.ratingBtn} ${styles.btnHard}`} 
          onClick={() => onRate('hard')}
        >
          <span className={styles.ratingLabel}>{dict.vocab.hard}</span>
          <span className={styles.ratingShortcut}>2</span>
        </button>
        
        <button 
          className={`${styles.ratingBtn} ${styles.btnGood}`} 
          onClick={() => onRate('good')}
        >
          <span className={styles.ratingLabel}>{dict.vocab.good}</span>
          <span className={styles.ratingShortcut}>3</span>
        </button>
        
        <button 
          className={`${styles.ratingBtn} ${styles.btnEasy}`} 
          onClick={() => onRate('easy')}
        >
          <span className={styles.ratingLabel}>{dict.vocab.easy}</span>
          <span className={styles.ratingShortcut}>4</span>
        </button>
      </div>
    </div>
  );
}
