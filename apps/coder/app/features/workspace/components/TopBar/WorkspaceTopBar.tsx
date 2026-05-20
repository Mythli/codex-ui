import type { ReactNode } from "react";
import type { CodexProjectIndexItem } from "@coder/types";
import type { CoderShellViewMode } from "@coder/types";
import styles from "./WorkspaceTopBar.module.css";

export function WorkspaceTopBar({
  left,
  center,
  mode = "both",
  right,
  project
}: {
  left?: ReactNode;
  center?: ReactNode;
  mode?: CoderShellViewMode;
  right?: ReactNode;
  project: CodexProjectIndexItem;
}) {
  const topbarClassName = [
    styles.topbar,
    mode === "chat" ? styles.topbarChatOnly : "",
    mode === "preview" ? styles.topbarPreviewOnly : ""
  ].filter(Boolean).join(" ");

  return (
    <header className={topbarClassName}>
      <div className={styles.leftRail}>
        {left}
        <div className={styles.projectIdentity}>
          <span className={styles.projectName}>{project.name}</span>
        </div>
      </div>

      {mode !== "chat" ? (
        <div className={styles.previewRail}>
          <div className={styles.previewCenter}>
            {center ?? <div className={styles.topTitle}>{project.name}</div>}
          </div>
          {right ? <div className={styles.previewActions}>{right}</div> : null}
        </div>
      ) : null}
      {mode === "chat" ? (
        <div className={styles.chatActions}>
          {right}
        </div>
      ) : null}
    </header>
  );
}
