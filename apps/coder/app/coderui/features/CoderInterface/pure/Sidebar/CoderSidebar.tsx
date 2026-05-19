import { Spinner, type MarkdownComponents } from "../../../../common";
import { PromptHome } from "../../PromptHome";
import { CodexChatView } from "../../../CoderConversation/Transcript";
import { Composer } from "../../../CoderComposer";
import type {
  CoderComposerAttachment,
  CoderContextUsage,
  CoderModelItem,
  CoderPermissionMode,
  CoderProjectItem,
  CoderReasoningEffort
} from "../../../CoderCore/types";
import type { ChatPaneState } from "../../../CoderCore/store/derivedState";
import { SidebarHeader } from "./SidebarHeader";
import styles from "./CoderSidebar.module.css";

export function CoderSidebar({
  attachments = [],
  chatPane,
  currentChatTitle,
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
  onSubmitPrompt,
  onToggleSwitcher,
  project,
  projects,
  prompt,
  selectedPermissionMode = "default",
  selectedModel,
  selectedReasoningEffort,
  contextUsage,
  transcriptNowMs,
}: {
  attachments?: CoderComposerAttachment[];
  chatPane: ChatPaneState;
  currentChatTitle: string;
  isRunning?: boolean;
  markdownComponents?: MarkdownComponents;
  models: CoderModelItem[];
  onAddAttachments?: (attachments: CoderComposerAttachment[]) => void;
  onNewChat?: (projectId?: string) => void;
  onPromptChange: (value: string) => void;
  onRemoveAttachment?: (attachmentId: string) => void;
  onSelectModel: (id: string) => void;
  onSelectPermissionMode?: (value: CoderPermissionMode) => void;
  onSelectReasoningEffort: (value: CoderReasoningEffort) => void;
  onSubmitPrompt?: () => void;
  onToggleSwitcher: () => void;
  project: CoderProjectItem;
  projects: CoderProjectItem[];
  prompt: string;
  selectedPermissionMode?: CoderPermissionMode;
  selectedModel: string;
  selectedReasoningEffort: CoderReasoningEffort;
  contextUsage?: CoderContextUsage;
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
        markdownComponents={markdownComponents}
        onPromptChange={onPromptChange}
        state={chatPane}
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
        onSubmitPrompt={onSubmitPrompt}
        prompt={prompt}
        selectedPermissionMode={selectedPermissionMode}
        selectedModel={selectedModel}
        selectedReasoningEffort={selectedReasoningEffort}
        contextUsage={contextUsage}
      />
    </aside>
  );
}

function ChatPane({
  markdownComponents,
  onPromptChange,
  state,
  transcriptNowMs
}: {
  markdownComponents?: MarkdownComponents;
  onPromptChange: (value: string) => void;
  state: ChatPaneState;
  transcriptNowMs?: number;
}) {
  switch (state.kind) {
    case "ready":
      return <CodexChatView blocks={state.blocks} markdownComponents={markdownComponents} nowMs={transcriptNowMs} />;
    case "loading":
      return (
        <section aria-busy="true" className={styles.chatStatus} aria-label="Loading existing chat" data-testid="chat-loading" role="status">
          <Spinner />
          <span>{state.title ? `Loading ${state.title}` : "Loading chat"}</span>
        </section>
      );
    case "empty":
      return (
        <section className={styles.chatStatus} aria-label="Loaded empty chat" data-testid="chat-empty">
          <span>This chat is empty.</span>
        </section>
      );
    case "error":
      return (
        <section className={styles.chatHome} aria-label="Chat error" data-testid="chat-error" role="alert">
          <p className={styles.errorText}>{state.message}</p>
        </section>
      );
    case "home":
      return (
        <section className={styles.chatHome} aria-label="Chat home" data-testid="chat-home">
          <PromptHome onSelectStarter={onPromptChange} />
        </section>
      );
  }
}
