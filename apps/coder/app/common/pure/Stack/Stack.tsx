import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import styles from "./Stack.module.css";

export function Stack({
  children,
  gap = 4,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  gap?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
}) {
  return (
    <div
      {...props}
      className={[styles.stack, props.className ?? ""].filter(Boolean).join(" ")}
      style={{ ...props.style, "--coder-stack-gap": `var(--coder-space-${gap})` } as CSSProperties}
    >
      {children}
    </div>
  );
}
