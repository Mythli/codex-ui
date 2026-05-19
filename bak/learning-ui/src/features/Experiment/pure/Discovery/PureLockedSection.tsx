import { ReactNode } from 'react';
import { PureBadge } from "../../../../common/Badge/PureBadge";
import { useLocale } from "../../../../system/LocaleContext";
import styles from "./PureLockedSection.module.css";

export interface PureLockedSectionProps {
  isUnlocked: boolean;
  isManuallyRevealed: boolean;
  onPeekClick: () => void;
  children: ReactNode;
}

export function PureLockedSection({
  isUnlocked,
  isManuallyRevealed,
  onPeekClick,
  children,
}: PureLockedSectionProps) {
  const { dict } = useLocale();
  const isLocked = !isUnlocked && !isManuallyRevealed;

  const sectionClass = [
    styles.section,
    isUnlocked ? styles.unlockedAuto : '',
    isManuallyRevealed && !isUnlocked ? styles.unlockedManual : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={sectionClass}>
      <div className={`${styles.content} ${isLocked ? styles.contentLocked : ''}`}>
        {children}
      </div>

      {isLocked && (
        <div className={styles.overlay}>
          <div className={styles.lockBox}>
            <div className={styles.lockIcon}>🔒</div>
            <div className={styles.lockMessage}>
              {dict.experiment.completeToUnlock}
            </div>
            <button
              className={styles.peekBtn}
              onClick={onPeekClick}
              type="button"
            >
              {dict.experiment.peekAnyway}
            </button>
          </div>
        </div>
      )}

      {isUnlocked && (
        <PureBadge variant="solid" color="success" className={styles.badge}>
          {dict.experiment.discoveredExclaim}
        </PureBadge>
      )}
    </div>
  );
}
