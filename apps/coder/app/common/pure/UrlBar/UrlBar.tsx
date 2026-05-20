import type { ReactNode } from "react";
import styles from "./UrlBar.module.css";

export function UrlBar({
  actions,
  className,
  leading,
  title,
  value
}: {
  actions?: ReactNode;
  className?: string;
  leading?: ReactNode;
  title?: string;
  value: string;
}) {
  return (
    <div aria-label={title ?? "URL bar"} className={[styles.urlBar, className ?? ""].filter(Boolean).join(" ")} data-testid="url-bar">
      {leading ? <div className={styles.leading}>{leading}</div> : null}
      <div className={styles.addressField} data-testid="url-bar-value" title={value}>
        <span className={styles.addressText}>{value}</span>
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}
