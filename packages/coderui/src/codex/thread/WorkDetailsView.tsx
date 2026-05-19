import type { ReactNode } from "react";
import styles from "../codex.module.css";

export function WorkDetailsView({
  children,
  label
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <section aria-label={label} className={styles.workDetails}>
      <div className={styles.sectionTitle}>{label}</div>
      {children}
    </section>
  );
}
