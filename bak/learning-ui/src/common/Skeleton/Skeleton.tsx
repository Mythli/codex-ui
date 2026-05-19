import React from 'react';
import styles from './Skeleton.module.css';

export interface SkeletonProps {
  /** The shape variant of the skeleton. Defaults to 'text'. */
  variant?: 'text' | 'circular' | 'rectangular';
  /** Width of the skeleton. Can be a string (e.g., '100%', '50px') or number (pixels). */
  width?: string | number;
  /** Height of the skeleton. Can be a string or number. */
  height?: string | number;
  /** Optional additional class names */
  className?: string;
}

/**
 * A primitive loading skeleton component that displays a shimmering placeholder.
 */
export function Skeleton({ 
  variant = 'text', 
  width, 
  height, 
  className = '' 
}: SkeletonProps) {
  const style = {
    width,
    height,
  };

  return (
    <span 
      className={`${styles.skeleton} ${styles[variant]} ${className}`} 
      style={style}
      aria-hidden="true"
    />
  );
}
