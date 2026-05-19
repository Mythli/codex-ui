import { useState } from "react";
import type { CodexFileChangeEntry } from "@taylordb/codex";
import { FiFilePlus } from "react-icons/fi";
import styles from "../../Transcript/Transcript.module.css";

export function FileChangeCard({
  cwd,
  entry
}: {
  cwd?: string;
  entry: CodexFileChangeEntry;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleFiles = expanded ? entry.files : entry.files.slice(0, 3);
  const hiddenCount = Math.max(0, entry.files.length - visibleFiles.length);

  return (
    <section
      aria-label={entry.title}
      className={styles.fileCard}
      data-testid="file-change-card"
      data-work-entry-type="fileChange"
    >
      <header className={styles.fileCardHeader}>
        <span className={styles.fileCardIcon} aria-hidden>
          <FiFilePlus />
        </span>
        <div className={styles.fileCardTitleGroup}>
          <div className={styles.fileCardTitle}>{entry.title}</div>
          <div className={styles.fileCardStats}>
            <span className={styles.additions}>+{entry.additions}</span>
            <span className={styles.deletions}>-{entry.deletions}</span>
          </div>
        </div>
        <div className={styles.fileCardActions}>
          <button data-testid="file-change-undo" type="button">Undo</button>
          <button data-testid="file-change-review" type="button">Review</button>
        </div>
      </header>
      <div className={styles.fileRows}>
        {visibleFiles.map((file) => (
          <details
            className={styles.fileRow}
            data-file-path={file.path}
            data-testid="file-change-file"
            key={file.path}
          >
            <summary>
              <span className={styles.filePath}>{displayPath(file.path, cwd)}</span>
              <span className={styles.fileStats}>
                <span className={styles.additions}>+{file.additions ?? 0}</span>
                <span className={styles.deletions}>-{file.deletions ?? 0}</span>
              </span>
            </summary>
            {file.diff ? <pre className={`${styles.output} coder-scrollbar-thin`}>{file.diff}</pre> : null}
          </details>
        ))}
      </div>
      {hiddenCount > 0 ? (
        <button className={styles.fileCardMore} data-testid="file-change-show-more" onClick={() => setExpanded(true)} type="button">
          Show {hiddenCount} more {hiddenCount === 1 ? "file" : "files"}
        </button>
      ) : null}
    </section>
  );
}

function displayPath(path: string, cwd: string | undefined): string {
  if (!cwd) {
    return path;
  }
  const normalizedCwd = stripTrailingSlash(cwd);
  return path === normalizedCwd
    ? "."
    : path.startsWith(`${normalizedCwd}/`)
      ? path.slice(normalizedCwd.length + 1)
      : path;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
