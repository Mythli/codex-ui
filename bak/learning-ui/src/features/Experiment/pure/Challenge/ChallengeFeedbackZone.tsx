import { ReactNode } from 'react';
import { LearningMarkdown } from '../../../../common/Markdown';
import { useLocale } from "../../../../system/LocaleContext";
import styles from "./ChallengeFeedbackZone.module.css";

export type ChallengeStatus = 'explore' | 'building' | 'success' | 'partial' | 'failed';

export interface ChallengeFeedbackZoneProps {
  status: ChallengeStatus;
  message?: ReactNode;
  isLoading?: boolean;
  hint?: ReactNode;
  onSubmitAndAdvance?: () => void;
  children?: ReactNode;
}

export function ChallengeFeedbackZone({
  status,
  message,
  isLoading = false,
  hint,
  onSubmitAndAdvance,
  children,
}: ChallengeFeedbackZoneProps) {
  const { dict } = useLocale();
  const hasMessage = isLoading || message;
  const hasHint = hint && !hasMessage;
  const hasChildren = !!children;
  
  if (!hasMessage && !hasHint && !hasChildren) return null;

  let zoneClass = styles.zone;
  if (status === 'success') zoneClass += ` ${styles.success}`;
  else if (status === 'explore') zoneClass += ` ${styles.explore}`;
  else if (status === 'partial') zoneClass += ` ${styles.partial}`;
  else if (status === 'failed') zoneClass += ` ${styles.error}`;

  return (
    <div className={zoneClass}>
      {isLoading && (
        <div className={styles.loading}>
          <span className={styles.spinner} />
          <span>{dict.experiment.analyzing}</span>
        </div>
      )}

      {!isLoading && message && (
        <div className={styles.row}>
          <div className={styles.content}>
            <div className={styles.text}>
              {typeof message === 'string' ? (
                <LearningMarkdown>{message}</LearningMarkdown>
              ) : message}
            </div>
          </div>
          <div className={styles.actions}>
            {(status === 'success' || status === 'explore') && onSubmitAndAdvance && (
              <button 
                className={status === 'success' ? styles.btnSuccess : styles.btnExplore} 
                onClick={onSubmitAndAdvance} 
                type="button"
              >
                {dict.experiment.nextStep}
              </button>
            )}
            {children}
          </div>
        </div>
      )}

      {!isLoading && !message && hasHint && (
        <div className={styles.row}>
          <div className={styles.hint}>
            {typeof hint === 'string' ? (
              <LearningMarkdown>{hint}</LearningMarkdown>
            ) : hint}
          </div>
          {children && <div className={styles.actions}>{children}</div>}
        </div>
      )}

      {!isLoading && !message && !hasHint && hasChildren && (
        <div className={styles.actions}>{children}</div>
      )}
    </div>
  );
}
