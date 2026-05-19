import type {
  CoderComposerAttachment,
  CoderContextUsage,
  CoderModelItem,
  CoderPermissionMode,
  CoderReasoningEffort
} from "../../../CoderCore/types";
import { CodexChatBox } from "../../Composer/CodexChatBox";
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
  onSubmitPrompt,
  prompt,
  selectedPermissionMode = "default",
  selectedModel,
  selectedReasoningEffort,
  contextUsage
}: {
  attachments?: CoderComposerAttachment[];
  isRunning?: boolean;
  models: CoderModelItem[];
  onAddAttachments?: (attachments: CoderComposerAttachment[]) => void;
  onPromptChange: (value: string) => void;
  onRemoveAttachment?: (attachmentId: string) => void;
  onSelectModel: (id: string) => void;
  onSelectPermissionMode?: (value: CoderPermissionMode) => void;
  onSelectReasoningEffort: (value: CoderReasoningEffort) => void;
  onSubmitPrompt?: () => void;
  prompt: string;
  selectedPermissionMode?: CoderPermissionMode;
  selectedModel: string;
  selectedReasoningEffort: CoderReasoningEffort;
  contextUsage?: CoderContextUsage;
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
        onSubmit={onSubmitPrompt}
        prompt={prompt}
        selectedPermissionMode={selectedPermissionMode}
        selectedModel={selectedModel}
        selectedReasoningEffort={selectedReasoningEffort}
        contextUsage={contextUsage}
      />
    </footer>
  );
}
