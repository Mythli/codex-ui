import { type FormEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  FiChevronDown,
  FiEdit3,
  FiX
} from "react-icons/fi";
import { LuEllipsis, LuFolder, LuFolderOpen, LuPlus } from "react-icons/lu";
import { Button, Popover, Spinner } from "../../../common";
import type { CoderChatItem, CoderProjectChatGroup, CoderProjectItem } from "../../CoderCore/types";
import { ProjectPicker } from "../../CoderInterface/ProjectPicker";
import type { CoderShellViewMode } from "../../CoderInterface/TopBar";
import {
  ChatRow,
  ChatSearch,
  DeleteChatModal,
  domId,
  LayoutModeOptions,
  ProjectMenu,
  RenameProjectModal
} from "./ChatSwitcherPrimitives";
import styles from "./ChatSwitcher.module.css";

export type CoderSwitcherChat = CoderChatItem;
export type CoderSwitcherProject = CoderProjectChatGroup;

const COLLAPSED_CHAT_COUNT = 5;

export function ChatSwitcher({
  activeChatId,
  error,
  groups,
  isLoading = false,
  onClose,
  onCreateChat,
  onDeleteChat,
  onSelectChat,
  onViewModeChange,
  projects,
  query,
  onQueryChange,
  title = "Chats",
  viewMode
}: {
  activeChatId?: string;
  error?: string;
  groups: CoderSwitcherProject[];
  isLoading?: boolean;
  onClose?: () => void;
  onCreateChat?: (projectId?: string) => void;
  onDeleteChat?: (chatId: string, projectId: string) => Promise<void> | void;
  onSelectChat?: (chatId: string, projectId: string) => void;
  onViewModeChange: (mode: CoderShellViewMode) => void;
  projects: CoderProjectItem[];
  query: string;
  onQueryChange: (value: string) => void;
  title?: string;
  viewMode: CoderShellViewMode;
}) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const [hiddenProjects, setHiddenProjects] = useState<Set<string>>(() => new Set());
  const [renamedProjects, setRenamedProjects] = useState<Record<string, string>>({});
  const [renameProject, setRenameProject] = useState<CoderSwitcherProject | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteChat, setDeleteChat] = useState<{ chat: CoderSwitcherChat; projectId: string } | null>(null);
  const [deletingChatId, setDeletingChatId] = useState<string | undefined>();
  const [deleteError, setDeleteError] = useState<string | undefined>();
  const [contextMenu, setContextMenu] = useState<{
    project: CoderSwitcherProject;
    x: number;
    y: number;
  } | null>(null);
  const seenProjectIdsRef = useRef<Set<string>>(new Set());
  const normalizedQuery = query.trim().toLowerCase();
  const decoratedGroups = useMemo(
    () => groups
      .filter((group) => !hiddenProjects.has(group.id))
      .map((group) => ({
        ...group,
        name: renamedProjects[group.id] ?? group.name
      })),
    [groups, hiddenProjects, renamedProjects]
  );
  const visibleGroups = decoratedGroups
    .map((group) => ({
      ...group,
      chats: normalizedQuery
        ? group.chats.filter((chat) => chat.title.toLowerCase().includes(normalizedQuery))
        : group.chats
    }))
    .filter((group) => group.chats.length > 0);

  useEffect(() => {
    setCollapsedGroups((current) => {
      let next: Set<string> | undefined;
      for (const group of decoratedGroups) {
        const hasActiveChat = group.chats.some((chat) => chat.id === activeChatId);
        if (seenProjectIdsRef.current.has(group.id)) {
          if (hasActiveChat && current.has(group.id)) {
            next ??= new Set(current);
            next.delete(group.id);
          }
          continue;
        }
        seenProjectIdsRef.current.add(group.id);
        if (hasActiveChat) {
          continue;
        }
        next ??= new Set(current);
        next.add(group.id);
      }
      return next ?? current;
    });
  }, [activeChatId, decoratedGroups]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("keydown", close);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", close);
      window.removeEventListener("resize", close);
    };
  }, [contextMenu]);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const openRenameModal = (project: CoderSwitcherProject) => {
    setContextMenu(null);
    setRenameProject(project);
    setRenameValue(project.name);
  };

  const removeProject = (projectId: string) => {
    setContextMenu(null);
    setHiddenProjects((current) => new Set(current).add(projectId));
  };

  const submitRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!renameProject) {
      return;
    }

    const nextName = renameValue.trim();
    if (nextName) {
      setRenamedProjects((current) => ({
        ...current,
        [renameProject.id]: nextName
      }));
    }
    setRenameProject(null);
  };

  const submitDeleteChat = async () => {
    if (!deleteChat || !onDeleteChat) {
      setDeleteChat(null);
      return;
    }
    setDeletingChatId(deleteChat.chat.id);
    setDeleteError(undefined);
    try {
      await onDeleteChat(deleteChat.chat.id, deleteChat.projectId);
      setDeleteChat(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Could not delete chat");
    } finally {
      setDeletingChatId(undefined);
    }
  };

  return (
    <section
      aria-label={title}
      className={styles.switcher}
      data-testid="chat-switcher"
    >
      <header className={styles.header}>
        <span />
        {onClose ? (
          <Button data-testid="chat-switcher-close" iconOnly onClick={onClose} title="Close chats" variant="ghost">
            <FiX />
          </Button>
        ) : null}
      </header>

      <div className={styles.actions}>
        <ProjectPicker
          onSelectProject={(projectId) => onCreateChat?.(projectId)}
          placement="bottom-start"
          projects={projects}
          renderTrigger={({ ref, props }) => (
            <button
              {...props}
              aria-label="Create new chat"
              className={styles.actionItem}
              data-testid="chat-switcher-new-chat"
              ref={ref}
              type="button"
            >
              <FiEdit3 aria-hidden="true" />
              <span>New chat</span>
            </button>
          )}
        >
          New chat in
        </ProjectPicker>
        <ChatSearch onQueryChange={onQueryChange} query={query} />
        <LayoutModeOptions onViewModeChange={onViewModeChange} viewMode={viewMode} />
      </div>

      <div
        aria-busy={isLoading || undefined}
        aria-label="Chat groups"
        className={styles.groups}
        data-testid="chat-switcher-groups"
        role="region"
      >
        {isLoading ? (
          <div aria-label="Loading chats" className={styles.loading} data-testid="chat-switcher-loading" role="status">
            <Spinner />
          </div>
        ) : error ? (
          <div className={styles.empty} data-testid="chat-switcher-error" role="alert">{error}</div>
        ) : visibleGroups.length > 0 ? (
          <>
            <div className={styles.sectionLabel}>Projects</div>
            {visibleGroups.map((group) => {
              const isCollapsed = !normalizedQuery && collapsedGroups.has(group.id);
              const FolderIcon = isCollapsed ? LuFolder : LuFolderOpen;

              return (
                <section
                  aria-labelledby={domId("chat-group", group.id)}
                  className={styles.group}
                  data-project-id={group.id}
                  data-testid="chat-switcher-project"
                  key={group.id}
                >
                  <div
                    aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${group.name}`}
                    aria-expanded={!isCollapsed}
                    className={styles.groupHeader}
                    id={domId("chat-group", group.id)}
                    onClick={() => toggleGroup(group.id)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setContextMenu({
                        project: group,
                        x: event.clientX,
                        y: event.clientY
                      });
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleGroup(group.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className={styles.projectIdentity}>
                      <FolderIcon aria-hidden="true" />
                      <span>{group.name}</span>
                    </div>
                    <div className={styles.projectActions}>
                      <button
                        aria-label={`New chat in ${group.name}`}
                        className={styles.projectIconButton}
                        data-testid="chat-switcher-project-new-chat"
                        onClick={(event) => {
                          event.stopPropagation();
                          onCreateChat?.(group.id);
                        }}
                        title="New chat"
                        type="button"
                      >
                        <LuPlus aria-hidden="true" />
                      </button>
                      <Popover
                        offsetPx={4}
                        placement="bottom-end"
                        renderTrigger={({ ref, props }) => (
                          <button
                            {...props}
                            aria-label={`Edit ${group.name}`}
                            className={styles.projectIconButton}
                            data-testid="chat-switcher-project-edit"
                            onClick={(event) => {
                              event.stopPropagation();
                              (props.onClick as ((event: MouseEvent<HTMLButtonElement>) => void) | undefined)?.(event);
                            }}
                            ref={ref}
                            title="Edit project"
                            type="button"
                          >
                            <LuEllipsis aria-hidden="true" />
                          </button>
                        )}
                      >
                        {({ close }) => (
                          <ProjectMenu
                            onRemove={() => {
                              removeProject(group.id);
                              close();
                            }}
                            onRename={() => {
                              openRenameModal(group);
                              close();
                            }}
                          />
                        )}
                      </Popover>
                    </div>
                  </div>
                  <div className={styles.chatList} data-testid="chat-switcher-project-chats" hidden={isCollapsed}>
                    {(normalizedQuery || !collapsedGroups.has(group.id)
                    ? group.chats
                    : group.chats.slice(0, COLLAPSED_CHAT_COUNT)
                  ).map((chat) => (
                    <ChatRow
                      activeChatId={activeChatId}
                      chat={chat}
                      deletingChatId={deletingChatId}
                      key={chat.id}
                      onDeleteChat={onDeleteChat
                        ? (targetChat, projectId) => {
                          setDeleteError(undefined);
                          setDeleteChat({ chat: targetChat, projectId });
                        }
                        : undefined}
                      onSelectChat={onSelectChat}
                      projectId={group.id}
                    />
                  ))}
                  {!normalizedQuery && group.chats.length > COLLAPSED_CHAT_COUNT ? (
                    <button
                      aria-expanded={!collapsedGroups.has(group.id)}
                      aria-label={`${collapsedGroups.has(group.id) ? "Show more chats" : "Show fewer chats"} in ${group.name}`}
                      className={styles.showMore}
                      data-project-id={group.id}
                      data-testid="chat-switcher-show-more"
                      onClick={() => toggleGroup(group.id)}
                      type="button"
                    >
                      <span>{collapsedGroups.has(group.id) ? "Show more" : "Show less"}</span>
                      <FiChevronDown
                        aria-hidden="true"
                        className={!collapsedGroups.has(group.id) ? styles.showMoreIconExpanded : styles.showMoreIcon}
                      />
                    </button>
                  ) : null}
                </div>
              </section>
            );
            })}
            <div className={styles.sectionLabel}>Chats</div>
          </>
        ) : (
          <div className={styles.empty} data-testid="chat-switcher-empty">No chats found</div>
        )}
      </div>
      {contextMenu ? (
        <div
          className={styles.contextMenuPosition}
          onClick={(event) => event.stopPropagation()}
          style={{
            left: contextMenu.x,
            top: contextMenu.y
          }}
        >
          <ProjectMenu
            onRemove={() => removeProject(contextMenu.project.id)}
            onRename={() => openRenameModal(contextMenu.project)}
          />
        </div>
      ) : null}
      <RenameProjectModal
        isOpen={Boolean(renameProject)}
        onClose={() => setRenameProject(null)}
        onSubmit={submitRename}
        onValueChange={setRenameValue}
        value={renameValue}
      />
      <DeleteChatModal
        error={deleteError}
        isDeleting={Boolean(deleteChat && deletingChatId === deleteChat.chat.id)}
        isOpen={Boolean(deleteChat)}
        onClose={() => {
          if (!deletingChatId) {
            setDeleteChat(null);
            setDeleteError(undefined);
          }
        }}
        onConfirm={submitDeleteChat}
        title={deleteChat?.chat.title ?? ""}
      />
    </section>
  );
}
