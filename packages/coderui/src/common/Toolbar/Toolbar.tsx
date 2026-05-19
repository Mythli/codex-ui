import type { ReactNode } from "react";
import styles from "./Toolbar.module.css";

export function Toolbar({ children }: { children: ReactNode }) {
  return <header className={styles.toolbar}>{children}</header>;
}

Toolbar.Left = function ToolbarLeft({ children }: { children: ReactNode }) {
  return <div className={styles.left}>{children}</div>;
};

Toolbar.Center = function ToolbarCenter({ children }: { children: ReactNode }) {
  return <div className={styles.center}>{children}</div>;
};

Toolbar.Right = function ToolbarRight({ children }: { children: ReactNode }) {
  return <div className={styles.right}>{children}</div>;
};

Toolbar.Title = function ToolbarTitle({ title }: { title: string }) {
  return <div className={styles.title}>{title}</div>;
};
