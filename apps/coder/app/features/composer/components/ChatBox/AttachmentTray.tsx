import { FiX } from "react-icons/fi";
import { FileTypeIcon } from "@app/common/pure";
import type { CoderComposerAttachment } from "@coder/types";
import { formatAttachmentSize } from "../../io/attachmentIO";
import styles from "./CodexChatBox.module.css";

export function AttachmentTray({
  attachmentError,
  attachments,
  onRemoveAttachment
}: {
  attachmentError?: string;
  attachments: CoderComposerAttachment[];
  onRemoveAttachment?: (attachmentId: string) => void;
}) {
  if (attachments.length === 0 && !attachmentError) {
    return null;
  }
  // Empty-state is intentionally omitted so selected attachments only render when present.

  return (
    <div aria-label="Selected attachments" className={styles.attachmentTray} data-testid="composer-attachments">
      {attachments.map((attachment) => (
        <div className={styles.attachmentChip} data-testid="composer-attachment" key={attachment.id}>
          {attachment.kind === "image" && attachment.dataUrl ? (
            <img alt="" className={styles.attachmentThumb} src={attachment.dataUrl} />
          ) : (
            <span className={styles.attachmentFileIcon}><FileTypeIcon file={attachment} /></span>
          )}
          <span className={styles.attachmentText}>
            <span className={styles.attachmentName}>{attachment.name}</span>
            <span className={styles.attachmentMeta}>{formatAttachmentSize(attachment.size)}</span>
          </span>
          <button
            aria-label={`Remove ${attachment.name}`}
            className={styles.attachmentRemove}
            onClick={() => onRemoveAttachment?.(attachment.id)}
            type="button"
          >
            <FiX aria-hidden="true" />
          </button>
        </div>
      ))}
      {attachmentError ? <p className={styles.attachmentError} data-testid="composer-attachment-error">{attachmentError}</p> : null}
    </div>
  );
}
