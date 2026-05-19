import { ReactNode } from 'react';
import styles from "./ConceptSection.module.css";

export interface ConceptSectionProps {
  children: ReactNode;
  className?: string;
}

export function ConceptSection({ children, className = '' }: ConceptSectionProps) {
  return (
    <section className={`${styles.section} ${className}`}>
      {children}
    </section>
  );
}

export interface ConceptSectionHeaderProps {
  stepNumber?: number | string;
  children: ReactNode;
}

ConceptSection.Header = function ConceptSectionHeader({ stepNumber, children }: ConceptSectionHeaderProps) {
  return (
    <div className={styles.header}>
      {stepNumber && <div className={styles.number}>{stepNumber}</div>}
      <h3 className={styles.title}>{children}</h3>
    </div>
  );
};

ConceptSection.Body = function ConceptSectionBody({ children }: { children: ReactNode }) {
  return (
    <div className={styles.content}>
      {children}
    </div>
  );
};
