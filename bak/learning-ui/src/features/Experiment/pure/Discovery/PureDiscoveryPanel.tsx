import { ReactNode } from 'react';
import { PureBadge } from "../../../../common/Badge/PureBadge";
import { useLocale } from "../../../../system/LocaleContext";
import styles from "./PureDiscoveryPanel.module.css";

export interface RequiredObservation {
  id: string;
  name: string;
}

export interface PureDiscoveryPanelProps {
  title: string;
  requiredObservations: RequiredObservation[];
  confirmedObservations: string[];
  isManuallyRevealed: boolean;
  onRevealClick: () => void;
  children: ReactNode;
}

export function PureDiscoveryPanel({
  title,
  requiredObservations,
  confirmedObservations,
  isManuallyRevealed,
  onRevealClick,
  children,
}: PureDiscoveryPanelProps) {
  const { dict } = useLocale();
  const missingObservations = requiredObservations.filter(
    (obs) => !confirmedObservations.includes(obs.id)
  );
  
  const isAutoUnlocked = missingObservations.length === 0;
  const isLocked = !isAutoUnlocked && !isManuallyRevealed;

  const panelClass = [
    styles.panel,
    isLocked ? styles.locked : '',
    isAutoUnlocked ? styles.unlockedAuto : '',
    isManuallyRevealed && !isAutoUnlocked ? styles.unlockedManual : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={panelClass}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        {isAutoUnlocked && (
          <PureBadge variant="solid" color="success">
            {dict.experiment.discovered}
          </PureBadge>
        )}
        {isManuallyRevealed && !isAutoUnlocked && (
          <PureBadge variant="tinted" color="default">
            {dict.experiment.revealed}
          </PureBadge>
        )}
      </div>

      <div className={styles.contentWrapper}>
        <div className={styles.content}>
          {children}
        </div>

        {isLocked && (
          <div className={styles.overlay}>
            <div className={styles.lockIcon}>🔒</div>
            <div className={styles.lockMessage}>
              {dict.experiment.discoverToUnlock}
            </div>
            <ul className={styles.requirements}>
              {missingObservations.map((obs) => (
                <li key={obs.id}>{obs.name}</li>
              ))}
            </ul>
            <button
              className={styles.revealBtn}
              onClick={onRevealClick}
              type="button"
            >
              {dict.experiment.revealAnyway}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
