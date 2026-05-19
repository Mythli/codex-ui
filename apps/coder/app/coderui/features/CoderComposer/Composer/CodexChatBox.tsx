import {
  FiArrowUp,
  FiMic,
  FiPlus
} from "react-icons/fi";
import { useHotkeys } from "react-hotkeys-hook";
import { useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { IconButton } from "../../../common";
import type {
  CoderComposerAttachment,
  CoderContextUsage,
  CoderModelItem,
  CoderPermissionMode,
  CoderReasoningEffort
} from "../../CoderCore/types";
import { AttachmentTray } from "./AttachmentTray";
import {
  ContextUsagePopover,
  getDisplayModelLabel,
  getDisplayReasoningLabel,
  ModelPopover,
  PermissionPopover,
  ReasoningPopover
} from "./ComposerMenus";
import {
  filesFromDataTransfer,
  hasTransferFiles,
  readAttachments
} from "./attachmentIO";
import styles from "./CodexChatBox.module.css";

export function CodexChatBox({
  attachments = [],
  isRunning = false,
  models,
  onAddAttachments,
  onAttachClick,
  onMicClick,
  onPromptChange,
  onReasoningClick,
  onRemoveAttachment,
  onSelectModel,
  onSelectPermissionMode,
  onSelectReasoningEffort,
  onBeforeSubmit,
  onSubmit,
  placeholder = "Ask for follow-up changes",
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
  onAttachClick?: () => void;
  onMicClick?: () => void;
  onPromptChange: (value: string) => void;
  onReasoningClick?: () => void;
  onRemoveAttachment?: (attachmentId: string) => void;
  onSelectModel: (id: string) => void;
  onSelectPermissionMode?: (value: CoderPermissionMode) => void;
  onSelectReasoningEffort: (value: CoderReasoningEffort) => void;
  onBeforeSubmit?: () => void;
  onSubmit?: () => void;
  placeholder?: string;
  prompt: string;
  selectedPermissionMode?: CoderPermissionMode;
  selectedModel: string;
  selectedReasoningEffort: CoderReasoningEffort;
  contextUsage?: CoderContextUsage;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | undefined>();
  const [dragDepth, setDragDepth] = useState(0);
  const canSubmit = (Boolean(prompt.trim()) || attachments.length > 0) && !isRunning;
  const isDragActive = dragDepth > 0;
  const selectedModelItem = models.find((model) => model.id === selectedModel);
  const modelLabel = selectedModelItem ? getDisplayModelLabel(selectedModelItem.label) : getDisplayModelLabel(selectedModel);
  const reasoningEfforts = selectedModelItem?.supportedReasoningEfforts?.length
    ? selectedModelItem.supportedReasoningEfforts
    : ["low", "medium", "high", "xhigh"] satisfies CoderReasoningEffort[];
  const reasoningLabel = getDisplayReasoningLabel(selectedReasoningEffort);

  useHotkeys("mod+enter", (event) => {
    event.preventDefault();
    if (canSubmit) {
      onSubmit?.();
    }
  }, {
    enableOnFormTags: ["TEXTAREA"],
    enabled: canSubmit
  }, [canSubmit, onSubmit]);

  const handleAttachClick = () => {
    onAttachClick?.();
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (files: FileList | null) => {
    await addFiles(files ? [...files] : []);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const addFiles = async (files: File[]) => {
    if (files.length === 0) {
      return;
    }
    try {
      const nextAttachments = await readAttachments(files);
      setAttachmentError(undefined);
      onAddAttachments?.(nextAttachments);
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : "Could not attach file");
    }
  };

  const handleDragEnter = (event: DragEvent<HTMLElement>) => {
    if (!hasTransferFiles(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    setDragDepth((current) => current + 1);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (!hasTransferFiles(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!hasTransferFiles(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    setDragDepth((current) => Math.max(0, current - 1));
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    if (!hasTransferFiles(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    setDragDepth(0);
    void addFiles(filesFromDataTransfer(event.dataTransfer));
  };

  const handlePaste = (event: ClipboardEvent<HTMLElement>) => {
    const files = filesFromDataTransfer(event.clipboardData);
    if (files.length === 0) {
      return;
    }
    event.preventDefault();
    void addFiles(files);
  };

  return (
    <section
      aria-busy={isRunning || undefined}
      aria-label="Codex prompt composer"
      className={[styles.box, isDragActive ? styles.box_dragActive : ""].filter(Boolean).join(" ")}
      data-drag-active={isDragActive ? "true" : undefined}
      data-testid="prompt-composer"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      <textarea
        aria-label="Chat input"
        className={styles.prompt}
        data-testid="prompt-input"
        onChange={(event) => onPromptChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
        suppressHydrationWarning
        value={prompt}
      />
      <input
        ref={fileInputRef}
        data-testid="composer-file-input"
        hidden
        multiple
        onChange={(event) => void handleFilesSelected(event.currentTarget.files)}
        suppressHydrationWarning
        type="file"
      />
      <AttachmentTray
        attachmentError={attachmentError}
        attachments={attachments}
        onRemoveAttachment={onRemoveAttachment}
      />
      <div className={styles.rail}>
        <div className={styles.leftActions}>
          <IconButton className={styles.iconButton} label="Attach file" onClick={handleAttachClick}>
            <FiPlus aria-hidden="true" />
          </IconButton>
          <PermissionPopover
            onSelectPermissionMode={onSelectPermissionMode}
            selectedPermissionMode={selectedPermissionMode}
          />
        </div>
        <div className={styles.rightActions}>
          {isRunning ? <span className={styles.runningDot} aria-label="Codex is working" data-testid="composer-running-indicator" /> : null}
          <ContextUsagePopover contextUsage={contextUsage} />
          <ModelPopover
            modelLabel={modelLabel}
            models={models}
            onSelectModel={onSelectModel}
            selectedModel={selectedModel}
          />
          <ReasoningPopover
            onOpen={onReasoningClick}
            onSelectReasoningEffort={onSelectReasoningEffort}
            reasoningEfforts={reasoningEfforts}
            reasoningLabel={reasoningLabel}
            selectedReasoningEffort={selectedReasoningEffort}
          />
          <IconButton className={styles.iconButton} label="Dictate" onClick={onMicClick}>
            <FiMic aria-hidden="true" />
          </IconButton>
          <IconButton
            className={styles.submitButton}
            data-testid="send-prompt-button"
            disabled={!canSubmit}
            label="Send message"
            onClick={onSubmit}
            onPointerDown={canSubmit ? onBeforeSubmit : undefined}
            variant="primary"
          >
            <FiArrowUp aria-hidden="true" />
          </IconButton>
        </div>
      </div>
    </section>
  );
}
