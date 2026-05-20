import { useState } from "react";
import type { CodexFileChangeEntry } from "@coder/types";
import { FileChangeCardView } from "../../pure/thread/FileChangeCardView";
import { FileReviewSidebar } from "../../pure/thread/FileReviewSidebar";
import { displayPath } from "../Transcript/transcriptFormatters";
import styles from "../Transcript/Transcript.module.css";

export function FileChangeCard({
  cwd,
  entry
}: {
  cwd?: string;
  entry: CodexFileChangeEntry;
}) {
  const [expanded, setExpanded] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const visibleFiles = expanded ? entry.files : entry.files.slice(0, 3);
  const hiddenCount = Math.max(0, entry.files.length - visibleFiles.length);
  const reviewFiles = entry.files.map((file) => ({
    additions: file.additions,
    deletions: file.deletions,
    diff: file.diff,
    path: displayPath(file.path, cwd)
  }));

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
        onReview={() => setReviewOpen(true)}
        onShowMore={hiddenCount > 0 ? () => setExpanded(true) : undefined}
        showMoreLabel={hiddenCount > 0 ? `Show ${hiddenCount} more ${hiddenCount === 1 ? "file" : "files"}` : undefined}
        title={entry.title}
      />
      <FileReviewSidebar
        additions={entry.additions}
        deletions={entry.deletions}
        files={reviewFiles}
        onClose={() => setReviewOpen(false)}
        open={reviewOpen}
        title={entry.title}
      />
    </section>
  );
}
