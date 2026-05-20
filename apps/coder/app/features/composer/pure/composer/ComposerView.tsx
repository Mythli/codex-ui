import { FiArrowUp } from "react-icons/fi";
import { Button } from "@app/common/pure";
import type { CoderComposerAttachment } from "@coder/types";
import { AttachmentChip } from "./AttachmentChip";
import styles from "@app/common/pure/codex.module.css";

export function ComposerView({
  attachments = [],
  canSubmit = false,
  isRunning = false,
  onPromptChange,
  onRemoveAttachment,
  onSubmit,
  placeholder = "Ask for follow-up changes",
  prompt
}: {
  attachments?: CoderComposerAttachment[];
  canSubmit?: boolean;
  isRunning?: boolean;
  onPromptChange?: (value: string) => void;
  onRemoveAttachment?: (id: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  prompt: string;
}) {
  return (
    <section aria-busy={isRunning || undefined} aria-label="Prompt composer" className={styles.composer}>
      <textarea
        aria-label="Chat input"
        className={styles.textarea}
        onChange={(event) => onPromptChange?.(event.target.value)}
        placeholder={placeholder}
        value={prompt}
      />
      {attachments.length ? (
        <div className={styles.chipList}>
          {attachments.map((attachment) => (
            <AttachmentChip
              attachment={attachment}
              key={attachment.id}
              onRemove={onRemoveAttachment ? () => onRemoveAttachment(attachment.id) : undefined}
            />
          ))}
        </div>
      ) : null}
      <div className={styles.toolbar}>
        <span className={styles.muted}>{isRunning ? "Running" : "Ready"}</span>
        <Button disabled={!canSubmit || isRunning} iconOnly onClick={onSubmit} title="Send" type="button">
          <FiArrowUp aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}
