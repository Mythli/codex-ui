import type { CodexAssetRef } from "./assets.js";
import type { CodexParsedThreadItem } from "../../protocol/stream/index.js";

export type CodexTranscriptProtocolItem = CodexParsedThreadItem;
export type CodexTranscriptItemType = CodexParsedThreadItem["type"] | (string & {});
export type CodexTranscriptTurnStatus = "running" | "completed" | "failed";
export type CodexTranscriptTurnSource = "history" | "live" | "merged";
export type CodexTranscriptItemSource = "live" | "threadRead" | "rollout";
export type CodexTranscriptItemRole = "user" | "assistant" | "system";

export type CodexTranscriptState = {
  threadId: string;
  title?: string;
  cwd?: string;
  activeTurnId?: string;
  turnOrder: string[];
  turnsById: Record<string, CodexTranscriptTurnState>;
  appliedEventKeys: Record<string, true>;
};

export type CodexRuntimeSessionSettings = {
  model?: string | null;
  modelProvider?: string | null;
  serviceTier?: string | null;
  reasoningEffort?: string | null;
};

export type CodexTokenUsageBreakdown = {
  totalTokens: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
};

export type CodexThreadTokenUsage = {
  total: CodexTokenUsageBreakdown;
  last: CodexTokenUsageBreakdown;
  modelContextWindow: number | null;
};

export type CodexModelReroute = {
  fromModel: string;
  toModel: string;
  reason?: unknown;
};

export type CodexTranscriptTurnState = {
  id: string;
  status: CodexTranscriptTurnStatus;
  source: CodexTranscriptTurnSource;
  startedAtMs?: number;
  completedAtMs?: number;
  durationMs?: number;
  filesChanged?: CodexFileChangeEntry;
  itemOrder: string[];
  itemsById: Record<string, CodexTranscriptItem>;
};

export type CodexTranscript = {
  threadId: string;
  title?: string;
  cwd?: string;
  turns: CodexTranscriptTurn[];
};

export type CodexTranscriptTurn = {
  id: string;
  status: CodexTranscriptTurnStatus;
  source: CodexTranscriptTurnSource;
  startedAtMs?: number;
  completedAtMs?: number;
  durationMs?: number;
  filesChanged?: CodexFileChangeEntry;
  items: CodexTranscriptItem[];
};

export type CodexTranscriptFile = {
  path: string;
  action?: string;
  additions?: number;
  deletions?: number;
  diff?: string;
  asset?: CodexAssetRef;
};

export type CodexTranscriptImage = {
  id: string;
  kind: "asset" | "url" | "localPath" | "dataUrl";
  asset?: CodexAssetRef;
  path?: string;
  url?: string;
  dataUrl?: string;
  alt?: string;
};

export type CodexTranscriptCommandAction = {
  type?: string;
  command?: string;
  name?: string;
  path?: string | null;
  query?: string | null;
};

export type CodexTranscriptItem = {
  id: string;
  type: CodexTranscriptItemType;
  protocolItem: CodexTranscriptProtocolItem;
  renderKey: string;
  source: CodexTranscriptItemSource;
  status?: string;
  role?: CodexTranscriptItemRole;
  text?: string;
  title?: string;
  command?: string;
  cwd?: string;
  commandActions?: CodexTranscriptCommandAction[];
  output?: string;
  exitCode?: number | null;
  durationMs?: number;
  toolName?: string;
  toolNamespace?: string | null;
  arguments?: unknown;
  result?: unknown;
  error?: unknown;
  files?: CodexTranscriptFile[];
  images?: CodexTranscriptImage[];
  payload?: unknown;
  isFinal?: boolean;
  startedAtMs?: number;
  completedAtMs?: number;
};

export type CodexRenderBlock =
  | CodexUserMessageBlock
  | CodexAssistantTurnBlock
  | CodexImageBlock;

export type CodexUserMessageBlock = {
  type: "userMessage";
  id: string;
  turnId: string;
  cwd?: string;
  text: string;
  images: CodexTranscriptImage[];
};

export type CodexAssistantTurnBlock = {
  type: "assistantTurn";
  id: string;
  turnId: string;
  cwd?: string;
  status: CodexTranscriptTurnStatus;
  source: CodexTranscriptTurnSource;
  durationMs?: number;
  startedAtMs?: number;
  completedAtMs?: number;
  segments: CodexAssistantTurnSegment[];
  artifacts: {
    filesChanged?: CodexFileChangeEntry;
  };
};

