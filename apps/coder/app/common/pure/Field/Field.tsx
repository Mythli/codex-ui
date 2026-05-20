import type { ReactNode } from "react";
import styles from "./Field.module.css";

export function Field({
  children,
  hint,
  label
}: {
  children: ReactNode;
  hint?: ReactNode;
  label: ReactNode;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </label>
  );
}
