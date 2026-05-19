import React, { ReactNode } from 'react';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  /** An optional icon or emoji to display at the top */
  icon?: ReactNode;
  /** The main heading text */
  title: string;
  /** Optional descriptive text below the title */
  description?: ReactNode;
  /** Optional children for custom content (like tags or action buttons) */
  children?: ReactNode;
  /** Optional additional class names */
  className?: string;
}

/**
 * A universal empty state component for displaying "No results found" or "No items" messages.
 */
export function EmptyState({ 
  icon, 
  title, 
  description, 
  children, 
  className = '' 
}: EmptyStateProps) {
  return (
    <div className={`${styles.container} ${className}`}>
      {icon && <div className={styles.icon}>{icon}</div>}
      
      <h3 className={styles.title}>{title}</h3>
      
      {description && (
        <div className={styles.description}>{description}</div>
      )}

      {children && (
        <div className={styles.content}>
          {children}
        </div>
      )}
    </div>
  );
}
