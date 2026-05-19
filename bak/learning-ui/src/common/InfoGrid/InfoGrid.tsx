import { ReactNode } from 'react';
import styles from "./InfoGrid.module.css";

export interface InfoCardProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}

export function InfoCard({ title, icon, children }: InfoCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.icon}>{icon}</div>
      <div className={styles.content}>
        <div className={styles.title}>{title}</div>
        <div className={styles.text}>{children}</div>
      </div>
    </div>
  );
}

export interface InfoGridProps {
  children: ReactNode;
}

export function InfoGrid({ children }: InfoGridProps) {
  return (
    <div className={styles.grid}>
      {children}
    </div>
  );
}
