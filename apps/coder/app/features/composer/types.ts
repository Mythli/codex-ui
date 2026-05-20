import type {
  CodexModelReroute,
  CodexThreadTokenUsage
} from "@taylordb/codex";
import type {
  CodexAppServerModel,
  CodexAppServerReasoningEffort,
  CodexAppServerUserInput
} from "@taylordb/codex/protocol";

export type CoderReasoningEffort = CodexAppServerReasoningEffort;
export type CoderPermissionMode = "default" | "auto-review" | "full-access";

export type CoderComposerAttachmentInput = Extract<CodexAppServerUserInput, { type: "localImage" }> & {
  asset?: {
    url: string;
    kind: "file" | "bytes";
    mimeType?: string;
    originalPath?: string;
    sizeBytes?: number;
  };
};

export type CoderComposerAttachment = {
  id: string;
  kind: "image" | "file";
  name: string;
  mimeType: string;
  size: number;
  path: string;
  assetUrl?: string;
  dataUrl?: string;
  input?: CoderComposerAttachmentInput;
};

export type CoderComposerState = {
  prompt: string;
  attachments: CoderComposerAttachment[];
  models: CodexAppServerModel[];
  selectedModel: string;
  selectedReasoningEffort: CoderReasoningEffort;
  selectedPermissionMode: CoderPermissionMode;
  configDefaults: {
    model?: string | null;
    reasoningEffort?: CoderReasoningEffort | null;
  };
  activeThread: {
    threadId?: string;
    model?: string | null;
    reasoningEffort?: CoderReasoningEffort | null;
  };
  userSelection: {
    model?: string;
    reasoningEffort?: CoderReasoningEffort;
  };
  tokenUsage?: CodexThreadTokenUsage;
  modelReroute?: CodexModelReroute;
};

export type CoderSubmitPromptResult = { createdThreadId?: string } | undefined;
