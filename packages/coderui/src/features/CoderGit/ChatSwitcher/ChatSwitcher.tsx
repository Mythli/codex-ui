import { type FormEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  FiChevronDown,
  FiCheck,
  FiColumns,
  FiEdit3,
  FiMessageSquare,
  FiMonitor,
  FiSearch,
  FiTrash2,
  FiX
} from "react-icons/fi";
import { LuEllipsis, LuFolder, LuFolderOpen, LuPlus } from "react-icons/lu";
import { Button, Input, Modal, Popover, Spinner } from "../../../common";
import type { CoderChatItem, CoderProjectChatGroup, CoderProjectItem } from "../../CoderCore/types";
import { ProjectPicker } from "../../CoderInterface/ProjectPicker";
import type { CoderShellViewMode } from "../../CoderInterface/TopBar";
import styles from "./ChatSwitcher.module.css";

export type CoderSwitcherChat = CoderChatItem;
export type CoderSwitcherProject = CoderProjectChatGroup;

const COLLAPSED_CHAT_COUNT = 5;

const viewModes = [
  { id: "chat", label: "Chat only", icon: FiMessageSquare },
  { id: "both", label: "Chat and preview", icon: FiColumns },
  { id: "preview", label: "Preview only", icon: FiMonitor }
] as const;

export function ChatSwitcher({
  activeChatId,
  error,
  groups,
  isLoading = false,
  onClose,
  onCreateChat,
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
        if (seenProjectIdsRef.current.has(group.id)) {
          continue;
        }
        seenProjectIdsRef.current.add(group.id);
        next ??= new Set(current);
        next.add(group.id);
      }
      return next ?? current;
    });
  }, [decoratedGroups]);

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
                        contentClassName={styles.menuSurface}
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
                  ).map((chat) => {
                    const hasDiffStats = typeof chat.additions === "number" || typeof chat.deletions === "number";

                    return (
                      <button
                        aria-current={chat.id === activeChatId ? "true" : undefined}
                        aria-label={`Open chat: ${chat.title}`}
                        className={[styles.chatItem, hasDiffStats ? styles.chatItemWithStats : "", chat.id === activeChatId ? styles.chatItemActive : ""]
                          .filter(Boolean)
                          .join(" ")}
                        data-running={chat.activity === "running" ? "true" : undefined}
                        data-chat-id={chat.id}
                        data-project-id={group.id}
                        data-testid="chat-switcher-chat"
                        data-unread={chat.unread ? "true" : undefined}
                        key={chat.id}
                        onClick={() => onSelectChat?.(chat.id, group.id)}
                        type="button"
                      >
                        <span className={styles.chatTitle}>{chat.title}</span>
                        {chat.activity === "running" ? (
                          <span
                            className={styles.activityDot}
                            aria-label="Chat is running"
                            data-testid="chat-switcher-chat-running"
                          />
                        ) : chat.unread ? (
                          <span
                            className={styles.unreadDot}
                            aria-label="Unread messages"
                            data-testid="chat-switcher-chat-unread"
                          />
                        ) : chat.updatedLabel ? (
                          <span className={styles.chatAge}>{chat.updatedLabel}</span>
                        ) : null}
                        {hasDiffStats ? (
                          <span className={styles.diffStats} aria-label="Changed lines">
                            {typeof chat.additions === "number" ? (
                              <span className={styles.additions}>+{chat.additions}</span>
                            ) : null}
                            {typeof chat.deletions === "number" ? (
                              <span className={styles.deletions}>-{chat.deletions}</span>
                            ) : null}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
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
          className={styles.contextMenu}
          onClick={(event) => event.stopPropagation()}
          role="menu"
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
    </section>
  );
}

function ProjectMenu({
  onRemove,
  onRename
}: {
  onRemove: () => void;
  onRename: () => void;
}) {
  return (
    <div className={styles.projectMenu} role="menu">
      <button className={styles.projectMenuItem} onClick={onRename} role="menuitem" type="button">
        <FiEdit3 aria-hidden="true" />
        <span>Rename</span>
      </button>
      <button className={[styles.projectMenuItem, styles.projectMenuItemDanger].join(" ")} onClick={onRemove} role="menuitem" type="button">
        <FiTrash2 aria-hidden="true" />
        <span>Remove</span>
      </button>
    </div>
  );
}

function RenameProjectModal({
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
    <Modal aria-label="Rename project" isOpen={isOpen} onClose={onClose} size="default" title="Rename project">
      <form className={styles.renameForm} onSubmit={onSubmit}>
        <p>Keep it short and recognizable</p>
        <Input
          aria-label="Project name"
          autoFocus
          className={styles.renameInput}
          onChange={(event) => onValueChange(event.target.value)}
          value={value}
        />
        <div className={styles.renameActions}>
          <Button onClick={onClose} type="button" variant="secondary">
            Cancel
          </Button>
          <Button disabled={!value.trim()} type="submit" variant="primary">
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function domId(prefix: string, value: string): string {
  return `${prefix}-${value.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}
