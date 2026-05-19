import { z } from "zod";
import { stableFallbackId } from "./common.js";
import { parseCodexThreadItem, type CodexParsedThreadItem, type CodexParsedTurn } from "./thread-items.js";

type RecordValue = Record<string, unknown>;

const rolloutEntrySchema = z.object({
  type: z.string(),
  payload: z.unknown().optional()
}).passthrough();
export type CodexRolloutEntry = z.infer<typeof rolloutEntrySchema>;

const rolloutTokenUsageBreakdownSchema = z.object({
  input_tokens: z.number(),
  cached_input_tokens: z.number(),
  output_tokens: z.number(),
  reasoning_output_tokens: z.number(),
  total_tokens: z.number()
}).passthrough().transform((usage) => ({
  totalTokens: usage.total_tokens,
  inputTokens: usage.input_tokens,
  cachedInputTokens: usage.cached_input_tokens,
  outputTokens: usage.output_tokens,
  reasoningOutputTokens: usage.reasoning_output_tokens
}));

const rolloutThreadTokenUsageSchema = z.object({
  total_token_usage: rolloutTokenUsageBreakdownSchema,
  last_token_usage: rolloutTokenUsageBreakdownSchema,
  model_context_window: z.number().nullable()
}).passthrough().transform((usage) => ({
  total: usage.total_token_usage,
  last: usage.last_token_usage,
  modelContextWindow: usage.model_context_window
}));

const rolloutTokenCountPayloadSchema = z.object({
  type: z.literal("token_count"),
  info: rolloutThreadTokenUsageSchema.nullable().optional()
}).passthrough();

const rolloutTokenCountEntrySchema = z.object({
  type: z.literal("event_msg"),
  payload: rolloutTokenCountPayloadSchema
}).passthrough();

export type CodexParsedTokenUsageBreakdown = z.infer<typeof rolloutTokenUsageBreakdownSchema>;
export type CodexParsedThreadTokenUsage = z.infer<typeof rolloutThreadTokenUsageSchema>;
export type CodexParsedRolloutTokenCountEntry = z.infer<typeof rolloutTokenCountEntrySchema>;

const turnContextPayloadSchema = z.object({
  turn_id: z.string()
}).passthrough();

const responseItemPayloadSchema = z.object({
  type: z.string()
}).passthrough();

const messageContentSchema = z.object({
  type: z.string(),
  text: z.string().optional()
}).passthrough();

const responseItemMessageSchema = z.object({
  type: z.literal("message"),
  role: z.string().optional(),
  content: z.array(messageContentSchema).default([]),
  phase: z.string().nullable().optional(),
  memoryCitation: z.unknown().nullable().optional(),
  memory_citation: z.unknown().nullable().optional()
}).passthrough();

const responseItemOutputSchema = responseItemPayloadSchema.extend({
  type: z.union([z.literal("function_call_output"), z.literal("custom_tool_call_output")]),
  call_id: z.string(),
  output: z.unknown()
});

const functionCallSchema = z.object({
  type: z.string().optional(),
  name: z.string(),
  call_id: z.string().optional(),
  arguments: z.string().optional(),
  status: z.string().optional()
}).passthrough();

const localShellCallSchema = z.object({
  type: z.literal("local_shell_call"),
  id: z.string().optional(),
  call_id: z.string().nullable().optional(),
  status: z.string().optional(),
  action: z.object({
    command: z.array(z.string()).optional(),
    working_directory: z.string().nullable().optional()
  }).passthrough().optional()
}).passthrough();

const webSearchCallSchema = z.object({
  type: z.literal("web_search_call"),
  id: z.string().optional(),
  call_id: z.string().nullable().optional(),
  status: z.string().optional()
}).passthrough();

const functionCallArgumentsSchema = z.object({
  cmd: z.string().optional(),
  workdir: z.string().optional()
}).passthrough();

const eventAgentMessageSchema = z.object({
  type: z.literal("agent_message"),
  message: z.string().default(""),
  phase: z.string().nullable().optional(),
  memoryCitation: z.unknown().nullable().optional(),
  memory_citation: z.unknown().nullable().optional()
}).passthrough();

const eventUserMessageSchema = z.object({
  type: z.literal("user_message"),
  message: z.string().default(""),
  images: z.array(z.unknown()).default([]),
  local_images: z.array(z.string()).default([]),
  text_elements: z.array(z.unknown()).default([])
}).passthrough();

const eventTaskStartedSchema = z.object({
  type: z.literal("task_started"),
  turn_id: z.string(),
  started_at: z.number().optional()
}).passthrough();

const eventTaskCompleteSchema = z.object({
  type: z.literal("task_complete"),
  turn_id: z.string(),
  completed_at: z.number().optional(),
  duration_ms: z.number().optional()
}).passthrough();

