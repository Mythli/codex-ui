import type { CodexFileChange } from "../types";
import { StatDelta } from "../../common";
import styles from "../codex.module.css";

export function FileChangeCardView({
  additions,
  deletions,
  files,
  title
}: {
  additions: number;
  deletions: number;
  files: CodexFileChange[];
  title: string;
}) {
  return (
    <section aria-label={title} className={styles.fileCard} data-testid="file-change-card">
      <header className={styles.fileCardHeader}>
        <div>
          <div className={styles.sectionTitle}>{title}</div>
          <div className={styles.muted}><StatDelta additions={additions} deletions={deletions} /></div>
        </div>
        <button className={styles.iconButton} type="button">Review</button>
      </header>
      <div className={styles.fileRows}>
        {files.map((file) => (
          <div className={styles.fileRow} key={file.path}>
            <span className={styles.truncate}>{file.path}</span>
            <StatDelta additions={file.additions} deletions={file.deletions} />
          </div>
        ))}
      </div>
    </section>
  );
}
