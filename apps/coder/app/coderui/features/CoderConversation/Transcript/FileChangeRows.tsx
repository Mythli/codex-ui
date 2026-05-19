import type { CodexFileChangeEntry } from "@taylordb/codex";
import { FiEdit3 } from "react-icons/fi";
import { TextShimmer } from "../../../common";
import { FileChangeCard } from "../pure/Transcript/FileChangeCard";
import { ActivityChildRow } from "./ActivityRows";
import { DetailLine } from "./WorkDetails";
import {
  displayFileName,
  displayPath,
  getFileChangeAction,
  getFileChangePastAction
} from "./transcriptFormatters";
import { isActiveStatus } from "./transcriptState";
import styles from "./Transcript.module.css";

export function FileChangeSummaryCard({ cwd, entry }: { cwd?: string; entry: CodexFileChangeEntry }) {
  if (isActiveStatus(entry.status)) {
    return <FileChangeProgressRow cwd={cwd} entry={entry} />;
  }
  return <FileChangeCard cwd={cwd} entry={entry} />;
}

export function FileChangeTimelineRow({ cwd, entry }: { cwd?: string; entry: CodexFileChangeEntry }) {
  if (isActiveStatus(entry.status)) {
    return <FileChangeProgressRow cwd={cwd} entry={entry} />;
  }
  return (
    <ActivityChildRow defaultExpanded={entry.defaultExpanded} icon="file" status={entry.status} title={entry.title}>
      <FileChangeDetails cwd={cwd} entry={entry} />
    </ActivityChildRow>
  );
}

export function FileChangeDetails({ cwd, entry }: { cwd?: string; entry: CodexFileChangeEntry }) {
  return (
    <section aria-label="File change details" className={styles.toolDetails} data-testid="file-change-details" data-work-entry-type="fileChange">
      {entry.files.map((file) => (
        <DetailLine key={file.path}>
          {displayPath(file.path, cwd)} <span className={styles.additions}>+{file.additions ?? 0}</span> <span className={styles.deletions}>-{file.deletions ?? 0}</span>
        </DetailLine>
      ))}
    </section>
  );
}

export function FileChangeTimelineFiles({ cwd, entry }: { cwd?: string; entry: CodexFileChangeEntry }) {
  return (
    <div className={styles.fileTimelineList}>
      {entry.files.map((file) => {
        const action = getFileChangePastAction(file.action, file.additions ?? 0, file.deletions ?? 0);
        return (
          <div className={styles.fileTimelineRow} data-testid="work-file-change-row" key={file.path}>
            <span className={styles.fileTimelineAction}>{action}</span>
            <span className={styles.fileTimelinePath}>{displayFileName(file.path, cwd)}</span>
            <span className={styles.additions}>+{file.additions ?? 0}</span>
            <span className={styles.deletions}>-{file.deletions ?? 0}</span>
            <span aria-hidden="true" className={styles.changeDot} />
          </div>
        );
      })}
    </div>
  );
}

export function FileChangeProgressRow({ cwd, entry }: { cwd?: string; entry: CodexFileChangeEntry }) {
  const file = entry.files.at(-1) ?? entry.files[0];
  const additions = file?.additions ?? entry.additions;
  const deletions = file?.deletions ?? entry.deletions;
  const action = getFileChangeAction(entry.title, additions, deletions);

  return (
    <div
      aria-label={file ? `${action} ${displayFileName(file.path, cwd)}` : action}
      className={styles.fileProgressRow}
      data-testid="file-change-progress"
      data-work-entry-state={entry.status}
      data-work-entry-type="fileChange"
    >
      <FiEdit3 aria-hidden="true" className={styles.workIcon} />
      <span className={styles.fileProgressAction}><TextShimmer>{action}</TextShimmer></span>
      {file ? <span className={styles.fileProgressPath}>{displayFileName(file.path, cwd)}</span> : null}
      <span className={styles.additions}>+{additions}</span>
      <span className={styles.deletions}>-{deletions}</span>
    </div>
  );
}