const patchApplyChangeSchema = z.object({
  type: z.string().optional(),
  move_path: z.string().nullable().optional(),
  unified_diff: z.string().optional(),
  content: z.string().optional()
}).passthrough();

const eventPatchApplyEndSchema = z.object({
  type: z.literal("patch_apply_end"),
  call_id: z.string(),
  success: z.boolean().optional(),
  status: z.string().optional(),
  changes: z.record(z.string(), patchApplyChangeSchema).default({})
}).passthrough();

export function parseRolloutJsonlEntries(jsonl: string): CodexRolloutEntry[] {
  return jsonl.split("\n").flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return [];
    }
    const entry = rolloutEntrySchema.safeParse(safeJsonParse(trimmed));
    return entry.success ? [entry.data] : [];
  });
}

export function parseRolloutJsonlThreadItemsByTurn(jsonl: string): Map<string, CodexParsedThreadItem[]> {
  const turns = parseRolloutJsonlThreadTurns(jsonl);
  return new Map([...turns].map(([turnId, turn]) => [turnId, turn.items]));
}

export function parseRolloutJsonlTokenUsage(jsonl: string): CodexParsedThreadTokenUsage | undefined {
  return parseRolloutTokenUsage(parseRolloutJsonlEntries(jsonl));
}

export function parseRolloutTokenUsage(entries: readonly CodexRolloutEntry[]): CodexParsedThreadTokenUsage | undefined {
  let tokenUsage: CodexParsedThreadTokenUsage | undefined;
  for (const entry of entries) {
    const next = tokenUsageFromRolloutEntry(entry);
    if (next) {
      tokenUsage = next;
    }
  }
  return tokenUsage;
}

export function parseRolloutJsonlThreadTurns(jsonl: string): Map<string, CodexParsedTurn> {
  const recordsByTurn = rolloutRecordsByTurn(parseRolloutJsonlEntries(jsonl));
  const turnsById = new Map<string, CodexParsedTurn>();

  for (const [turnId, records] of recordsByTurn) {
    const payloads = records.flatMap((entry) => entry.payload === undefined ? [] : [entry.payload]);
    const items = parseResponseItemThreadItems(payloads);
    const started = payloads.map((payload) => eventTaskStartedSchema.safeParse(payload)).find((parsed) => parsed.success);
    const completed = payloads.map((payload) => eventTaskCompleteSchema.safeParse(payload)).find((parsed) => parsed.success);
    if (items.length > 0 || started?.success || completed?.success) {
      turnsById.set(turnId, {
        id: turnId,
        status: completed?.success ? "completed" : "running",
        startedAt: started?.success ? started.data.started_at ?? null : null,
        completedAt: completed?.success ? completed.data.completed_at ?? null : null,
        durationMs: completed?.success ? completed.data.duration_ms ?? null : null,
        items
      });
    }
  }

  return turnsById;
}

export function rolloutRecordsByTurn(entries: readonly CodexRolloutEntry[]): Map<string, CodexRolloutEntry[]> {
  const recordsByTurn = new Map<string, CodexRolloutEntry[]>();
  let currentTurnId: string | undefined;
  let currentResponseItemTurnId: string | undefined;

  for (const entry of entries) {
    if (entry.type === "turn_context") {
      const turnContext = turnContextPayloadSchema.safeParse(entry.payload);
      currentTurnId = turnContext.success ? turnContext.data.turn_id : undefined;
      currentResponseItemTurnId = currentTurnId;
      if (currentTurnId) {
        pushTurnRecord(recordsByTurn, currentTurnId, entry);
      }
      continue;
    }

    if (entry.type === "event_msg") {
      const explicitTurnId = turnIdFromEventPayload(entry.payload);
      if (explicitTurnId) {
        currentTurnId = explicitTurnId;
      }
      if (currentTurnId) {
        pushTurnRecord(recordsByTurn, currentTurnId, entry);
      }
      continue;
    }

    if (entry.type === "response_item" && currentResponseItemTurnId) {
      pushTurnRecord(recordsByTurn, currentResponseItemTurnId, entry);
    }
  }

  return recordsByTurn;
}

function tokenUsageFromRolloutEntry(entry: CodexRolloutEntry): CodexParsedThreadTokenUsage | undefined {
  const tokenCount = rolloutTokenCountEntrySchema.safeParse(entry);
  return tokenCount.success ? tokenCount.data.payload.info ?? undefined : undefined;
}

