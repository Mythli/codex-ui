import type { ReactNode } from "react";
import styles from "@app/common/pure/codex.module.css";

export function PromptHomeView({
  actions,
  subtitle,
  title
}: {
  actions?: ReactNode;
  subtitle?: ReactNode;
  title: ReactNode;
}) {
  return (
    <section className={styles.heroPane}>
      <div className={styles.heroTitle}>{title}</div>
      {subtitle ? <div className={styles.muted}>{subtitle}</div> : null}
      {actions}
    </section>
  );
}
