import React, { ReactNode } from 'react';
import { useLocale } from "../../../../system/LocaleContext";
import { Skeleton } from "../../../../common/Skeleton/Skeleton";
import styles from "./PureVocabArena.module.css";

export interface PureVocabArenaProps {
  title?: string;
  children: ReactNode;
}

/**
 * A structured container for the flashcard and its controls,
 * styled to match the application's standard ConceptSection layout,
 * but upgraded to a dark, glowing "Boss Mode" aesthetic.
 */
export function PureVocabArena({ title, children }: PureVocabArenaProps) {
  const { dict } = useLocale();
  const resolvedTitle = title || dict.vocab.activeCard;

  return (
    <section className={`lui-theme-dark ${styles.section}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>{resolvedTitle}</h3>
      </div>
      <div className={styles.content}>
        {children}
      </div>
    </section>
  );
}

/**
 * A skeleton loader that perfectly matches the dimensions of the PureVocabArena,
 * Flashcard, and Review Controls to prevent layout shift while loading.
 * Features a premium shimmer effect.
 */
PureVocabArena.Skeleton = function PureVocabArenaSkeleton() {
  return (
    <section className={`lui-theme-dark ${styles.section}`}>
      <div className={styles.header}>
        <Skeleton variant="text" width={150} height={24} />
      </div>
      <div className={styles.content}>
        <div className={styles.cardSkeletonContainer}>
          <Skeleton variant="rectangular" width="100%" height="100%" />
        </div>
        <div className={styles.controlsContainerSkeleton}>
          <div style={{ width: '100%', maxWidth: 400 }}>
            <Skeleton variant="rectangular" width="100%" height={56} />
          </div>
        </div>
      </div>
    </section>
  );
};
