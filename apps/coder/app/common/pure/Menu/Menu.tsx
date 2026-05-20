import type { ReactNode } from "react";
import styles from "./Menu.module.css";

export function MenuList({
  "data-testid": dataTestId,
  children,
  className,
  label
}: {
  "data-testid"?: string;
  children: ReactNode;
  className?: string;
  label?: ReactNode;
}) {
  return (
    <div className={[styles.list, className ?? ""].filter(Boolean).join(" ")} data-testid={dataTestId} role="menu">
      {label ? <div className={styles.header}>{label}</div> : null}
      {children}
    </div>
  );
}

export function MenuItem({
  "aria-current": ariaCurrent,
  "data-testid": dataTestId,
  "data-viewport": dataViewport,
  description,
  disabled,
  label,
  leadingIcon,
  onSelect,
  selected,
  trailing,
  tone = "default"
}: {
  "aria-current"?: "page" | "step" | "location" | "date" | "time" | "true" | "false" | boolean;
  "data-testid"?: string;
  "data-viewport"?: string;
  description?: ReactNode;
  disabled?: boolean;
  label: ReactNode;
  leadingIcon?: ReactNode;
  onSelect?: () => void | Promise<void>;
  selected?: boolean;
  trailing?: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <button
      aria-current={ariaCurrent ?? (selected ? "true" : undefined)}
      className={[styles.item, leadingIcon ? "" : styles.itemNoIcon, trailing ? "" : styles.itemNoTrailing, selected ? styles.itemSelected : "", tone === "danger" ? styles.danger : ""]
        .filter(Boolean)
        .join(" ")}
      data-testid={dataTestId}
      data-viewport={dataViewport}
      disabled={disabled}
      onClick={onSelect}
      role="menuitem"
      type="button"
    >
      {leadingIcon ? <span className={styles.icon}>{leadingIcon}</span> : null}
      <span className={styles.label}>{label}</span>
      {description ? <span className={styles.description}>{description}</span> : null}
      {trailing ? <span className={styles.trailing}>{trailing}</span> : null}
    </button>
  );
}
