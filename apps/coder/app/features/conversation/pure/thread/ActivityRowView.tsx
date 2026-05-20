import type { ReactNode } from "react";
import styles from "@app/common/pure/codex.module.css";

export function ActivityRowView({
  active = false,
  description,
  icon,
  title
}: {
  active?: boolean;
  description?: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className={styles.activityRow} data-active={active ? "true" : undefined}>
      {icon}
      <span className={styles.truncate}>{title}</span>
      {description ? <span className={styles.muted}>{description}</span> : null}
    </div>
  );
}
