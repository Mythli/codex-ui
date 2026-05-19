import React, { ReactNode } from 'react';
import styles from "./FloatingActionBar.module.css";

export interface FloatingActionBarProps {
  /** The content to display on the left side (e.g., "3 items selected") */
  info?: ReactNode;
  /** The action buttons to display on the right side */
  children: ReactNode;
  /** Whether the bar is currently visible */
  isVisible: boolean;
  className?: string;
}

/**
 * A floating pill-shaped action bar that slides up from the bottom of the screen.
 * Perfect for bulk actions or contextual tools.
 */
export function FloatingActionBar({ info, children, isVisible, className = '' }: FloatingActionBarProps) {
  if (!isVisible) return null;

  return (
    <div className={`${styles.bar} ${className}`} role="toolbar" aria-label="Bulk Actions">
      <div className={styles.content}>
        {info && (
          <div className={styles.info}>
            {info}
          </div>
        )}
        <div className={styles.actions}>
          {children}
        </div>
      </div>
    </div>
  );
}
