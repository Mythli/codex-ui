import type { CodexAttachment } from "../types";
import { AttachmentChip } from "./AttachmentChip";
import styles from "../codex.module.css";

export function AttachmentTrayView({
  attachments,
  onRemove
}: {
  attachments: CodexAttachment[];
  onRemove?: (id: string) => void;
}) {
  if (attachments.length === 0) {
    return null;
  }
  return (
    <div className={styles.chipList}>
      {attachments.map((attachment) => (
        <AttachmentChip attachment={attachment} key={attachment.id} onRemove={() => onRemove?.(attachment.id)} />
      ))}
    </div>
  );
}
