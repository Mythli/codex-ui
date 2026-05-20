import { Spinner, type MarkdownComponents } from "@app/common/pure";
import type {
  CodexProjectIndexItem,
  CodexRenderBlock,
  CodexThreadState,
  CodexThreadTokenUsage
} from "@taylordb/codex";
import type { CodexAppServerModel } from "@taylordb/codex/protocol";
import type {
  CoderComposerAttachment,
  CoderPermissionMode,
  CoderReasoningEffort
} from "../../../composer/types";
import { Composer } from "../../../composer/components/Composer/Composer";
import { CodexChatView } from "../../../conversation/components/Transcript/CodexChatView";
import { PromptHome } from "../PromptHome/PromptHome";
import { SidebarHeader } from "./SidebarHeader";
import styles from "./CoderSidebar.module.css";

export function CoderSidebar({
  attachments = [],
  activeThread,
  currentChatTitle,
  hydratingThreadIds,
  isHydratingThread = false,
  isRunning = false,
  markdownComponents,
  models,
  onAddAttachments,
  onNewChat,
  onPromptChange,
  onRemoveAttachment,
  onSelectModel,
  onSelectPermissionMode,
  onSelectReasoningEffort,
  onBeforeSubmitPrompt,
  onSubmitPrompt,
  onToggleSwitcher,
  project,
  projects,
  prompt,
  renderBlocks,
  selectedChatId,
  selectedDraftId,
  selectedPermissionMode = "default",
  selectedModel,
  selectedReasoningEffort,
  threadIndexError,
  tokenUsage,
  transcriptNowMs,
}: {
  attachments?: CoderComposerAttachment[];
  activeThread?: CodexThreadState;
  currentChatTitle: string;
  hydratingThreadIds: readonly string[];
  isHydratingThread?: boolean;
  isRunning?: boolean;
  markdownComponents?: MarkdownComponents;
  models: CodexAppServerModel[];
  onAddAttachments?: (attachments: CoderComposerAttachment[]) => void;
  onNewChat?: (projectId?: string) => void;
  onPromptChange: (value: string) => void;
  onRemoveAttachment?: (attachmentId: string) => void;
  onSelectModel: (id: string) => void;
  onSelectPermissionMode?: (value: CoderPermissionMode) => void;
  onSelectReasoningEffort: (value: CoderReasoningEffort) => void;
  onBeforeSubmitPrompt?: () => void;
  onSubmitPrompt?: () => void;
  onToggleSwitcher: () => void;
  project: CodexProjectIndexItem;
  projects: CodexProjectIndexItem[];
  prompt: string;
  renderBlocks: readonly CodexRenderBlock[];
  selectedChatId?: string;
  selectedDraftId?: string;
  selectedPermissionMode?: CoderPermissionMode;
  selectedModel: string;
  selectedReasoningEffort: CoderReasoningEffort;
  threadIndexError?: string;
  tokenUsage?: CodexThreadTokenUsage;
  transcriptNowMs?: number;
}) {
  return (
    <aside
      aria-label="Coder chat panel"
      className={styles.sidebar}
      data-testid="coder-chat-panel"
    >
      <SidebarHeader
        chatTitle={currentChatTitle}
        onNewChat={onNewChat}
        onToggleSwitcher={onToggleSwitcher}
        project={project}
        projects={projects}
      />
      <ChatPane
        activeThread={activeThread}
        currentChatTitle={currentChatTitle}
        hydratingThreadIds={hydratingThreadIds}
        isHydratingThread={isHydratingThread}
        markdownComponents={markdownComponents}
        onPromptChange={onPromptChange}
        renderBlocks={renderBlocks}
        selectedChatId={selectedChatId}
        selectedDraftId={selectedDraftId}
        threadIndexError={threadIndexError}
        transcriptNowMs={transcriptNowMs}
      />
      <Composer
        attachments={attachments}
        isRunning={isRunning}
        models={models}
        onAddAttachments={onAddAttachments}
        onPromptChange={onPromptChange}
        onRemoveAttachment={onRemoveAttachment}
        onSelectModel={onSelectModel}
        onSelectPermissionMode={onSelectPermissionMode}
        onSelectReasoningEffort={onSelectReasoningEffort}
        onBeforeSubmitPrompt={onBeforeSubmitPrompt}
        onSubmitPrompt={onSubmitPrompt}
        prompt={prompt}
        selectedPermissionMode={selectedPermissionMode}
        selectedModel={selectedModel}
        selectedReasoningEffort={selectedReasoningEffort}
        tokenUsage={tokenUsage}
      />
    </aside>
  );
}

function ChatPane({
  activeThread,
  currentChatTitle,
  hydratingThreadIds,
  isHydratingThread,
  markdownComponents,
  onPromptChange,
  renderBlocks,
  selectedChatId,
  selectedDraftId,
  threadIndexError,
  transcriptNowMs
}: {
  activeThread?: CodexThreadState;
  currentChatTitle: string;
  hydratingThreadIds: readonly string[];
  isHydratingThread: boolean;
  markdownComponents?: MarkdownComponents;
  onPromptChange: (value: string) => void;
  renderBlocks: readonly CodexRenderBlock[];
  selectedChatId?: string;
  selectedDraftId?: string;
  threadIndexError?: string;
  transcriptNowMs?: number;
}) {
  if (threadIndexError) {
    return (
      <section className={styles.chatHome} aria-label="Chat error" data-testid="chat-error" role="alert">
        <p className={styles.errorText}>{threadIndexError}</p>
      </section>
    );
  }
  if (renderBlocks.length > 0) {
    return <CodexChatView blocks={renderBlocks} markdownComponents={markdownComponents} nowMs={transcriptNowMs} />;
  }
  if (activeThread?.status === "failed") {
    return (
      <section className={styles.chatHome} aria-label="Chat error" data-testid="chat-error" role="alert">
        <p className={styles.errorText}>{activeThread.error ?? "Failed to load chat."}</p>
      </section>
    );
  }
  if (selectedDraftId) {
    if (activeThread?.isProvisionalThread && activeThread.status === "loading") {
      return <LoadingChatStatus title={currentChatTitle} />;
    }
    return (
      <section className={styles.chatHome} aria-label="Chat home" data-testid="chat-home">
        <PromptHome onSelectStarter={onPromptChange} />
      </section>
    );
  }
  if (!selectedChatId) {
    return (
      <section className={styles.chatHome} aria-label="Chat home" data-testid="chat-home">
        <PromptHome onSelectStarter={onPromptChange} />
      </section>
    );
  }
  if (isHydratingThread || hydratingThreadIds.includes(selectedChatId) || !activeThread || activeThread.status === "loading") {
    return <LoadingChatStatus title={currentChatTitle} />;
  }
  return (
    <section className={styles.chatStatus} aria-label="Loaded empty chat" data-testid="chat-empty">
      <span>This chat is empty.</span>
    </section>
  );
}

function LoadingChatStatus({ title }: { title?: string }) {
  return (
    <output aria-busy="true" className={styles.chatStatus} aria-label="Loading existing chat" data-testid="chat-loading">
      <Spinner />
      <span>{title ? `Loading ${title}` : "Loading chat"}</span>
    </output>
  );
}
