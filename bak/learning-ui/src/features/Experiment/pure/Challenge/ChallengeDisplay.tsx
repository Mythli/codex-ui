import { ReactNode } from 'react';
import { useLocale } from "../../../../system/LocaleContext";
import styles from "./ChallengeDisplay.module.css";

export interface ChallengeDisplayProps {
  activeChallengeIndex: number;
  totalCount: number;
  question: ReactNode;
  feedback?: { status: 'success' | 'partial' | 'failed'; message: ReactNode } | null;
  onViewNext?: () => void;
  onViewPrevious?: () => void;
  canViewNext?: boolean;
  canViewPrevious?: boolean;
  children?: ReactNode;
}

export function ChallengeDisplay({
  activeChallengeIndex,
  totalCount,
  question,
  feedback,
  onViewNext,
  onViewPrevious,
  canViewNext = true,
  canViewPrevious = true,
  children,
}: ChallengeDisplayProps) {
  const { dict } = useLocale();

  return (
    <div className={styles.display}>
      <div className={styles.progress}>
        <span className={styles.current}>{activeChallengeIndex + 1}</span>
        <span className={styles.separator}>/</span>
        <span className={styles.total}>{totalCount}</span>
      </div>

      <div className={styles.question}>
        {question}
      </div>

      {feedback && (
        <div className={`${styles.feedback} ${styles[feedback.status]}`}>
          {feedback.message}
        </div>
      )}

      {children}

      <div className={styles.nav}>
        {onViewPrevious && (
          <button
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={onViewPrevious}
            disabled={!canViewPrevious}
            type="button"
          >
            {dict.experiment.back}
          </button>
        )}
        {onViewNext && (
          <button
            className={styles.btn}
            onClick={onViewNext}
            disabled={!canViewNext}
            type="button"
          >
            {dict.experiment.next}
          </button>
        )}
      </div>
    </div>
  );
}
