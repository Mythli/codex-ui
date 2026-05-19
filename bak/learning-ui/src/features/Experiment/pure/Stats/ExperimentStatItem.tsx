import { ReactNode, CSSProperties } from 'react';
import styles from "./ExperimentStatItem.module.css";

export interface ExperimentStatItemProps {
  label: string;
  value: ReactNode;
  highlight?: boolean;
  pulse?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function ExperimentStatItem({ 
  label, 
  value, 
  highlight, 
  pulse, 
  className = '',
  style
}: ExperimentStatItemProps) {
  return (
    <div className={`${styles.item} ${className}`} style={style}>
      <span className={styles.label}>{label}</span>
      <span className={`${styles.value} ${highlight ? styles.highlight : ''} ${pulse ? styles.pulse : ''}`}>
        {value}
      </span>
    </div>
  );
}
