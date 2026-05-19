import { FiFile, FiX } from "react-icons/fi";
import type { CodexAttachment } from "../types";
import styles from "../codex.module.css";

export function AttachmentChip({
  attachment,
  onRemove
}: {
  attachment: CodexAttachment;
  onRemove?: () => void;
}) {
  return (
    <span className={styles.chip}>
      <FiFile aria-hidden="true" />
      <span className={styles.truncate}>{attachment.name}</span>
      <span className={styles.muted}>{attachment.sizeLabel}</span>
      {onRemove ? (
        <button aria-label={`Remove ${attachment.name}`} className={styles.iconButton} onClick={onRemove} type="button">
          <FiX aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}
