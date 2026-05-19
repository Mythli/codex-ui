import { ReactNode } from 'react';
import { useLocale } from "../../../../system/LocaleContext";
import styles from "./ChallengeHeader.module.css";

export interface ChallengeHeaderProps {
  question: ReactNode;
  activeChallengeIndex: number;
  totalCount: number;
  canViewPrevious: boolean;
  canViewNext: boolean;
  onViewPrevious: () => void;
  onViewNext: () => void;
}

export function ChallengeHeader({
  question,
  activeChallengeIndex,
  totalCount,
  canViewPrevious,
  canViewNext,
  onViewPrevious,
  onViewNext,
}: ChallengeHeaderProps) {
  const { dict, t } = useLocale();

  return (
    <div className={styles.header}>
      <button
        className={styles.navBtn}
        onClick={onViewPrevious}
        disabled={!canViewPrevious}
        aria-label="Previous challenge"
        type="button"
      >
        ‹
      </button>
      
      <div className={styles.content}>
        <div className={styles.progress}>
          {t(dict.experiment.challengeProgress, { current: activeChallengeIndex + 1, total: totalCount })}
        </div>
        <div className={styles.question}>
          {question}
        </div>
      </div>

      <button
        className={styles.navBtn}
        onClick={onViewNext}
        disabled={!canViewNext}
        aria-label="Next challenge"
        type="button"
      >
        ›
      </button>
    </div>
  );
}
