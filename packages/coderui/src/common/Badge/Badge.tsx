import type { ReactNode } from "react";
import styles from "./Badge.module.css";

export function Badge({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "neutral" | "success";
}) {
  return <span className={[styles.badge, styles[tone]].join(" ")}>{children}</span>;
}
