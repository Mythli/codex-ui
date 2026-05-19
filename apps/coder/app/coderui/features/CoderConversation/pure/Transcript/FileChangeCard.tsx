import { useState } from "react";
import type { CodexFileChangeEntry } from "@taylordb/codex";
import { FileChangeCardView } from "@taylordb/coderui";
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
    <section className={styles.message_fileChanges}>
      <FileChangeCardView
        additions={entry.additions}
        deletions={entry.deletions}
        files={visibleFiles.map((file) => ({
          additions: file.additions,
          deletions: file.deletions,
          diff: file.diff,
          path: displayPath(file.path, cwd)
        }))}
        title={entry.title}
      />
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
