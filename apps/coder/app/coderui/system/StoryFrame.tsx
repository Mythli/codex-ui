import type { CSSProperties, ReactNode } from "react";

export function StoryFrame({
  children,
  flush = false,
  maxWidth
}: {
  children: ReactNode;
  flush?: boolean;
  maxWidth?: number | string;
}) {
  const style = {
    background: "var(--coder-bg)",
    color: "var(--coder-text)",
    minHeight: "100vh",
    padding: flush ? 0 : 24
  } satisfies CSSProperties;

  return (
    <div style={style}>
      <div style={{ maxWidth, minWidth: 0 }}>{children}</div>
    </div>
  );
}
