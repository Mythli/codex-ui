import type {
  CodexAppServerThread,
  CodexAppServerThreadItem,
  CodexAppServerTurn,
  CodexAppServerUserInput
} from "../types/appServer.js";
import {
  asRecord,
  stableFallbackId,
  stringValue,
  type RecordValue
} from "./common.js";

type CommandExecutionItem = Extract<CodexAppServerThreadItem, { type: "commandExecution" }>;
type FileChangeItem = Extract<CodexAppServerThreadItem, { type: "fileChange" }>;
type AgentMessageItem = Extract<CodexAppServerThreadItem, { type: "agentMessage" }>;

export type CodexUnknownThreadItem = {
  type: "unsupported";
  id: string;
  originalType: string;
  payload: RecordValue;
  readonly __codexUnknownThreadItem: true;
};

export type CodexParsedThreadItem = CodexAppServerThreadItem | CodexUnknownThreadItem;
export type CodexParsedCommandAction = CommandExecutionItem["commandActions"][number];
export type CodexParsedUserInput = CodexAppServerUserInput & {
  asset?: unknown;
};
export type CodexParsedTurn = Omit<CodexAppServerTurn, "items"> & {
  items: CodexParsedThreadItem[];
};
export type CodexParsedThread = Omit<CodexAppServerThread, "turns"> & {
  turns: CodexParsedTurn[];
};
export type CodexThreadItem = CodexParsedThreadItem;
export type CodexFileUpdateChange = FileChangeItem["changes"][number] & {
  asset?: unknown;
};

const knownThreadItemTypes = new Set<string>([
  "userMessage",
  "hookPrompt",
  "agentMessage",
  "plan",
  "reasoning",
  "commandExecution",
  "fileChange",
  "mcpToolCall",
  "dynamicToolCall",
  "collabAgentToolCall",
  "webSearch",
  "imageView",
  "imageGeneration",
  "enteredReviewMode",
  "exitedReviewMode",
  "contextCompaction"
]);

export function parseCodexThreadItem(value: unknown): CodexParsedThreadItem | undefined {
  const item = asRecord(value);
  const type = stringValue(item.type);
  if (!type) {
    return undefined;
  }
  if (knownThreadItemTypes.has(type)) {
    const id = stringValue(item.id);
    if (!id) {
      return undefined;
    }
    return {
      ...item,
      id
    } as CodexAppServerThreadItem;
  }
  return {
    type: "unsupported",
    id: stringValue(item.id) ?? stableFallbackId({ ...item, type }),
    originalType: type,
    payload: item,
    __codexUnknownThreadItem: true
  };
}

export function createCodexUserMessageItem(input: {
  id: string;
  text: string;
}): CodexParsedThreadItem {
  return {
    type: "userMessage",
    id: input.id,
    content: [{ type: "text", text: input.text, text_elements: [] }]
  };
}

export function createCodexAgentMessageItem(input: {
  id: string;
  text: string;
  phase?: string | null;
  memoryCitation?: unknown;
}): CodexParsedThreadItem {
  return {
    type: "agentMessage",
    id: input.id,
    text: input.text,
    phase: normalizeMessagePhase(input.phase),
    memoryCitation: input.memoryCitation ?? null
  } as AgentMessageItem;
}

export function createCodexPlanItem(input: {
  id: string;
  text: string;
}): CodexParsedThreadItem {
  return {
    type: "plan",
    id: input.id,
    text: input.text
  };
}

export function createCodexReasoningItem(input: {
  id: string;
  summary?: readonly string[];
  content?: readonly string[];
}): CodexParsedThreadItem {
  return {
    type: "reasoning",
    id: input.id,
    summary: [...(input.summary ?? [])],
    content: [...(input.content ?? [])]
  };
}

export function createCodexCommandExecutionItem(input: {
  id: string;
  command?: string;
  cwd?: string;
  processId?: string | null;
  source?: string;
  status?: string;
  commandActions?: readonly CodexParsedCommandAction[];
  aggregatedOutput?: string | null;
  exitCode?: number | null;
  durationMs?: number | null;
}): CodexParsedThreadItem {
  return {
    type: "commandExecution",
    id: input.id,
    command: input.command ?? "",
    cwd: input.cwd ?? "",
    processId: input.processId ?? null,
    source: normalizeCommandSource(input.source),
    status: normalizeExecutionStatus(input.status),
    commandActions: [...(input.commandActions ?? [])],
    aggregatedOutput: input.aggregatedOutput ?? null,
    exitCode: input.exitCode ?? null,
    durationMs: input.durationMs ?? null
  } as CommandExecutionItem;
}

export function createCodexFileChangeItem(input: {
  id: string;
  changes?: readonly CodexFileUpdateChange[];
  status?: string;
}): CodexParsedThreadItem {
  return {
    type: "fileChange",
    id: input.id,
    changes: [...(input.changes ?? [])],
    status: normalizePatchStatus(input.status)
  } as FileChangeItem;
}

function normalizeMessagePhase(value: string | null | undefined): AgentMessageItem["phase"] {
  return value === "commentary" || value === "final_answer" ? value : null;
}

function normalizeCommandSource(value: string | undefined): CommandExecutionItem["source"] {
  if (
    value === "agent" ||
    value === "userShell" ||
    value === "unifiedExecStartup" ||
    value === "unifiedExecInteraction"
  ) {
    return value;
  }
  return "agent";
}

function normalizeExecutionStatus(value: string | undefined): CommandExecutionItem["status"] {
  if (value === "completed" || value === "failed" || value === "declined") {
    return value;
  }
  return "inProgress";
}

function normalizePatchStatus(value: string | undefined): FileChangeItem["status"] {
  if (value === "completed" || value === "failed" || value === "declined") {
    return value;
  }
  return "inProgress";
}
