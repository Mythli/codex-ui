import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type {
  FormEvent,
  MouseEvent
} from "react";
import {
  FiChevronDown,
  FiEdit3,
  FiX
} from "react-icons/fi";
import { LuEllipsis,
  LuFolder,
  LuFolderOpen,
  LuPlus } from "react-icons/lu";
import type { CodexProjectIndexItem } from "@coder/types";
import type {
  CodexThreadIndexItem,
  CodexThreadIndexState
} from "@coder/types";
import { Button, Popover, Spinner } from "@app/common/pure";
import type { CoderShellViewMode } from "@coder/types";
import { ProjectPicker } from "../ProjectPicker/ProjectPicker";
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

const COLLAPSED_CHAT_COUNT = 5;

type ProjectSection = {
  cwd: string;
  name: string;
  threadIds: string[];
};

export function ChatSwitcher({
  activeChatId,
  error,
  isLoading = false,
  onClose,
  onCreateChat,
  onDeleteChat,
  onSelectChat,
  onViewModeChange,
  projects,
  query,
  onQueryChange,
  threadIndex,
  title = "Chats",
  unreadThreadIds,
  viewMode
}: {
  activeChatId?: string;
  error?: string;
  isLoading?: boolean;
  onClose?: () => void;
  onCreateChat?: (projectId?: string) => void;
  onDeleteChat?: (chatId: string, projectId: string) => Promise<void> | void;
  onSelectChat?: (chatId: string, projectId: string) => void;
  onViewModeChange: (mode: CoderShellViewMode) => void;
  projects: CodexProjectIndexItem[];
  query: string;
  onQueryChange: (value: string) => void;
  threadIndex: CodexThreadIndexState;
  title?: string;
  unreadThreadIds: readonly string[];
  viewMode: CoderShellViewMode;
}) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const [hiddenProjects, setHiddenProjects] = useState<Set<string>>(() => new Set());
  const [renamedProjects, setRenamedProjects] = useState<Record<string, string>>({});
  const [renameProject, setRenameProject] = useState<ProjectSection | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteChat, setDeleteChat] = useState<{ chat: CodexThreadIndexItem; projectId: string } | null>(null);
  const [deletingChatId, setDeletingChatId] = useState<string | undefined>();
  const [deleteError, setDeleteError] = useState<string | undefined>();
  const [contextMenu, setContextMenu] = useState<{
    project: ProjectSection;
    x: number;
    y: number;
  } | null>(null);
  const seenProjectIdsRef = useRef<Set<string>>(new Set());
  const normalizedQuery = query.trim().toLowerCase();
  const unread = useMemo(() => new Set(unreadThreadIds), [unreadThreadIds]);
  const decoratedGroups = useMemo(
    () => projectSections(threadIndex, hiddenProjects, renamedProjects),
    [hiddenProjects, renamedProjects, threadIndex]
  );
  const visibleGroups = decoratedGroups
    .map((group) => ({
      ...group,
      chats: group.threadIds
        .map((threadId) => threadIndex.threadsById[threadId])
        .filter((chat): chat is CodexThreadIndexItem => Boolean(chat))
        .filter((chat) => normalizedQuery ? chat.title.toLowerCase().includes(normalizedQuery) : true)
    }))
    .filter((group) => group.chats.length > 0);

  useEffect(() => {
    setCollapsedGroups((current) => {
      let next: Set<string> | undefined;
      for (const group of decoratedGroups) {
        const hasActiveChat = group.threadIds.includes(activeChatId ?? "");
        if (seenProjectIdsRef.current.has(group.cwd)) {
          if (hasActiveChat && current.has(group.cwd)) {
            next ??= new Set(current);
            next.delete(group.cwd);
          }
          continue;
        }
        seenProjectIdsRef.current.add(group.cwd);
        if (hasActiveChat) {
          continue;
        }
        next ??= new Set(current);
        next.add(group.cwd);
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

  const openRenameModal = (project: ProjectSection) => {
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
        [renameProject.cwd]: nextName
      }));
    }
    setRenameProject(null);
  };

  const submitDeleteChat = async () => {
    if (!deleteChat || !onDeleteChat) {
      setDeleteChat(null);
      return;
    }
    setDeletingChatId(deleteChat.chat.threadId);
    setDeleteError(undefined);
    try {
      await onDeleteChat(deleteChat.chat.threadId, deleteChat.projectId);
      setDeleteChat(null);
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : "Could not delete chat");
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

      <section
        aria-busy={isLoading || undefined}
        aria-label="Chat groups"
        className={styles.groups}
        data-testid="chat-switcher-groups"
      >
        {isLoading ? (
          <output aria-label="Loading chats" className={styles.loading} data-testid="chat-switcher-loading">
            <Spinner />
          </output>
        ) : error ? (
          <div className={styles.empty} data-testid="chat-switcher-error" role="alert">{error}</div>
        ) : visibleGroups.length > 0 ? (
          <>
            <div className={styles.sectionLabel}>Projects</div>
            {visibleGroups.map((group) => {
              const isCollapsed = !normalizedQuery && collapsedGroups.has(group.cwd);
              const FolderIcon = isCollapsed ? LuFolder : LuFolderOpen;

              return (
                <section
                  aria-labelledby={domId("chat-group", group.cwd)}
                  className={styles.group}
                  data-project-id={group.cwd}
                  data-testid="chat-switcher-project"
                  key={group.cwd}
                >
                  <div
                    className={styles.groupHeader}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setContextMenu({
                        project: group,
                        x: event.clientX,
                        y: event.clientY
                      });
                    }}
                  >
                    <button
                      aria-expanded={!isCollapsed}
                      aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${group.name}`}
                      className={styles.projectToggleButton}
                      id={domId("chat-group", group.cwd)}
                      onClick={() => toggleGroup(group.cwd)}
                      type="button"
                    >
                      <FolderIcon aria-hidden="true" />
                      <span>{group.name}</span>
                    </button>
                    <div className={styles.projectActions}>
                      <button
                        aria-label={`New chat in ${group.name}`}
                        className={styles.projectIconButton}
                        data-testid="chat-switcher-project-new-chat"
                        onClick={() => onCreateChat?.(group.cwd)}
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
                              const onClick = props.onClick as ((event: MouseEvent<HTMLButtonElement>) => void) | undefined;
                              if (onClick) {
                                onClick(event);
                              }
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
                              removeProject(group.cwd);
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
                    {(normalizedQuery || !collapsedGroups.has(group.cwd)
                    ? group.chats
                    : group.chats.slice(0, COLLAPSED_CHAT_COUNT)
                  ).map((chat) => (
                    <ChatRow
                      activeChatId={activeChatId}
                      chat={chat}
                      deletingChatId={deletingChatId}
                      key={chat.threadId}
                      onDeleteChat={onDeleteChat
                        ? (targetChat, projectId) => {
                          setDeleteError(undefined);
                          setDeleteChat({ chat: targetChat, projectId });
                        }
                        : undefined}
                      onSelectChat={onSelectChat}
                      projectId={group.cwd}
                      unread={unread.has(chat.threadId)}
                    />
                  ))}
                  {!normalizedQuery && group.chats.length > COLLAPSED_CHAT_COUNT ? (
                    <button
                      aria-expanded={!collapsedGroups.has(group.cwd)}
                      aria-label={`${collapsedGroups.has(group.cwd) ? "Show more chats" : "Show fewer chats"} in ${group.name}`}
                      className={styles.showMore}
                      data-project-id={group.cwd}
                      data-testid="chat-switcher-show-more"
                      onClick={() => toggleGroup(group.cwd)}
                      type="button"
                    >
                      <span>{collapsedGroups.has(group.cwd) ? "Show more" : "Show less"}</span>
                      <FiChevronDown
                        aria-hidden="true"
                        className={!collapsedGroups.has(group.cwd) ? styles.showMoreIconExpanded : styles.showMoreIcon}
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
      </section>
      {contextMenu ? (
        <div
          className={styles.contextMenuPosition}
          style={{
            left: contextMenu.x,
            top: contextMenu.y
          }}
        >
          <ProjectMenu
            onRemove={() => removeProject(contextMenu.project.cwd)}
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
        isDeleting={Boolean(deleteChat && deletingChatId === deleteChat.chat.threadId)}
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

function projectSections(
  threadIndex: CodexThreadIndexState,
  hiddenProjects: ReadonlySet<string>,
  renamedProjects: Record<string, string>
): ProjectSection[] {
  const sections: ProjectSection[] = [];
  const assignedThreadIds = new Set<string>();
  for (const cwd of threadIndex.projectOrder) {
    const project = threadIndex.projectsByCwd[cwd];
    if (!project || hiddenProjects.has(project.cwd)) {
      continue;
    }
    for (const threadId of project.threadIds) {
      assignedThreadIds.add(threadId);
    }
    sections.push({
      cwd: project.cwd,
      name: renamedProjects[project.cwd] ?? project.name,
      threadIds: project.threadIds
    });
  }

  const looseThreadIds = threadIndex.threadOrder.filter((threadId) => !assignedThreadIds.has(threadId));
  if (looseThreadIds.length > 0 && !hiddenProjects.has("uncategorized")) {
    sections.push({
      cwd: "uncategorized",
      name: renamedProjects.uncategorized ?? "Uncategorized",
      threadIds: looseThreadIds
    });
  }
  return sections;
}
