import type { ReactNode } from "react";
import styles from "../codex.module.css";

export function SidebarView({
  children,
  collapsed = false
}: {
  children: ReactNode;
  collapsed?: boolean;
}) {
  return (
    <aside className={[styles.sidebar, collapsed ? styles.sidebarCollapsed : ""].filter(Boolean).join(" ")}>
      {children}
    </aside>
  );
}
