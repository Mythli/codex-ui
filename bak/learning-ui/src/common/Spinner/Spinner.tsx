import React from 'react';
import styles from './Spinner.module.css';

export interface SpinnerProps {
  /** The size of the spinner. Defaults to 'md'. */
  size?: 'sm' | 'md' | 'lg';
  /** Optional additional class names */
  className?: string;
}

/**
 * A common loading spinner component.
 * Inherits the current text color (`currentColor`) by default.
 */
export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <span 
      className={`${styles.spinner} ${styles[size]} ${className}`} 
      role="status" 
      aria-label="Loading"
    />
  );
}
