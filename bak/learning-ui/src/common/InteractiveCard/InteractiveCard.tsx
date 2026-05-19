import { ReactNode } from 'react';
import styles from "./InteractiveCard.module.css";

export interface InteractiveCardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}

export function InteractiveCard({ title, subtitle, children }: InteractiveCardProps) {
  return (
    <div className={styles.card}>
      {(title || subtitle) && (
        <div className={styles.header}>
          {title && <div className={styles.title}>{title}</div>}
          {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
        </div>
      )}
      <div className={styles.content}>
        {children}
      </div>
    </div>
  );
}
