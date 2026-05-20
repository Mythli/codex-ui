import { FiX } from "react-icons/fi";
import type { CodexTranscriptAttachment } from "@taylordb/codex";
import { FileTypeIcon } from "@app/common/pure/FileTypeIcon";
import type { CoderComposerAttachment } from "../../types";
import { formatAttachmentSize } from "../../io/attachmentIO";
import styles from "@app/common/pure/codex.module.css";

type AttachmentChipItem = CoderComposerAttachment | CodexTranscriptAttachment;

export function AttachmentChip({
  attachment,
  onRemove
}: {
  attachment: AttachmentChipItem;
  onRemove?: () => void;
}) {
  const previewUrl = "dataUrl" in attachment ? attachment.dataUrl ?? attachment.assetUrl : undefined;
  const sizeLabel = "sizeLabel" in attachment && attachment.sizeLabel
    ? attachment.sizeLabel
    : "size" in attachment
      ? formatAttachmentSize(attachment.size)
      : "";
  return (
    <span className={styles.chip}>
      {attachment.kind === "image" && previewUrl ? (
        <img alt="" className={styles.chipThumbnail} src={previewUrl} />
      ) : (
        <FileTypeIcon file={attachment} />
      )}
      <span className={styles.truncate}>{attachment.name}</span>
      {sizeLabel ? <span className={styles.muted}>{sizeLabel}</span> : null}
      {onRemove ? (
        <button aria-label={`Remove ${attachment.name}`} className={styles.iconButton} onClick={onRemove} type="button">
          <FiX aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}
