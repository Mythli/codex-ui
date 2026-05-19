import type { ReactNode } from "react";
import styles from "./DialogView.module.css";

export type DialogViewProps = {
  "aria-label"?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  description?: ReactNode;
  error?: ReactNode;
  role?: "dialog" | "group";
  size?: "compact" | "default" | "wide";
  title: ReactNode;
};

export function DialogView({
  "aria-label": ariaLabel,
  actions,
  children,
  className,
  description,
  error,
  role = "dialog",
  size = "default",
  title
}: DialogViewProps) {
  return (
    <section
      aria-label={ariaLabel ?? (typeof title === "string" ? title : undefined)}
      className={[styles.dialog, size !== "default" ? styles[size] : "", className ?? ""].filter(Boolean).join(" ")}
      role={role}
    >
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {description ? <p className={styles.description}>{description}</p> : null}
      </header>
      {children ? <div className={styles.body}>{children}</div> : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </section>
  );
}