export function parseResponseItemThreadItems(payloads: readonly unknown[]): CodexParsedThreadItem[] {
  const outputsByCallId = responseItemOutputsByCallId(payloads);
  const patchChangesByCallId = patchChangesByCallIdFromPayloads(payloads);
  const items: CodexParsedThreadItem[] = [];
  const seen = new Set<string>();

  for (const payload of payloads) {
    if (responseItemOutputSchema.safeParse(payload).success) {
      continue;
    }
    if (eventPatchApplyEndSchema.safeParse(payload).success) {
      continue;
    }

    const direct = parseCodexThreadItem(payload);
    if (direct && !("__codexUnknownThreadItem" in direct)) {
      pushUniqueItem(items, seen, direct);
      continue;
    }

    const projected = responseItemToThreadItem(payload, outputsByCallId, patchChangesByCallId);
    if (projected) {
      pushUniqueItem(items, seen, projected);
    }
  }

  return items;
}

export function responseItemToThreadItem(
  payload: unknown,
  outputsByCallId: ReadonlyMap<string, string> = new Map(),
  patchChangesByCallId: ReadonlyMap<string, CodexParsedThreadItem[]> = new Map()
): CodexParsedThreadItem | undefined {
  const message = responseItemMessageSchema.safeParse(payload);
  if (message.success) {
    const text = textFromMessageContent(message.data.content);
    if (!text) {
      return undefined;
    }
    if (message.data.role === "assistant") {
      return parseCodexThreadItem({
        type: "agentMessage",
        id: stableFallbackId({ ...message.data, type: "agentMessage" }),
        text,
        phase: message.data.phase ?? null,
        memoryCitation: message.data.memoryCitation ?? message.data.memory_citation ?? null
      });
    }
    return undefined;
  }

  const agentMessage = eventAgentMessageSchema.safeParse(payload);
  if (agentMessage.success && agentMessage.data.message) {
    return parseCodexThreadItem({
      type: "agentMessage",
      id: stableFallbackId({ ...agentMessage.data, type: "agentMessage" }),
      text: agentMessage.data.message,
      phase: agentMessage.data.phase ?? null,
      memoryCitation: agentMessage.data.memoryCitation ?? agentMessage.data.memory_citation ?? null
    });
  }

  const userMessage = eventUserMessageSchema.safeParse(payload);
  if (userMessage.success && userMessage.data.message) {
    return parseCodexThreadItem({
      type: "userMessage",
      id: stableFallbackId({ ...userMessage.data, type: "userMessage" }),
      content: [
        { type: "text", text: userMessage.data.message, text_elements: userMessage.data.text_elements },
        ...userMessage.data.local_images.map((path) => ({ type: "localImage" as const, path }))
      ]
    });
  }

  const shellCall = localShellCallSchema.safeParse(payload);
  if (shellCall.success) {
    const callId = shellCall.data.call_id ?? shellCall.data.id ?? makeId();
    return parseCodexThreadItem({
      type: "commandExecution",
      id: callId,
      command: shellCall.data.action?.command?.join(" ") || "Shell command",
      cwd: shellCall.data.action?.working_directory ?? "",
      processId: null,
      source: "agent",
      status: statusWithOutput(shellCall.data.status, outputsByCallId.get(callId)),
      commandActions: [],
      aggregatedOutput: outputsByCallId.get(callId) ?? null,
      exitCode: null,
      durationMs: null
    });
  }

  const webSearchCall = webSearchCallSchema.safeParse(payload);
  if (webSearchCall.success) {
    return parseCodexThreadItem({
      type: "webSearch",
      id: webSearchCall.data.id ?? webSearchCall.data.call_id ?? makeId(),
      query: "Web search",
      action: payload
    });
  }

  const functionCall = functionCallSchema.safeParse(payload);
  if (!functionCall.success) {
  return undefined;
}

  const callId = functionCall.data.call_id ?? makeId();
  const output = outputsByCallId.get(callId);
  const args = jsonRecord(functionCall.data.arguments);
  const name = functionCall.data.name.replace(/^functions\./, "");

  if (name === "exec_command" || name.endsWith(".exec_command")) {
    return parseCodexThreadItem({
      type: "commandExecution",
      id: callId,
      command: stringField(args, "cmd") ?? "Command",
      cwd: stringField(args, "workdir") ?? "",
      processId: null,
      source: "agent",
      status: statusWithOutput(functionCall.data.status, output),
      commandActions: [],
      aggregatedOutput: output ?? null,
      exitCode: null,
      durationMs: null
    });
  }

  if (name === "apply_patch" || name.endsWith(".apply_patch")) {
    const patchItems = patchChangesByCallId.get(callId);
    if (patchItems?.[0]?.type === "fileChange") {
      return patchItems[0];
    }
    return parseCodexThreadItem({
      type: "fileChange",
      id: callId,
      status: statusWithOutput(functionCall.data.status, output),
      changes: []
    });
  }

  if (name.includes("web_search")) {
    return parseCodexThreadItem({
      type: "webSearch",
      id: callId,
      query: stringField(args, "query") ?? "Web search",
      action: payload
    });
  }

  return parseCodexThreadItem({
    type: "dynamicToolCall",
    id: callId,
    namespace: namespaceFromName(name),
    tool: toolFromName(name),
    arguments: args ?? payload,
    status: statusWithOutput(functionCall.data.status, output),
    contentItems: output ? [{ type: "inputText", text: output }] : null,
    success: output ? true : null,
    durationMs: null
  });
}

