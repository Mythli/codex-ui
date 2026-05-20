import type { ReactNode } from "react";
import styles from "@app/common/pure/codex.module.css";

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
