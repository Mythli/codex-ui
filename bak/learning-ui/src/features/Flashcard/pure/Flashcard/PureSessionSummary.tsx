import React from 'react';
import { Button } from "../../../../common/Button/Button";
import { PureBadge, BadgeColor } from "../../../../common/Badge/PureBadge";
import { useLocale } from "../../../../system/LocaleContext";
import styles from "./PureSessionSummary.module.css";

export interface SessionSummaryTag {
  id: string;
  label: string;
  color?: BadgeColor;
}

export interface PureSessionSummaryProps {
  title?: string;
  cardsReviewed: number;
  accuracy: number;
  timeSpent: string;
  onFinish: () => void;
  stepNumber?: number | string;
  /** Optional tags to display indicating which categories were reviewed */
  activeTags?: SessionSummaryTag[];
}

export function PureSessionSummary({ 
  title,
  cardsReviewed, 
  accuracy, 
  timeSpent, 
  onFinish, 
  stepNumber = 1,
  activeTags = []
}: PureSessionSummaryProps) {
  const { dict } = useLocale();
  const resolvedTitle = title || "Review Complete";

  return (
    <section className={`lui-theme-dark ${styles.section}`}>
      <div className={styles.header}>
        {stepNumber && <div className={styles.number}>{stepNumber}</div>}
        <div className={styles.titleContainer}>
          <h3 className={styles.title}>{resolvedTitle}</h3>
          {activeTags.length > 0 && (
            <div className={styles.tagsContainer}>
              {activeTags.map(tag => (
                <PureBadge key={tag.id} variant="solid" color={tag.color || 'default'} size="sm">
                  {tag.label}
                </PureBadge>
              ))}
            </div>
          )}
        </div>
        <PureBadge variant="tinted" color="success" className={styles.badge}>
          {dict.vocab.sessionComplete}
        </PureBadge>
      </div>
      
      <div className={styles.content}>
        <div className={styles.icon}>🏆</div>
        <p className={styles.subtitle}>{dict.vocab.conqueredReview}</p>
        
        <div className={styles.statsGrid}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{cardsReviewed}</span>
            <span className={styles.statLabel}>{dict.vocab.cardsMastered}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{accuracy}%</span>
            <span className={styles.statLabel}>{dict.vocab.accuracy}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{timeSpent}</span>
            <span className={styles.statLabel}>{dict.vocab.timeSpent}</span>
          </div>
        </div>

        <Button variant="success" onClick={onFinish} size="lg">
          {dict.vocab.returnToDashboard}
        </Button>
      </div>
    </section>
  );
}
