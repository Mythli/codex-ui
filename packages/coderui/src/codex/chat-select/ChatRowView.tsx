import { FiTrash2 } from "react-icons/fi";
import type { CodexChatRow } from "../types";
import styles from "../codex.module.css";

export function ChatRowView({
  chat,
  isActive = false,
  isDeleting = false,
  onDelete,
  onSelect
}: {
  chat: CodexChatRow;
  isActive?: boolean;
  isDeleting?: boolean;
  onDelete?: () => void;
  onSelect?: () => void;
}) {
  return (
    <div
      aria-current={isActive ? "true" : undefined}
      className={[styles.row, isActive ? styles.rowActive : ""].filter(Boolean).join(" ")}
      data-chat-id={chat.id}
      data-running={chat.activity === "running" ? "true" : undefined}
      data-unread={chat.unread ? "true" : undefined}
      role="button"
      tabIndex={0}
      onClick={onSelect}
    >
      <span className={styles.rowTitle}>{chat.title}</span>
      {chat.activity === "running" ? <span aria-label="Running" className={[styles.dot, styles.dotRunning].join(" ")} /> : null}
      {chat.unread && chat.activity !== "running" ? <span aria-label="Unread" className={[styles.dot, styles.dotUnread].join(" ")} /> : null}
      {!chat.unread && chat.activity !== "running" && chat.updatedLabel ? <span className={styles.muted}>{chat.updatedLabel}</span> : null}
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
