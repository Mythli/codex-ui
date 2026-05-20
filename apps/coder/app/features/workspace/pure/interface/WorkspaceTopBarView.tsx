import type { ReactNode } from "react";
import styles from "@app/common/pure/codex.module.css";

export function WorkspaceTopBarView({
  left,
  right,
  title
}: {
  left?: ReactNode;
  right?: ReactNode;
  title: ReactNode;
}) {
  return (
    <header className={styles.topBar}>
      <div className={styles.compactRow}>{left}<span className={styles.sectionTitle}>{title}</span></div>
      <div className={styles.compactRow}>{right}</div>
    </header>
  );
}