export type CodexAssistantTurnSegment =
  | CodexAssistantTextSegment
  | CodexWorkSegment;

export type CodexAssistantTextSegment = {
  type: "assistantText";
  id: string;
  text: string;
  final: boolean;
};

export type CodexImageBlock = {
  type: "image";
  id: string;
  turnId: string;
  cwd?: string;
  images: CodexTranscriptImage[];
};

export type CodexWorkSegment = {
  type: "work";
  id: string;
  status: CodexTranscriptTurnStatus;
  durationMs?: number;
  startedAtMs?: number;
  completedAtMs?: number;
  currentActivity?: CodexCurrentActivity;
  headline: {
    label: string;
    durationLabel?: string;
    defaultExpanded: boolean;
    hasEntries: boolean;
    entryCount: number;
  };
  entries: CodexWorkEntry[];
};

export type CodexCurrentActivity = {
  id: string;
  type: "command" | "tool" | "fileChange" | "reasoning" | "assistantProgress" | "unsupported";
  title: string;
  description?: string;
  command?: string;
  status?: string;
  icon: "command" | "file" | "mcp" | "browser" | "web" | "other";
};

export type CodexWorkEntry =
  | CodexAssistantProgressEntry
  | CodexActivitySummaryEntry
  | CodexCommandEntry
  | CodexFileChangeEntry
  | CodexToolEntry
  | CodexReasoningEntry
  | CodexUnsupportedWorkEntry;

export type CodexAssistantProgressEntry = {
  type: "assistantProgress";
  id: string;
  text: string;
};

export type CodexActivitySummaryEntry = {
  type: "activitySummary";
  id: string;
  icon: "command" | "file" | "mcp" | "browser" | "web" | "other";
  label: string;
  defaultExpanded: boolean;
  status?: string;
  itemIds: string[];
  items: Array<CodexCommandEntry | CodexFileChangeEntry | CodexToolEntry | CodexUnsupportedWorkEntry>;
};

export type CodexCommandEntry = {
  type: "command";
  id: string;
  title: string;
  defaultExpanded: boolean;
  commandActions?: CodexTranscriptCommandAction[];
  command?: string;
  cwd?: string;
  output?: string;
  exitCode?: number | null;
  status?: string;
};

export type CodexFileChangeEntry = {
  type: "fileChange";
  id: string;
  title: string;
  defaultExpanded: boolean;
  status?: string;
  additions: number;
  deletions: number;
  files: CodexTranscriptFile[];
};

export type CodexToolEntry = {
  type: "tool";
  id: string;
  icon: "mcp" | "browser" | "web" | "other";
  title: string;
  defaultExpanded: boolean;
  status?: string;
  arguments?: unknown;
  result?: unknown;
  error?: unknown;
  images?: CodexTranscriptImage[];
};

export type CodexReasoningEntry = {
  type: "reasoning";
  id: string;
  text?: string;
};

export type CodexUnsupportedWorkEntry = {
  type: "unsupported";
  id: string;
  title: string;
  defaultExpanded: boolean;
  status?: string;
  payload: unknown;
};

export type CodexToolDisplayKind =
  | "command"
  | "fileChange"
  | "mcpTool"
  | "dynamicTool"
  | "collabAgent"
  | "webSearch"
  | "image"
  | "unsupported";

export type CodexToolDisplayIcon = "command" | "file" | "mcp" | "browser" | "web" | "agent" | "image" | "other";

export type CodexToolDisplayEntry = {
  kind: CodexToolDisplayKind;
  id: string;
  title: string;
  details?: string;
  status?: string;
  icon: CodexToolDisplayIcon;
  commandActions?: CodexTranscriptCommandAction[];
  command?: string;
  cwd?: string;
  output?: string;
  exitCode?: number | null;
  arguments?: unknown;
  result?: unknown;
  error?: unknown;
  files?: CodexTranscriptFile[];
  images?: CodexTranscriptImage[];
  payload?: unknown;
};

export type TranscriptLifecycle = Pick<CodexTranscriptItem, "startedAtMs" | "completedAtMs">;
