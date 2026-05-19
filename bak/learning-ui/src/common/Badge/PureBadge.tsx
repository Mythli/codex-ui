import React, { ReactNode } from 'react';
import styles from "./PureBadge.module.css";

export type BadgeVariant = 'solid' | 'tinted';
export type BadgeColor = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'default';
export type BadgeSize = 'sm' | 'md';

export interface PureBadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  color?: BadgeColor;
  size?: BadgeSize;
  className?: string;
}

export function PureBadge({
  children,
  variant = 'tinted',
  color = 'default',
  size = 'sm',
  className = ''
}: PureBadgeProps) {
  const classes = [
    styles.badge,
    styles[size],
    styles[variant],
    styles[color],
    className
  ].filter(Boolean).join(' ');

  return (
    <span className={classes}>
      <span className={styles.content}>
        {children}
      </span>
    </span>
  );
}
