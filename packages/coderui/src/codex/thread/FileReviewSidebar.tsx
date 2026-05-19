import { FiX } from "react-icons/fi";
import { IconButton, SlidingSidebar, StatDelta } from "../../common";
import type { CodexFileChange } from "../types";
import { DiffView } from "./DiffView";
import styles from "./FileReviewSidebar.module.css";

export type FileReviewSidebarProps = {
  additions: number;
  deletions: number;
  files: CodexFileChange[];
  onClose: () => void;
  open: boolean;
  title: string;
};

export function FileReviewSidebar({
  additions,
  deletions,
  files,
  onClose,
  open,
  title
}: FileReviewSidebarProps) {
  return (
    <SlidingSidebar aria-label="Review file changes" className={styles.sidebar} onClose={onClose} open={open} side="right">
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.title}>{title}</div>
          <div className={styles.stats}><StatDelta additions={additions} deletions={deletions} /></div>
        </div>
        <IconButton label="Close review" onClick={onClose} variant="ghost">
          <FiX aria-hidden="true" />
        </IconButton>
      </header>
      <div className={styles.content}>
        <DiffView files={files} viewType="unified" />
      </div>
    </SlidingSidebar>
  );
}
