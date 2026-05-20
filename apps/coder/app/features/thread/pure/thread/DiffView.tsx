import { useMemo } from "react";
import { Diff,
  Hunk,
  parseDiff,
  DiffType,
  FileData,
  HunkData,
  ViewType } from "react-diff-view";
import type { CodexTranscriptFile } from "@coder/types";
import styles from "./DiffView.module.css";

type DiffViewProps = {
  files: CodexTranscriptFile[];
  maxFiles?: number;
  viewType?: ViewType;
};

export function DiffView({
  files,
  maxFiles,
  viewType = "unified"
}: DiffViewProps) {
  const parsedFiles = useMemo(() => {
    const visibleFiles = typeof maxFiles === "number" ? files.slice(0, maxFiles) : files;
    return visibleFiles.flatMap((file) => parseFileDiff(file));
  }, [files, maxFiles]);

  if (parsedFiles.length === 0) {
    return <div className={styles.empty}>Diff unavailable</div>;
  }

  return (
    <div className={styles.diffStack}>
      {parsedFiles.map((file, index) => (
        <section className={styles.file} key={`${file.oldPath}:${file.newPath}:${index}`}>
          <header className={styles.fileHeader}>
            <span className={styles.path}>{file.newPath || file.oldPath}</span>
          </header>
          {file.hunks.length > 0 ? (
            <div className={styles.tableWrap}>
              <Diff diffType={diffType(file)} hunks={file.hunks} viewType={viewType}>
                {(hunks: HunkData[]) => hunks.map((hunk: HunkData) => <Hunk hunk={hunk} key={hunk.content} />)}
              </Diff>
            </div>
          ) : (
            <div className={styles.empty}>No text diff for this file</div>
          )}
        </section>
      ))}
    </div>
  );
}

function parseFileDiff(file: CodexTranscriptFile): FileData[] {
  if (!file.diff?.trim()) {
    return [];
  }
  try {
    return parseDiff(normalizeDiff(file), { nearbySequences: "zip" });
  } catch {
    return [];
  }
}

function normalizeDiff(file: CodexTranscriptFile): string {
  const diff = file.diff?.endsWith("\n") ? file.diff : `${file.diff ?? ""}\n`;
  if (diff.startsWith("diff --git")) {
    return diff;
  }
  const escapedPath = file.path.replace(/\t/g, " ");
  return [`diff --git a/${escapedPath} b/${escapedPath}`, `--- a/${escapedPath}`, `+++ b/${escapedPath}`, diff].join("\n");
}

function diffType(file: FileData): DiffType {
  return file.type === "add" || file.type === "delete" || file.type === "rename" || file.type === "copy"
    ? file.type
    : "modify";
}
