import type { FormEvent } from "react";
import { FiCheck, FiColumns, FiEdit3, FiMessageSquare, FiMonitor, FiSearch, FiTrash2 } from "react-icons/fi";
import { Button, ConfirmDialogView, DialogView, Field, Input, MenuItem, MenuList, Modal } from "../../../common";
import type { CoderChatItem } from "../../CoderCore/types";
import type { CoderShellViewMode } from "../../CoderInterface/TopBar";
import styles from "./ChatSwitcher.module.css";

export const viewModes = [
  { id: "chat", label: "Chat only", icon: FiMessageSquare },
  { id: "both", label: "Chat and preview", icon: FiColumns },
  { id: "preview", label: "Preview only", icon: FiMonitor }
] as const;

export function ChatSearch({
  onQueryChange,
  query
}: {
  onQueryChange: (value: string) => void;
  query: string;
}) {
  return (
    <label className={styles.searchWrap}>
      <FiSearch aria-hidden="true" />
      <input
        aria-label="Search chats"
        className={styles.search}
        data-testid="chat-switcher-search"
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search chats"
        value={query}
      />
    </label>
  );
}

export function LayoutModeOptions({
  onViewModeChange,
  viewMode
}: {
  onViewModeChange: (mode: CoderShellViewMode) => void;
  viewMode: CoderShellViewMode;
}) {
  return (
    <div className={styles.layoutSection} aria-label="Workspace layout">
      <div className={styles.sectionLabel}>Layout</div>
      {viewModes.map((item) => {
        const Icon = item.icon;
        const isActive = item.id === viewMode;

        return (
          <button
            aria-current={isActive ? "true" : undefined}
            className={[styles.layoutOption, isActive ? styles.layoutOptionActive : ""].filter(Boolean).join(" ")}
            data-testid="workspace-mode-option"
            data-view-mode={item.id}
            key={item.id}
            onClick={() => onViewModeChange(item.id)}
            type="button"
          >
            <Icon aria-hidden="true" />
            <span>{item.label}</span>
            {isActive ? <FiCheck aria-hidden="true" /> : <span />}
          </button>
        );
      })}
    </div>
  );
}

export function ChatRow({
  activeChatId,
  chat,
  deletingChatId,
  onDeleteChat,
  onSelectChat,
  projectId
}: {
  activeChatId?: string;
  chat: CoderChatItem;
  deletingChatId?: string;
  onDeleteChat?: (chat: CoderChatItem, projectId: string) => void;
  onSelectChat?: (chatId: string, projectId: string) => void;
  projectId: string;
}) {
  const hasDiffStats = typeof chat.additions === "number" || typeof chat.deletions === "number";

  return (
    <div
      aria-current={chat.id === activeChatId ? "true" : undefined}
      aria-label={`Open chat: ${chat.title}`}
      className={[styles.chatItem, hasDiffStats ? styles.chatItemWithStats : "", chat.id === activeChatId ? styles.chatItemActive : ""]
        .filter(Boolean)
        .join(" ")}
      data-running={chat.activity === "running" ? "true" : undefined}
      data-chat-id={chat.id}
      data-project-id={projectId}
      data-testid="chat-switcher-chat"
      data-unread={chat.unread ? "true" : undefined}
      onClick={() => onSelectChat?.(chat.id, projectId)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectChat?.(chat.id, projectId);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <span className={styles.chatTitle}>{chat.title}</span>
      {chat.activity === "running" ? (
        <span className={styles.activityDot} aria-label="Chat is running" data-testid="chat-switcher-chat-running" />
      ) : chat.unread ? (
        <span className={styles.unreadDot} aria-label="Unread messages" data-testid="chat-switcher-chat-unread" />
      ) : chat.updatedLabel ? (
        <span className={styles.chatAge}>{chat.updatedLabel}</span>
      ) : null}
      {hasDiffStats ? (
        <span className={styles.diffStats} aria-label="Changed lines">
          {typeof chat.additions === "number" ? <span className={styles.additions}>+{chat.additions}</span> : null}
          {typeof chat.deletions === "number" ? <span className={styles.deletions}>-{chat.deletions}</span> : null}
        </span>
      ) : null}
      {onDeleteChat ? (
        <button
          aria-label={`Delete chat: ${chat.title}`}
          className={styles.chatDeleteButton}
          data-testid="chat-switcher-chat-delete"
          disabled={deletingChatId === chat.id}
          onClick={(event) => {
            event.stopPropagation();
            onDeleteChat(chat, projectId);
          }}
          title="Delete chat"
          type="button"
        >
          <FiTrash2 aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

export function ProjectMenu({
  onRemove,
  onRename
}: {
  onRemove: () => void;
  onRename: () => void;
}) {
  return (
    <MenuList>
      <MenuItem label="Rename" leadingIcon={<FiEdit3 aria-hidden="true" />} onSelect={onRename} />
      <MenuItem label="Remove" leadingIcon={<FiTrash2 aria-hidden="true" />} onSelect={onRemove} tone="danger" />
    </MenuList>
  );
}

export function RenameProjectModal({
  isOpen,
  onClose,
  onSubmit,
  onValueChange,
  value
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onValueChange: (value: string) => void;
  value: string;
}) {
  return (
    <Modal aria-label="Rename project" isOpen={isOpen} onClose={onClose} size="default">
      <form onSubmit={onSubmit}>
        <DialogView
          actions={(
            <>
              <Button onClick={onClose} type="button" variant="secondary">
                Cancel
              </Button>
              <Button disabled={!value.trim()} type="submit" variant="primary">
                Save
              </Button>
            </>
          )}
          description="Keep it short and recognizable"
          role="group"
          title="Rename project"
        >
          <Field label="Project name">
            <Input
              aria-label="Project name"
              autoFocus
              onChange={(event) => onValueChange(event.target.value)}
              value={value}
            />
          </Field>
        </DialogView>
      </form>
    </Modal>
  );
}

export function DeleteChatModal({
  error,
  isDeleting,
  isOpen,
  onClose,
  onConfirm,
  title
}: {
  error?: string;
  isDeleting: boolean;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
}) {
  return (
    <Modal aria-label="Delete chat" isOpen={isOpen} onClose={onClose} size="compact">
      <ConfirmDialogView
        confirmText="Delete"
        error={error}
        isLoading={isDeleting}
        loadingText="Deleting"
        message={`Delete "${title || "this chat"}" from the chat list?`}
        onCancel={onClose}
        onConfirm={onConfirm}
        role="group"
        title="Delete chat"
        variant="danger"
      />
    </Modal>
  );
}

export function domId(prefix: string, value: string): string {
  return `${prefix}-${value.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}
