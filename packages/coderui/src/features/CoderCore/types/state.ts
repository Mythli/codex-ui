export type CoderChatItem = {
  id: string;
  title: string;
  updatedLabel?: string;
  activity?: "none" | "running";
  unread?: boolean;
  additions?: number;
  deletions?: number;
};

export type CoderProjectChatGroup = {
  id: string;
  name: string;
  chats: CoderChatItem[];
};

export type CoderProjectItem = {
  id: string;
  name: string;
};

export type CoderModelItem = {
  id: string;
  label: string;
  defaultReasoningEffort?: CoderReasoningEffort;
  supportedReasoningEfforts?: CoderReasoningEffort[];
  isDefault?: boolean;
};

export type CoderReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
export type CoderPermissionMode = "default" | "auto-review" | "full-access";

export type CoderComposerAttachmentInput = { type: "localImage"; path: string };

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

export type CoderContextUsage = {
  activeTokens: number;
  activeInputTokens: number;
  lastTokens: number;
  cumulativeTokens: number;
  contextWindow: number;
  usedPercent: number;
  remainingPercent: number;
  remainingTokens: number;
  activeTokensLabel: string;
  cumulativeTokensLabel: string;
  contextWindowLabel: string;
  ringDegrees: number;
};

export type CoderComposerState = {
  prompt: string;
  attachments: CoderComposerAttachment[];
  models: CoderModelItem[];
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
  contextUsage?: CoderContextUsage;
  modelReroute?: {
    fromModel: string;
    toModel: string;
  };
};

export type CoderSelection =
  | { kind: "none" }
  | { kind: "thread"; threadId: string; projectId: string }
  | { kind: "draft"; draftId: string; projectId: string };

export type CoderState = {
  selection: CoderSelection;
};
