import { FiCheck, FiGitBranch } from "react-icons/fi";
import type { CodexVersionRow } from "../types";
import styles from "../codex.module.css";

export function VersionRowView({
  isActive = false,
  isPending = false,
  onSelect,
  version
}: {
  isActive?: boolean;
  isPending?: boolean;
  onSelect?: () => void;
  version: CodexVersionRow;
}) {
  return (
    <button className={[styles.row, isActive ? styles.rowActive : ""].filter(Boolean).join(" ")} disabled={isActive || isPending} onClick={onSelect} type="button">
      <FiGitBranch aria-hidden="true" />
      <span className={styles.truncate}>{version.label}: {version.message}</span>
      <span className={styles.muted}>{isPending ? "Switching" : version.meta}</span>
      {isActive ? <FiCheck aria-hidden="true" /> : null}
    </button>
  );
}
