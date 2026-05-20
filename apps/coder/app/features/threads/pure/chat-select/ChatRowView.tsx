import { FiTrash2 } from "react-icons/fi";
import type { CodexThreadIndexItem } from "@coder/types";
import styles from "@app/common/pure/codex.module.css";

export function ChatRowView({
  chat,
  isActive = false,
  isDeleting = false,
  isUnread = false,
  onDelete,
  onSelect
}: {
  chat: CodexThreadIndexItem;
  isActive?: boolean;
  isDeleting?: boolean;
  isUnread?: boolean;
  onDelete?: () => void;
  onSelect?: () => void;
}) {
  const updatedLabel = formatUpdatedLabel(chat.updatedAt);
  return (
    <div
      aria-current={isActive ? "true" : undefined}
      className={[styles.row, isActive ? styles.rowActive : ""].filter(Boolean).join(" ")}
      data-chat-id={chat.threadId}
      data-running={chat.activity === "running" ? "true" : undefined}
      data-unread={isUnread ? "true" : undefined}
    >
      <button className={styles.rowMainButton} onClick={onSelect} type="button">
        <span className={styles.rowTitle}>{chat.title}</span>
      </button>
      {chat.activity === "running" ? <span aria-label="Running" className={[styles.dot, styles.dotRunning].join(" ")} /> : null}
      {isUnread && chat.activity !== "running" ? <span aria-label="Unread" className={[styles.dot, styles.dotUnread].join(" ")} /> : null}
      {!isUnread && chat.activity !== "running" && updatedLabel ? <span className={styles.muted}>{updatedLabel}</span> : null}
      {onDelete ? (
        <button
          aria-label={`Delete ${chat.title}`}
          className={styles.dangerButton}
          disabled={isDeleting}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          type="button"
        >
          <FiTrash2 aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function formatUpdatedLabel(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return undefined;
  }
  const diffMs = Date.now() - timestamp;
  if (diffMs < 60_000) {
    return "now";
  }
  if (diffMs < 60 * 60_000) {
    return `${Math.floor(diffMs / 60_000)}m`;
  }
  if (diffMs < 24 * 60 * 60_000) {
    return `${Math.floor(diffMs / (60 * 60_000))}h`;
  }
  return `${Math.floor(diffMs / (24 * 60 * 60_000))}d`;
}
