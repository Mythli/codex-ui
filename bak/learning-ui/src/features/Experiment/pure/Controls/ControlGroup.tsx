import { ReactNode } from 'react';
import styles from "./ControlGroup.module.css";

export interface ControlGroupProps {
  label: string;
  valueDisplay?: ReactNode;
  children: ReactNode;
}

export function ControlGroup({ label, valueDisplay, children }: ControlGroupProps) {
  return (
    <div className={styles.group}>
      <div className={styles.labelRow}>
        <span>{label}</span>
        {valueDisplay && <span className={styles.value}>{valueDisplay}</span>}
      </div>
      {children}
    </div>
  );
}
