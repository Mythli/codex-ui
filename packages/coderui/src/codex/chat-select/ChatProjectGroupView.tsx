import type { ReactNode } from "react";
import styles from "../codex.module.css";

export function ChatProjectGroupView({
  children,
  name
}: {
  children: ReactNode;
  name: string;
}) {
  return (
    <section className={styles.projectGroup} aria-label={name}>
      <div className={styles.projectHeader}>{name}</div>
      {children}
    </section>
  );
}
