import type { ReactNode } from "react";
import styles from "@app/common/pure/codex.module.css";

export function WorkEntryRowView({
  icon,
  meta,
  title
}: {
  icon?: ReactNode;
  meta?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className={styles.workEntryRow} data-testid="work-entry">
      {icon}
      <span className={styles.truncate}>{title}</span>
      {meta ? <span className={styles.muted}>{meta}</span> : null}
    </div>
  );
}
