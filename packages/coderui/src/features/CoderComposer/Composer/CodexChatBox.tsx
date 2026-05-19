import {
  FiArrowUp,
  FiChevronDown,
  FiCheck,
  FiFile,
  FiMic,
  FiPlus,
  FiShield,
  FiX,
  FiZap
} from "react-icons/fi";
import { useHotkeys } from "react-hotkeys-hook";
import { useRef, useState, type CSSProperties, type ClipboardEvent, type DragEvent } from "react";
import { IconButton, Popover } from "../../../common";
import type {
  CoderComposerAttachment,
  CoderContextUsage,
  CoderModelItem,
  CoderPermissionMode,
  CoderReasoningEffort
} from "../../CoderCore/types";
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
        value={prompt}
      />
      <input
        ref={fileInputRef}
        data-testid="composer-file-input"
        hidden
        multiple
        onChange={(event) => void handleFilesSelected(event.currentTarget.files)}
        type="file"
      />
      {attachments.length > 0 || attachmentError ? (
        <div className={styles.attachmentTray} data-testid="composer-attachments">
          {attachments.map((attachment) => (
            <div className={styles.attachmentChip} key={attachment.id}>
              {attachment.kind === "image" && attachment.dataUrl ? (
                <img alt="" className={styles.attachmentThumb} src={attachment.dataUrl} />
              ) : (
                <span className={styles.attachmentFileIcon}><FiFile aria-hidden="true" /></span>
              )}
              <span className={styles.attachmentText}>
                <span className={styles.attachmentName}>{attachment.name}</span>
                <span className={styles.attachmentMeta}>{formatAttachmentSize(attachment.size)}</span>
              </span>
              <button
                aria-label={`Remove ${attachment.name}`}
                className={styles.attachmentRemove}
                onClick={() => onRemoveAttachment?.(attachment.id)}
                type="button"
              >
                <FiX aria-hidden="true" />
              </button>
            </div>
          ))}
          {attachmentError ? <p className={styles.attachmentError}>{attachmentError}</p> : null}
        </div>
      ) : null}
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
            variant="primary"
          >
            <FiArrowUp aria-hidden="true" />
          </IconButton>
        </div>
      </div>
    </section>
  );
}

const maxAttachmentBytes = 20 * 1024 * 1024;

function readAttachments(files: File[]): Promise<CoderComposerAttachment[]> {
  return Promise.all(files.map(readAttachment));
}

async function readAttachment(file: File): Promise<CoderComposerAttachment> {
  if (file.size > maxAttachmentBytes) {
    throw new Error(`${file.name} is larger than 20 MB`);
  }
  const uploaded = await uploadAttachment(file);
  const isImage = isImageMime(file.type);
  const dataUrl = isImage ? await readFileAsDataUrl(file) : undefined;
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    kind: isImage ? "image" : "file",
    name: file.name || "attachment",
    mimeType: file.type || uploaded.asset?.mimeType || "application/octet-stream",
    size: file.size,
    path: uploaded.path,
    assetUrl: uploaded.asset?.url,
    dataUrl,
    input: uploaded.input
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error(`Could not read ${file.name}`));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

async function uploadAttachment(file: File): Promise<{
  input?: CoderComposerAttachment["input"];
  path: string;
  asset?: {
    url?: string;
    mimeType?: string;
    sizeBytes?: number;
  };
}> {
  const response = await fetch("/codex-assets/upload", {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": file.name || "attachment"
    },
    body: file
  });
  if (!response.ok) {
    throw new Error(`File upload failed with ${response.status}`);
  }
  const payload = await response.json() as {
    input?: CoderComposerAttachment["input"];
    path?: string;
    asset?: {
      url?: string;
      mimeType?: string;
      sizeBytes?: number;
    };
  };
  if (!payload.path) {
    throw new Error(`File upload did not return a staged path`);
  }
  return {
    input: payload.input,
    path: payload.path,
    asset: payload.asset
  };
}

function hasTransferFiles(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes("Files");
}

function filesFromDataTransfer(dataTransfer: DataTransfer): File[] {
  const files = [...dataTransfer.files];
  if (files.length > 0) {
    return files;
  }
  return [...dataTransfer.items]
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
}

function isImageMime(value: string): boolean {
  return value.startsWith("image/");
}

function formatAttachmentSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "unknown";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  for (const unit of units) {
    if (value < 1024 || unit === units.at(-1)) {
      return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
    }
    value /= 1024;
  }
  return `${bytes} B`;
}

function permissionModeLabel(mode: CoderPermissionMode) {
  if (mode === "auto-review") {
    return "Auto-review";
  }
  if (mode === "full-access") {
    return "Full access";
  }
  return "Default permissions";
}