function pushTurnRecord(
  recordsByTurn: Map<string, CodexRolloutEntry[]>,
  turnId: string,
  entry: CodexRolloutEntry
): void {
  const records = recordsByTurn.get(turnId) ?? [];
  records.push(entry);
  recordsByTurn.set(turnId, records);
}

function turnIdFromEventPayload(payload: unknown): string | undefined {
  const started = eventTaskStartedSchema.safeParse(payload);
  if (started.success) {
    return started.data.turn_id;
  }
  const completed = eventTaskCompleteSchema.safeParse(payload);
  if (completed.success) {
    return completed.data.turn_id;
  }
  const patch = z.object({ turn_id: z.string().optional(), turnId: z.string().optional() }).passthrough().safeParse(payload);
  return patch.success ? patch.data.turn_id ?? patch.data.turnId : undefined;
}

function pushUniqueItem(items: CodexParsedThreadItem[], seen: Set<string>, item: CodexParsedThreadItem): void {
  const key = itemKey(item);
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  items.push(item);
}

function itemKey(item: CodexParsedThreadItem): string {
  switch (item.type) {
    case "userMessage":
      return `user:${item.content.map((entry) => "text" in entry ? entry.text : "").join("\n").trim()}`;
    case "agentMessage":
      return `agent:${item.phase ?? ""}:${item.text.trim()}`;
    case "commandExecution":
      return `command:${item.command}:${item.cwd}`;
    case "fileChange":
      return `file:${item.changes.map((change) => change.path).sort().join("\n")}`;
    default:
      return `${item.type}:${item.id}`;
  }
}

function textFromMessageContent(content: readonly z.infer<typeof messageContentSchema>[]): string {
  return content.map((item) => item.text).filter(Boolean).join("\n");
}

function patchChangesByCallIdFromPayloads(payloads: readonly unknown[]): Map<string, CodexParsedThreadItem[]> {
  const changesByCallId = new Map<string, CodexParsedThreadItem[]>();
  for (const payload of payloads) {
    const patch = eventPatchApplyEndSchema.safeParse(payload);
    if (!patch.success) {
      continue;
    }
    const item = parseCodexThreadItem({
      type: "fileChange",
      id: patch.data.call_id,
      status: patch.data.status ?? (patch.data.success === false ? "failed" : "completed"),
      changes: Object.entries(patch.data.changes).map(([path, change]) => ({
        path,
        kind: {
          type: change.type,
          move_path: change.move_path ?? null
        },
        diff: patchChangeDiff(change)
      }))
    });
    if (item) {
      changesByCallId.set(patch.data.call_id, [item]);
    }
  }
  return changesByCallId;
}

function patchChangeDiff(change: z.infer<typeof patchApplyChangeSchema>): string {
  if (change.unified_diff) {
    return change.unified_diff.endsWith("\n") ? change.unified_diff : `${change.unified_diff}\n`;
  }
  if (!change.content) {
    return "";
  }
  const prefix = change.type === "delete" ? "-" : "+";
  const lines = change.content.replace(/\n$/, "").split("\n").map((line) => `${prefix}${line}`);
  return `${lines.join("\n")}\n`;
}

function responseItemOutputsByCallId(payloads: readonly unknown[]): Map<string, string> {
  const outputsByCallId = new Map<string, string>();
  for (const payload of payloads) {
    const output = responseItemOutputSchema.safeParse(payload);
    if (output.success) {
      outputsByCallId.set(output.data.call_id, extractOutputText(output.data.output).slice(0, 4000));
    }
  }
  return outputsByCallId;
}

function extractOutputText(output: unknown): string {
  if (typeof output === "string") {
    return output;
  }
  const parsed = z.array(z.object({
    type: z.string(),
    text: z.string().optional()
  }).passthrough()).safeParse(output);
  return parsed.success ? parsed.data.map((item) => item.text).filter(Boolean).join("\n") : "";
}

function statusWithOutput(status: string | undefined, output: string | undefined): string | undefined {
  return status ?? (output ? "completed" : undefined);
}

function namespaceFromName(name: string): string | null {
  const parts = name.split(".");
  return parts.length > 1 ? parts.slice(0, -1).join(".") : null;
}

function toolFromName(name: string): string {
  return name.split(".").at(-1) ?? name;
}

function jsonRecord(value: string | undefined): RecordValue | undefined {
  if (!value) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function stringField(value: unknown, field: string): string | undefined {
  return isRecord(value) && typeof value[field] === "string" ? value[field] : undefined;
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null;
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
