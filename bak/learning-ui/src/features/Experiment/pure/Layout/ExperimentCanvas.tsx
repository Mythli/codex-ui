import { ReactNode } from 'react';
import styles from "./ExperimentCanvas.module.css";

export interface ExperimentCanvasProps {
  children: ReactNode;
  centered?: boolean;
  dark?: boolean;
  minHeight?: number;
}

export function ExperimentCanvas({ children, centered, dark, minHeight }: ExperimentCanvasProps) {
  const classNames = [
    styles.container,
    centered ? styles.centered : '',
    dark ? styles.dark : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classNames} style={minHeight ? { minHeight } : undefined}>
      <div className={styles.content}>
        {children}
      </div>
    </div>
  );
}
