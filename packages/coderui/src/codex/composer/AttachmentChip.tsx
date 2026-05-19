import { FiX } from "react-icons/fi";
import { FileTypeIcon } from "../FileTypeIcon";
import type { CodexAttachment } from "../types";
import styles from "../codex.module.css";

export function AttachmentChip({
  attachment,
  onRemove
}: {
  attachment: CodexAttachment;
  onRemove?: () => void;
}) {
  const previewUrl = attachment.previewUrl ?? attachment.dataUrl;
  return (
    <span className={styles.chip}>
      {attachment.kind === "image" && previewUrl ? (
        <img alt="" className={styles.chipThumbnail} src={previewUrl} />
      ) : (
        <FileTypeIcon file={attachment} />
      )}
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
