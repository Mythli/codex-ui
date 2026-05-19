import { useCallback, useEffect, useRef, useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { FiMenu } from "react-icons/fi";
import { Button } from "../../common";
import type { MarkdownComponents } from "../../common";
import {
  ChatSwitcher,
  type CoderSwitcherProject
} from "../CoderGit/ChatSwitcher";
import { CoderSidebar } from "./Sidebar";
import { PreviewFrame, type PreviewViewport } from "./PreviewFrame";
import { PreviewControls, type CoderShellViewMode } from "./TopBar";
import type {
  CoderChatItem,
  CoderComposerAttachment,
  CoderContextUsage,
  CoderModelItem,
  CoderPermissionMode,
  CoderProjectChatGroup,
  CoderProjectItem,
  CoderReasoningEffort
} from "../CoderCore/types";
import type { ChatPaneState } from "../CoderCore/store/derivedState";
import styles from "./CoderShell.module.css";

export type { CoderChatItem, CoderModelItem, CoderProjectChatGroup, CoderProjectItem };

const SWITCHER_ANIMATION_MS = 220;

export function CoderShell({
  attachments = [],
  chatGroups,
  chatPane,
  currentChatId,
  currentChatTitle,
  isLoading = false,
  isRunning = false,
  initialViewMode = "both",
  initialSwitcherOpen = false,
  loadingError,
  markdownComponents,
  models,
  onAddAttachments,
  onNewChat,
  onPromptChange,
  onRemoveAttachment,
  onSelectChat,
  onSelectModel,
  onSelectPermissionMode,
  onSelectReasoningEffort,
  onSubmitPrompt,
  previewUrl,
  prompt,
  project,
  selectedPermissionMode = "default",
  selectedModel,
  selectedReasoningEffort,
  contextUsage,
  transcriptNowMs,
}: {
  attachments?: CoderComposerAttachment[];
  chatGroups: CoderProjectChatGroup[];
  chatPane: ChatPaneState;
  currentChatId?: string;
  currentChatTitle: string;
  isLoading?: boolean;
  isRunning?: boolean;
  initialViewMode?: CoderShellViewMode;
  initialSwitcherOpen?: boolean;
  loadingError?: string;
  markdownComponents?: MarkdownComponents;
  models: CoderModelItem[];
  onAddAttachments?: (attachments: CoderComposerAttachment[]) => void;
  onNewChat?: (projectId?: string) => void;
  onPromptChange: (value: string) => void;
  onRemoveAttachment?: (attachmentId: string) => void;
  onSelectChat?: (id: string, projectId: string) => void;
  onSelectModel: (id: string) => void;
  onSelectPermissionMode?: (value: CoderPermissionMode) => void;
  onSelectReasoningEffort: (value: CoderReasoningEffort) => void;
  onSubmitPrompt?: () => void;
  previewUrl?: string;
  prompt: string;
  project: CoderProjectItem;
  selectedPermissionMode?: CoderPermissionMode;
  selectedModel: string;
  selectedReasoningEffort: CoderReasoningEffort;
  contextUsage?: CoderContextUsage;
  transcriptNowMs?: number;
}) {
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(initialSwitcherOpen);
  const [isSwitcherClosing, setIsSwitcherClosing] = useState(false);
  const [hasOpenedSwitcher, setHasOpenedSwitcher] = useState(initialSwitcherOpen);
  const [switcherQuery, setSwitcherQuery] = useState("");
  const [viewMode, setViewMode] = useState<CoderShellViewMode>(initialViewMode);
  const [previewViewport, setPreviewViewport] = useState<PreviewViewport>("desktop");
  const [previewReloadKey, setPreviewReloadKey] = useState(0);
  const closeTimerRef = useRef<number | undefined>(undefined);

  const openSwitcher = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = undefined;
    }

    setHasOpenedSwitcher(true);
    setIsSwitcherClosing(false);
    setIsSwitcherOpen(true);
  }, []);

  const closeSwitcher = useCallback(() => {
    if (!isSwitcherOpen || isSwitcherClosing) {
      return;
    }

    setIsSwitcherClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setIsSwitcherOpen(false);
      setIsSwitcherClosing(false);
      closeTimerRef.current = undefined;
    }, SWITCHER_ANIMATION_MS);
  }, [isSwitcherClosing, isSwitcherOpen]);

  useEffect(() => {
    if (!isSwitcherOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSwitcher();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeSwitcher, isSwitcherOpen]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const projectOptions = projectList(chatGroups, project);

  const sidebar = (
    <CoderSidebar
      attachments={attachments}
      currentChatTitle={currentChatTitle}
      chatPane={chatPane}
      isRunning={isRunning}
      markdownComponents={markdownComponents}
      models={models}
      onAddAttachments={onAddAttachments}
      onNewChat={onNewChat}
      onPromptChange={onPromptChange}
      onRemoveAttachment={onRemoveAttachment}
      onSelectModel={onSelectModel}
      onSelectPermissionMode={onSelectPermissionMode}
      onSelectReasoningEffort={onSelectReasoningEffort}
      onSubmitPrompt={onSubmitPrompt}
      onToggleSwitcher={() => {
        if (isSwitcherOpen && !isSwitcherClosing) {
          closeSwitcher();
        } else {
          openSwitcher();
        }
      }}
      project={project}
      projects={projectOptions}
      prompt={prompt}
      selectedPermissionMode={selectedPermissionMode}
      selectedModel={selectedModel}
      selectedReasoningEffort={selectedReasoningEffort}
      contextUsage={contextUsage}
      transcriptNowMs={transcriptNowMs}
    />
  );

  const preview = (
    <section className={styles.previewPanel}>
      <header className={styles.previewToolbar}>
        <PreviewControls
          onOpenExternal={() => {
            if (previewUrl) {
              window.open(previewUrl, "_blank", "noopener,noreferrer");
            }
          }}
          onReload={() => setPreviewReloadKey((key) => key + 1)}
          onViewportChange={setPreviewViewport}
          previewUrl={previewUrl}
          viewport={previewViewport}
        />
      </header>
      <div className={styles.workspace}>
        <PreviewFrame previewUrl={previewUrl} reloadKey={previewReloadKey} viewport={previewViewport} />
      </div>
    </section>
  );
  const switcherState = isSwitcherClosing ? "closing" : isSwitcherOpen ? "open" : "closed";

  return (
    <main
      aria-label="Coder workspace"
      className={styles.shell}
      data-current-chat-id={currentChatId}
      data-testid="coder-shell"
    >
      {hasOpenedSwitcher ? (
        <>
          <button
            aria-label="Close chats"
            className={[styles.switcherScrim, isSwitcherClosing ? styles.switcherScrimClosing : ""]
              .filter(Boolean)
              .join(" ")}
            data-state={switcherState}
            disabled={!isSwitcherOpen || isSwitcherClosing}
            onClick={closeSwitcher}
            type="button"
          />
          <div
            aria-hidden={!isSwitcherOpen}
            aria-label="Chat switcher"
            className={[styles.switcherPanel, isSwitcherClosing ? styles.switcherPanelClosing : ""]
              .filter(Boolean)
              .join(" ")}
            data-state={switcherState}
            data-testid="chat-switcher-panel"
            role="dialog"
          >
            <ChatSwitcher
              activeChatId={currentChatId}
              error={loadingError}
              groups={chatGroups}
              isLoading={isLoading}
              onClose={closeSwitcher}
              onCreateChat={(projectId) => {
                onNewChat?.(projectId);
                closeSwitcher();
              }}
              projects={projectOptions}
              onQueryChange={setSwitcherQuery}
              onSelectChat={(chatId, projectId) => {
                onSelectChat?.(chatId, projectId);
                closeSwitcher();
              }}
              onViewModeChange={setViewMode}
              query={switcherQuery}
              viewMode={viewMode}
            />
          </div>
        </>
      ) : null}

      {viewMode === "preview" ? (
        <div className={styles.modeDock}>
          <Button
            aria-label="Open sidebar"
            data-testid="workspace-menu-button"
            iconOnly
            onClick={() => {
              if (isSwitcherOpen && !isSwitcherClosing) {
                closeSwitcher();
              } else {
                openSwitcher();
              }
            }}
            title="Open sidebar"
            type="button"
            variant="ghost"
          >
            <FiMenu aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      {viewMode === "chat" ? sidebar : null}
      {viewMode === "preview" ? preview : null}
      {viewMode === "both" ? (
        <Group
          className={styles.panels}
          defaultLayout={{ chat: 1, preview: 1 }}
          id="coder-shell-layout"
          orientation="horizontal"
          resizeTargetMinimumSize={{ coarse: 44, fine: 12 }}
        >
          <Panel className={styles.panel} collapsible defaultSize={1} id="chat" minSize={20}>
            {sidebar}
          </Panel>
          <Separator className={styles.resizeHandle}>
            <span className={styles.resizeGrip} />
          </Separator>
          <Panel className={styles.panel} collapsible defaultSize={1} id="preview" minSize={20}>
            {preview}
          </Panel>
        </Group>
      ) : null}
    </main>
  );
}

function projectList(
  groups: CoderProjectChatGroup[],
  currentProject: CoderProjectItem
): CoderProjectItem[] {
  const projects = groups.map((group) => ({
    id: group.id,
    name: group.name
  }));
  if (!projects.some((project) => project.id === currentProject.id)) {
    projects.push(currentProject);
  }
  return projects;
}
