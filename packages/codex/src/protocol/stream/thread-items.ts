import { z } from "zod";
import {
  recordSchema,
  stableFallbackId,
  type RecordValue
} from "./common.js";

export const codexTextElementSchema = recordSchema;

export const codexUserInputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    text: z.string(),
    text_elements: z.array(codexTextElementSchema).default([])
  }).passthrough(),
  z.object({
    type: z.literal("image"),
    url: z.string()
  }).passthrough(),
  z.object({
    type: z.literal("localImage"),
    path: z.string()
  }).passthrough(),
  z.object({
    type: z.literal("skill"),
    name: z.string(),
    path: z.string()
  }).passthrough(),
  z.object({
    type: z.literal("mention"),
    name: z.string(),
    path: z.string()
  }).passthrough(),
  z.object({
    type: z.literal("input_image"),
    image_url: z.string()
  }).passthrough(),
  z.object({
    type: z.literal("input_text"),
    text: z.string()
  }).passthrough()
]);

const fileChangeKindSchema = z.object({
  type: z.string().optional(),
  move_path: z.string().nullable().optional()
}).passthrough();

export const codexCommandActionSchema = z.object({
  type: z.string().optional(),
  command: z.string().optional(),
  cmd: z.string().optional(),
  name: z.string().optional(),
  path: z.string().nullable().optional(),
  query: z.string().nullable().optional()
}).passthrough();

export const codexFileUpdateChangeSchema = z.object({
  path: z.string(),
  kind: fileChangeKindSchema.optional(),
  diff: z.string().optional()
}).passthrough();

export const knownThreadItemSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("userMessage"),
    id: z.string(),
    content: z.array(codexUserInputSchema)
  }).passthrough(),
  z.object({
    type: z.literal("hookPrompt"),
    id: z.string(),
    fragments: z.array(z.unknown()).default([])
  }).passthrough(),
  z.object({
    type: z.literal("agentMessage"),
    id: z.string(),
    text: z.string().default(""),
    phase: z.string().nullable().optional(),
    memoryCitation: z.unknown().nullable().optional()
  }).passthrough(),
  z.object({
    type: z.literal("plan"),
    id: z.string(),
    text: z.string().default("")
  }).passthrough(),
  z.object({
    type: z.literal("reasoning"),
    id: z.string(),
    summary: z.array(z.string()).default([]),
    content: z.array(z.string()).default([])
  }).passthrough(),
  z.object({
    type: z.literal("commandExecution"),
    id: z.string(),
    command: z.string().default(""),
    cwd: z.string().default(""),
    processId: z.string().nullable().optional(),
    source: z.string().optional(),
    status: z.string().optional(),
    commandActions: z.array(codexCommandActionSchema).default([]),
    aggregatedOutput: z.string().nullable().optional(),
    exitCode: z.number().nullable().optional(),
    durationMs: z.number().nullable().optional()
  }).passthrough(),
  z.object({
    type: z.literal("fileChange"),
    id: z.string(),
    changes: z.array(codexFileUpdateChangeSchema).default([]),
    status: z.string().optional()
  }).passthrough(),
  z.object({
    type: z.literal("mcpToolCall"),
    id: z.string(),
    server: z.string().default("server"),
    tool: z.string().default("tool"),
    status: z.string().optional(),
    arguments: z.unknown().optional(),
    result: z.unknown().nullable().optional(),
    error: z.unknown().nullable().optional(),
    durationMs: z.number().nullable().optional()
  }).passthrough(),
  z.object({
    type: z.literal("dynamicToolCall"),
    id: z.string(),
    namespace: z.string().nullable().optional(),
    tool: z.string().default("tool"),
    arguments: z.unknown().optional(),
    status: z.string().optional(),
    contentItems: z.unknown().nullable().optional(),
    success: z.boolean().nullable().optional(),
    durationMs: z.number().nullable().optional()
  }).passthrough(),
  z.object({
    type: z.literal("collabAgentToolCall"),
    id: z.string(),
    tool: z.string().default("agent"),
    status: z.string().optional(),
    prompt: z.string().nullable().optional(),
    agentsStates: z.unknown().optional()
  }).passthrough(),
  z.object({
    type: z.literal("webSearch"),
    id: z.string(),
    query: z.string().default(""),
    action: z.unknown().nullable().optional()
  }).passthrough(),
  z.object({
    type: z.literal("imageView"),
    id: z.string(),
    path: z.string()
  }).passthrough(),
  z.object({
    type: z.literal("imageGeneration"),
    id: z.string(),
    status: z.string().optional(),
    revisedPrompt: z.string().nullable().optional(),
    result: z.string().default(""),
    savedPath: z.string().nullable().optional()
  }).passthrough(),
  z.object({
    type: z.literal("enteredReviewMode"),
    id: z.string(),
    review: z.string().optional()
  }).passthrough(),
  z.object({
    type: z.literal("exitedReviewMode"),
    id: z.string(),
    review: z.string().optional()
  }).passthrough(),
  z.object({
    type: z.literal("contextCompaction"),
    id: z.string()
  }).passthrough()
]);

