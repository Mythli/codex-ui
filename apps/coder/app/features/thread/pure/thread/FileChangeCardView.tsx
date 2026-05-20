import type { CodexTranscriptFile } from "@coder/types";
import { StatDelta } from "@app/common/pure";
import { DiffView } from "./DiffView";
import styles from "@app/common/pure/codex.module.css";

export function FileChangeCardView({
  additions,
  deletions,
  files,
  onReview,
  onShowMore,
  onUndo,
  showMoreLabel,
  title,
  undoDisabled,
  undoLabel
}: {
  additions: number;
  deletions: number;
  files: CodexTranscriptFile[];
  onReview?: () => void;
  onShowMore?: () => void;
  onUndo?: () => void;
  showMoreLabel?: string;
  title: string;
  undoDisabled?: boolean;
  undoLabel?: string;
}) {
  return (
    <section aria-label={title} className={styles.fileCard} data-testid="file-change-card">
      <header className={styles.fileCardHeader}>
        <div>
          <div className={styles.sectionTitle}>{title}</div>
          <div className={styles.muted}><StatDelta additions={additions} deletions={deletions} /></div>
        </div>
        <div className={styles.fileCardActions}>
          {onUndo ? (
            <button className={styles.iconButton} disabled={undoDisabled} onClick={onUndo} type="button">
              {undoLabel ?? "Undo ↶"}
            </button>
          ) : null}
          {onReview ? <button className={styles.reviewButton} onClick={onReview} type="button">Review</button> : null}
        </div>
      </header>
      <div className={styles.fileRows}>
        {files.map((file) => (
          <details className={styles.fileRow} key={file.path}>
            <summary>
              <span className={styles.truncate}>{file.path}</span>
              <StatDelta additions={file.additions} deletions={file.deletions} />
            </summary>
            <div className={styles.fileDiffDrawer}>
              <DiffView files={[file]} />
            </div>
          </details>
        ))}
        {onShowMore && showMoreLabel ? (
          <button className={styles.fileCardMore} data-testid="file-change-show-more" onClick={onShowMore} type="button">
            {showMoreLabel}
          </button>
        ) : null}
      </div>
    </section>
  );
}
