import { ReactNode } from 'react';
import { Callout } from "../../../../common/Callout/Callout";
import { PureObservationInput } from "./PureObservationInput";
import { PureBadge } from "../../../../common/Badge/PureBadge";
import { useLocale } from "../../../../system/LocaleContext";
import styles from "./PureObservationsSection.module.css";

export interface PureObservationHint {
  id: string;
  content: ReactNode;
}

export interface PureObservationsSectionProps {
  totalObservations: number;
  confirmedCount: number;
  observationsText: string;
  onTextChange: (text: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  feedback: ReactNode | null;
  hints?: PureObservationHint[];
  title?: string;
  stepNumber?: number | string;
  placeholder?: string;
  buttonText?: string;
}

export function PureObservationsSection({
  totalObservations,
  confirmedCount,
  observationsText,
  onTextChange,
  onSubmit,
  isLoading,
  feedback,
  hints = [],
  title,
  stepNumber,
  placeholder,
  buttonText,
}: PureObservationsSectionProps) {
  const { dict, t } = useLocale();
  const allConfirmed = confirmedCount === totalObservations && totalObservations > 0;
  const hasChecked = feedback !== null;

  const resolvedTitle = title || dict.experiment.whatDidYouDiscover;

  return (
    <section className={`${styles.section} ${allConfirmed ? styles.complete : ''}`}>
      <div className={styles.header}>
        {stepNumber && <div className={styles.number}>{stepNumber}</div>}
        <h3 className={styles.title}>{resolvedTitle}</h3>
        {allConfirmed && (
          <PureBadge variant="solid" color="success" className={styles.badge}>
            {dict.experiment.allPatternsFound}
          </PureBadge>
        )}
      </div>
      
      <div className={styles.content}>
        <PureObservationInput
          value={observationsText}
          onChange={onTextChange}
          onSubmit={onSubmit}
          isLoading={isLoading}
          placeholder={placeholder}
          buttonText={buttonText}
        />
        
        {feedback && (
          <Callout variant="success">
            <div>{feedback}</div>
            
            {hints.length > 0 && (
              <>
                <p style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
                  <strong>{dict.experiment.hintsToDiscoverMore}</strong>
                </p>
                <ul style={{ marginLeft: '1.25rem' }}>
                  {hints.map((hint) => (
                    <li key={hint.id} style={{ marginBottom: '0.5rem' }}>
                      {hint.content}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Callout>
        )}

        {hasChecked && (
          <div className={styles.counter}>
            {t(dict.experiment.patternsDiscovered, { confirmed: confirmedCount, total: totalObservations })}
          </div>
        )}
      </div>
    </section>
  );
}
