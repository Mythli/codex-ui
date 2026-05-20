import type { CodexThreadTokenUsage } from "@coder/types";
import type { CodexAppServerModel } from "@coder/types";
import type {
  CoderComposerAttachment,
  CoderPermissionMode,
  CoderReasoningEffort
} from "@coder/types";
import { CodexChatBox } from "../ChatBox/CodexChatBox";
import styles from "./Composer.module.css";

export function Composer({
  attachments = [],
  isRunning = false,
  models,
  onAddAttachments,
  onPromptChange,
  onRemoveAttachment,
  onSelectModel,
  onSelectPermissionMode,
  onSelectReasoningEffort,
  onBeforeSubmitPrompt,
  onSubmitPrompt,
  prompt,
  selectedPermissionMode = "default",
  selectedModel,
  selectedReasoningEffort,
  tokenUsage
}: {
  attachments?: CoderComposerAttachment[];
  isRunning?: boolean;
  models: CodexAppServerModel[];
  onAddAttachments?: (attachments: CoderComposerAttachment[]) => void;
  onPromptChange: (value: string) => void;
  onRemoveAttachment?: (attachmentId: string) => void;
  onSelectModel: (id: string) => void;
  onSelectPermissionMode?: (value: CoderPermissionMode) => void;
  onSelectReasoningEffort: (value: CoderReasoningEffort) => void;
  onBeforeSubmitPrompt?: () => void;
  onSubmitPrompt?: () => void;
  prompt: string;
  selectedPermissionMode?: CoderPermissionMode;
  selectedModel: string;
  selectedReasoningEffort: CoderReasoningEffort;
  tokenUsage?: CodexThreadTokenUsage;
}) {
  return (
    <footer
      aria-label="Prompt composer footer"
      className={styles.composer}
      data-testid="composer-footer"
    >
      <CodexChatBox
        attachments={attachments}
        isRunning={isRunning}
        models={models}
        onAddAttachments={onAddAttachments}
        onPromptChange={onPromptChange}
        onRemoveAttachment={onRemoveAttachment}
        onSelectModel={onSelectModel}
        onSelectPermissionMode={onSelectPermissionMode}
        onSelectReasoningEffort={onSelectReasoningEffort}
        onBeforeSubmit={onBeforeSubmitPrompt}
        onSubmit={onSubmitPrompt}
        prompt={prompt}
        selectedPermissionMode={selectedPermissionMode}
        selectedModel={selectedModel}
        selectedReasoningEffort={selectedReasoningEffort}
        tokenUsage={tokenUsage}
      />
    </footer>
  );
}
