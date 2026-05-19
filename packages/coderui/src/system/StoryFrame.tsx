import type { ReactNode } from "react";

export function StoryFrame({
  children,
  maxWidth
}: {
  children: ReactNode;
  maxWidth?: number;
}) {
  return <div style={{ maxWidth, padding: 24 }}>{children}</div>;
}
