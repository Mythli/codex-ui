import { ReactNode } from 'react';
import styles from "./Callout.module.css";

export type CalloutVariant = 'insight' | 'warning' | 'success' | 'error';

export interface CalloutProps {
  variant?: CalloutVariant;
  title?: ReactNode;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

const VARIANT_ICONS: Record<CalloutVariant, string> = {
  insight: '💡',
  warning: '⚠️',
  success: '✅',
  error: '⚠️',
};

export function Callout({ variant = 'insight', title, icon, className, children }: CalloutProps) {
  const displayIcon = icon || VARIANT_ICONS[variant];

  return (
    <div className={[styles.callout, styles[variant], className].filter(Boolean).join(' ')}>
      <div className={styles.icon}>{displayIcon}</div>
      <div className={styles.content}>
        {title && <strong className={styles.title}>{title}</strong>}
        <div className={styles.text}>{children}</div>
      </div>
    </div>
  );
}