function PermissionPopover({
  onSelectPermissionMode,
  selectedPermissionMode
}: {
  onSelectPermissionMode?: (value: CoderPermissionMode) => void;
  selectedPermissionMode: CoderPermissionMode;
}) {
  const label = permissionModeLabel(selectedPermissionMode);
  const options: CoderPermissionMode[] = ["default", "auto-review", "full-access"];
  return (
    <Popover
      placement="top"
      renderTrigger={({ ref, props }) => (
        <button
          {...props}
          ref={ref}
          aria-label={`Access mode: ${label}`}
          className={styles.accessButton}
          data-testid="access-mode-button"
          type="button"
        >
          <FiShield aria-hidden="true" />
          <span>{label}</span>
          <FiChevronDown aria-hidden="true" className={styles.chevron} />
        </button>
      )}
    >
      {({ close }) => (
        <div className={styles.permissionPanel} data-testid="permission-popover">
          {options.map((option) => (
            <button
              aria-pressed={option === selectedPermissionMode}
              className={styles.permissionOption}
              data-testid={`permission-option-${option}`}
              key={option}
              onClick={() => {
                onSelectPermissionMode?.(option);
                close();
              }}
              type="button"
            >
              <FiShield aria-hidden="true" />
              <span>{permissionModeLabel(option)}</span>
              {option === selectedPermissionMode ? <FiCheck aria-hidden="true" className={styles.permissionCheck} /> : null}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

function getDisplayModelLabel(label: string) {
  return label
    .replace(/^OpenAI:\s*/i, "")
    .replace(/^GPT-/i, "")
    .replace(/^gpt-/i, "");
}

function getDisplayReasoningLabel(value: CoderReasoningEffort) {
  return value === "xhigh"
    ? "XHigh"
    : value.charAt(0).toUpperCase() + value.slice(1);
}

function ModelPopover({
  modelLabel,
  models,
  onSelectModel,
  selectedModel
}: {
  modelLabel: string;
  models: CoderModelItem[];
  onSelectModel: (id: string) => void;
  selectedModel: string;
}) {
  return (
    <Popover
      placement="top"
      renderTrigger={({ ref, props }) => (
        <button
          {...props}
          ref={ref}
          aria-label={`Model: ${modelLabel}`}
          className={styles.modelControl}
          data-testid="model-control"
          type="button"
        >
          <FiZap aria-hidden="true" />
          <span>{modelLabel}</span>
          <FiChevronDown aria-hidden="true" className={styles.chevron} />
        </button>
      )}
    >
      {({ close }) => (
        <div className={styles.modelPanel} data-testid="model-popover">
          {models.map((model) => (
            <button
              aria-pressed={model.id === selectedModel}
              className={styles.modelOption}
              data-testid={`model-option-${model.id}`}
              key={model.id}
              onClick={() => {
                onSelectModel(model.id);
                close();
              }}
              type="button"
            >
              <span>{getDisplayModelLabel(model.label)}</span>
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

function ReasoningPopover({
  onOpen,
  onSelectReasoningEffort,
  reasoningEfforts,
  reasoningLabel,
  selectedReasoningEffort
}: {
  onOpen?: () => void;
  onSelectReasoningEffort: (value: CoderReasoningEffort) => void;
  reasoningEfforts: CoderReasoningEffort[];
  reasoningLabel: string;
  selectedReasoningEffort: CoderReasoningEffort;
}) {
  return (
    <Popover
      placement="top"
      renderTrigger={({ ref, props }) => (
        <button
          {...props}
          ref={ref}
          aria-label={`Reasoning effort: ${reasoningLabel}`}
          className={styles.reasoningButton}
          data-testid="reasoning-control"
          onClick={(event) => {
            onOpen?.();
            const onClick = props.onClick;
            if (typeof onClick === "function") {
              onClick(event);
            }
          }}
          type="button"
        >
          <span>{reasoningLabel}</span>
          <FiChevronDown aria-hidden="true" className={styles.chevron} />
        </button>
      )}
    >
      {({ close }) => (
        <div className={styles.reasoningPanel} data-testid="reasoning-popover">
          {reasoningEfforts.map((effort) => (
            <button
              aria-pressed={effort === selectedReasoningEffort}
              className={styles.reasoningOption}
              data-testid={`reasoning-option-${effort}`}
              key={effort}
              onClick={() => {
                onSelectReasoningEffort(effort);
                close();
              }}
              type="button"
            >
              {getDisplayReasoningLabel(effort)}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

function ContextUsagePopover({ contextUsage }: { contextUsage?: CoderContextUsage }) {
  const ringStyle = {
    "--context-used-degrees": `${contextUsage?.ringDegrees ?? 0}deg`
  } as CSSProperties;
  return (
    <Popover
      placement="top"
      renderTrigger={({ ref, props }) => (
        <button
          {...props}
          ref={ref}
          aria-label="Context window usage"
          className={styles.contextButton}
          data-testid="context-usage-button"
          type="button"
        >
          <span className={styles.contextRing} aria-hidden="true" style={ringStyle} />
        </button>
      )}
    >
      <div className={styles.contextPanel} data-testid="context-usage-popover">
        <p className={styles.contextEyebrow}>Context window:</p>
        <p className={styles.contextPrimary}>
          {contextUsage ? `${contextUsage.usedPercent}% used (${contextUsage.remainingPercent}% left)` : "-"}
        </p>
        <p className={styles.contextPrimary}>
          {contextUsage ? `${contextUsage.activeTokensLabel} / ${contextUsage.contextWindowLabel} active context tokens` : "-"}
        </p>
        {contextUsage ? (
          <p className={styles.contextNote}>{contextUsage.cumulativeTokensLabel} cumulative thread tokens</p>
        ) : null}
        <p className={styles.contextNote}>Codex automatically compacts its context</p>
      </div>
    </Popover>
  );
}
