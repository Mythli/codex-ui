import type { ReactNode } from "react";
import styles from "./TextShimmer.module.css";

export type TextShimmerProps = {
  active?: boolean;
  children: ReactNode;
  className?: string;
};

export function TextShimmer({ active = true, children, className = "" }: TextShimmerProps) {
  return (
    <span className={[styles.textShimmer, active ? styles.active : "", className].filter(Boolean).join(" ")}>
      <span className={styles.base}>{children}</span>
      {active ? (
        <span aria-hidden="true" className={styles.sweep}>
          <span className={styles.highlight}>{children}</span>
        </span>
      ) : null}
    </span>
  );
}