export type CodexUnknownThreadItem = {
  type: "unsupported";
  id: string;
  originalType: string;
  payload: RecordValue;
  readonly __codexUnknownThreadItem: true;
};

type CodexKnownThreadItem = z.infer<typeof knownThreadItemSchema>;

export type CodexParsedThreadItem = CodexKnownThreadItem | CodexUnknownThreadItem;
export type CodexParsedCommandAction = z.infer<typeof codexCommandActionSchema>;

export const codexLooseThreadItemSchema = z.object({
  id: z.string().optional(),
  type: z.string()
}).passthrough().transform((item): CodexParsedThreadItem => {
  const parsed = knownThreadItemSchema.safeParse(item);
  if (parsed.success) {
    return parsed.data as CodexParsedThreadItem;
  }
  return {
    type: "unsupported",
    id: item.id ?? stableFallbackId(item),
    originalType: item.type,
    payload: item,
    __codexUnknownThreadItem: true
  };
});

export const codexTurnSchema = z.object({
  id: z.string(),
  itemsView: z.string().optional(),
  status: z.string().optional(),
  error: z.unknown().nullable().optional(),
  startedAt: z.number().nullable().optional(),
  completedAt: z.number().nullable().optional(),
  durationMs: z.number().nullable().optional(),
  items: z.array(codexLooseThreadItemSchema).default([])
}).passthrough();

export const codexThreadSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  preview: z.string().nullable().optional(),
  cwd: z.string().nullable().optional(),
  path: z.string().nullable().optional(),
  source: z.string().optional(),
  model: z.string().optional(),
  modelProvider: z.string().optional(),
  createdAt: z.union([z.string(), z.number(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.number(), z.date()]).optional(),
  turns: z.array(codexTurnSchema).default([])
}).passthrough();

export type CodexParsedUserInput = z.infer<typeof codexUserInputSchema>;
export type CodexParsedTurn = z.infer<typeof codexTurnSchema>;
export type CodexParsedThread = z.infer<typeof codexThreadSchema>;
export type CodexThreadItem = CodexParsedThreadItem;

export function parseCodexThreadItem(value: unknown): CodexParsedThreadItem | undefined {
  const parsed = codexLooseThreadItemSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
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
    phase: input.phase ?? null,
    memoryCitation: input.memoryCitation ?? null
  };
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
    source: input.source ?? "agent",
    status: input.status ?? "inProgress",
    commandActions: [...(input.commandActions ?? [])],
    aggregatedOutput: input.aggregatedOutput ?? null,
    exitCode: input.exitCode ?? null,
    durationMs: input.durationMs ?? null
  };
}

export function createCodexFileChangeItem(input: {
  id: string;
  changes?: readonly z.infer<typeof codexFileUpdateChangeSchema>[];
  status?: string;
}): CodexParsedThreadItem {
  return {
    type: "fileChange",
    id: input.id,
    changes: [...(input.changes ?? [])],
    status: input.status
  };
}
