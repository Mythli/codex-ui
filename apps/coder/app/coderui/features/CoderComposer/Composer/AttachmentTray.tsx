import { FiFile, FiX } from "react-icons/fi";
import type { CoderComposerAttachment } from "../../CoderCore/types";
import { formatAttachmentSize } from "./attachmentIO";
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

  return (
    <div className={styles.attachmentTray} data-testid="composer-attachments">
      {attachments.map((attachment) => (
        <div className={styles.attachmentChip} key={attachment.id}>
          {attachment.kind === "image" && attachment.dataUrl ? (
            <img alt="" className={styles.attachmentThumb} src={attachment.dataUrl} />
          ) : (
            <span className={styles.attachmentFileIcon}><FiFile aria-hidden="true" /></span>
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
      {attachmentError ? <p className={styles.attachmentError}>{attachmentError}</p> : null}
    </div>
  );
}
