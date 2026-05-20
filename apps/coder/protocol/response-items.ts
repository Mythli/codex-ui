import {
  asRecord,
  booleanValue,
  numberValue,
  stableFallbackId,
  stringValue,
  type RecordValue
} from "./common.js";
import {
  createCodexReasoningItem,
  parseCodexThreadItem,
  type CodexFileUpdateChange,
  type CodexParsedThreadItem,
  type CodexParsedTurn
} from "./thread-items.js";

export type CodexRolloutEntry = {
  type: string;
  payload?: unknown;
} & RecordValue;

export type CodexParsedTokenUsageBreakdown = {
  totalTokens: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
};

export type CodexParsedThreadTokenUsage = {
  total: CodexParsedTokenUsageBreakdown;
  last: CodexParsedTokenUsageBreakdown;
  modelContextWindow: number | null;
};

type PatchApplyChange = {
  type?: string;
  move_path?: string | null;
  unified_diff?: string;
  content?: string;
};

export function parseRolloutJsonlEntries(jsonl: string): CodexRolloutEntry[] {
  return jsonl.split("\n").flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return [];
    }
    const value = safeJsonParse(trimmed);
    const entry = asRolloutEntry(value);
    return entry ? [entry] : [];
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
    const started = payloads.map(taskStartedPayload).find(Boolean);
    const completed = payloads.map(taskCompletePayload).find(Boolean);
    if (items.length > 0 || started || completed) {
      turnsById.set(turnId, {
        id: turnId,
        status: completed ? "completed" : "inProgress",
        startedAt: started?.started_at ?? null,
        completedAt: completed?.completed_at ?? null,
        durationMs: completed?.duration_ms ?? null,
        itemsView: "full",
        error: null,
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
      currentTurnId = turnIdFromTurnContext(entry.payload);
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

function parseResponseItemThreadItems(payloads: readonly unknown[]): CodexParsedThreadItem[] {
  const outputsByCallId = responseItemOutputsByCallId(payloads);
  const patchChangesByCallId = patchChangesByCallIdFromPayloads(payloads);
  const items: CodexParsedThreadItem[] = [];
  const seen = new Set<string>();

  for (const payload of payloads) {
    if (isResponseItemOutput(payload) || patchApplyEndPayload(payload)) {
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

function responseItemToThreadItem(
  payload: unknown,
  outputsByCallId: ReadonlyMap<string, string> = new Map(),
  patchChangesByCallId: ReadonlyMap<string, CodexParsedThreadItem[]> = new Map()
): CodexParsedThreadItem | undefined {
  const record = asRecord(payload);
  const type = stringValue(record.type);

  if (type === "message") {
    const text = textFromMessageContent(Array.isArray(record.content) ? record.content : []);
    if (!text || record.role !== "assistant") {
      return undefined;
    }
    return parseCodexThreadItem({
      type: "agentMessage",
      id: stableFallbackId({ ...record, type: "agentMessage" }),
      text,
      phase: record.phase ?? null,
      memoryCitation: record.memoryCitation ?? record.memory_citation ?? null
    });
  }

  if (type === "agent_message") {
    const message = stringValue(record.message);
    if (!message) {
      return undefined;
    }
    return parseCodexThreadItem({
      type: "agentMessage",
      id: stableFallbackId({ ...record, type: "agentMessage" }),
      text: message,
      phase: record.phase ?? null,
      memoryCitation: record.memoryCitation ?? record.memory_citation ?? null
    });
  }

  if (type === "user_message") {
    const message = stringValue(record.message) ?? "";
    const localImages = localImageInputs(record);
    if (!message && localImages.length === 0) {
      return undefined;
    }
    return parseCodexThreadItem({
      type: "userMessage",
      id: stableFallbackId({ ...record, type: "userMessage" }),
      content: [
        { type: "text", text: message, text_elements: Array.isArray(record.text_elements) ? record.text_elements : [] },
        ...localImages
      ]
    });
  }

  if (type === "reasoning") {
    const summary = reasoningTextItems(record.summary);
    const content = reasoningTextItems(record.content);
    if (summary.length === 0 && content.length === 0) {
      return undefined;
    }
    return createCodexReasoningItem({
      id: stringValue(record.id) ?? stableFallbackId({ ...record, type }),
      summary,
      content
    });
  }

  if (type === "local_shell_call") {
    const callId = stringValue(record.call_id) ?? stringValue(record.id) ?? makeId();
    const action = asRecord(record.action);
    return parseCodexThreadItem({
      type: "commandExecution",
      id: callId,
      command: commandFromShellAction(action),
      cwd: stringValue(action.working_directory) ?? "",
      processId: null,
      source: "agent",
      status: statusWithOutput(localShellStatus(record.status), outputsByCallId.get(callId)),
      commandActions: [],
      aggregatedOutput: outputsByCallId.get(callId) ?? null,
      exitCode: null,
      durationMs: null
    });
  }

  if (type === "web_search_call") {
    return parseCodexThreadItem({
      type: "webSearch",
      id: stringValue(record.id) ?? stringValue(record.call_id) ?? makeId(),
      query: webSearchQuery(record.action) ?? "Web search",
      action: record.action ?? null
    });
  }

  if (type === "image_generation_call") {
    return parseCodexThreadItem({
      type: "imageGeneration",
      id: stringValue(record.id) ?? makeId(),
      status: stringValue(record.status) ?? "completed",
      revisedPrompt: stringValue(record.revised_prompt) ?? null,
      result: stringValue(record.result) ?? "",
      savedPath: undefined
    });
  }

  if (type !== "function_call" && type !== "custom_tool_call" && type !== "tool_search_call") {
    return undefined;
  }

  const name = (stringValue(record.name) ?? stringValue(record.execution) ?? "tool").replace(/^functions\./, "");
  const callId = stringValue(record.call_id) ?? makeId();
  const output = outputsByCallId.get(callId);
  const args = jsonRecord(stringValue(record.arguments) ?? stringValue(record.input));

  if ((name === "write_stdin" || name.endsWith(".write_stdin")) && stringField(args, "chars") === "") {
    return undefined;
  }

  if (name === "exec_command" || name.endsWith(".exec_command")) {
    return parseCodexThreadItem({
      type: "commandExecution",
      id: callId,
      command: stringField(args, "cmd") ?? "Command",
      cwd: stringField(args, "workdir") ?? "",
      processId: null,
      source: "agent",
      status: statusWithOutput(stringValue(record.status), output),
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
    const patchChanges = patchChangesFromApplyPatchInput(stringValue(record.input));
    return parseCodexThreadItem({
      type: "fileChange",
      id: callId,
      status: statusWithOutput(stringValue(record.status), output),
      changes: patchChanges
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
    status: statusWithOutput(stringValue(record.status), output),
    contentItems: output ? [{ type: "inputText", text: output }] : null,
    success: output ? true : null,
    durationMs: null
  });
}

function asRolloutEntry(value: unknown): CodexRolloutEntry | undefined {
  const entry = asRecord(value);
  const type = stringValue(entry.type);
  return type ? { ...entry, type } : undefined;
}

function tokenUsageFromRolloutEntry(entry: CodexRolloutEntry): CodexParsedThreadTokenUsage | undefined {
  if (entry.type !== "event_msg") {
    return undefined;
  }
  const payload = asRecord(entry.payload);
  if (payload.type !== "token_count") {
    return undefined;
  }
  const info = payload.info;
  return info === null || info === undefined ? undefined : normalizeThreadTokenUsage(info);
}

function normalizeThreadTokenUsage(value: unknown): CodexParsedThreadTokenUsage {
  const usage = asRecord(value);
  return {
    total: normalizeTokenUsageBreakdown(usage.total ?? usage.total_token_usage),
    last: normalizeTokenUsageBreakdown(usage.last ?? usage.last_token_usage),
    modelContextWindow: numberValue(usage.modelContextWindow ?? usage.model_context_window) ?? null
  };
}

function normalizeTokenUsageBreakdown(value: unknown): CodexParsedTokenUsageBreakdown {
  const usage = asRecord(value);
  return {
    totalTokens: numberValue(usage.totalTokens ?? usage.total_tokens) ?? 0,
    inputTokens: numberValue(usage.inputTokens ?? usage.input_tokens) ?? 0,
    cachedInputTokens: numberValue(usage.cachedInputTokens ?? usage.cached_input_tokens) ?? 0,
    outputTokens: numberValue(usage.outputTokens ?? usage.output_tokens) ?? 0,
    reasoningOutputTokens: numberValue(usage.reasoningOutputTokens ?? usage.reasoning_output_tokens) ?? 0
  };
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

function turnIdFromTurnContext(payload: unknown): string | undefined {
  return stringValue(asRecord(payload).turn_id);
}

function turnIdFromEventPayload(payload: unknown): string | undefined {
  return taskStartedPayload(payload)?.turn_id ??
    taskCompletePayload(payload)?.turn_id ??
    stringValue(asRecord(payload).turn_id) ??
    stringValue(asRecord(payload).turnId);
}

function taskStartedPayload(payload: unknown): { turn_id: string; started_at?: number } | undefined {
  const record = asRecord(payload);
  const turnId = stringValue(record.turn_id);
  return record.type === "task_started" && turnId
    ? { turn_id: turnId, started_at: numberValue(record.started_at) }
    : undefined;
}

function taskCompletePayload(payload: unknown): { turn_id: string; completed_at?: number; duration_ms?: number } | undefined {
  const record = asRecord(payload);
  const turnId = stringValue(record.turn_id);
  return record.type === "task_complete" && turnId
    ? {
      turn_id: turnId,
      completed_at: numberValue(record.completed_at),
      duration_ms: numberValue(record.duration_ms)
    }
    : undefined;
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
      return `user:${item.content.map((entry) => entry.type === "text" ? entry.text : "").join("\n").trim()}`;
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

function textFromMessageContent(content: readonly unknown[]): string {
  return content.map((item) => stringValue(asRecord(item).text)).filter(Boolean).join("\n");
}

function localImageInputs(record: RecordValue): Array<{ type: "localImage"; path: string; asset?: unknown }> {
  const paths = Array.isArray(record.local_images)
    ? record.local_images.flatMap((path) => stringValue(path) ? [stringValue(path)!] : [])
    : [];
  const assetsByPath = localImageAssetsByPath(record.local_image_assets);
  return paths.map((path) => {
    const asset = assetsByPath.get(path);
    return asset
      ? { type: "localImage" as const, path, asset }
      : { type: "localImage" as const, path };
  });
}

function localImageAssetsByPath(value: unknown): Map<string, unknown> {
  const result = new Map<string, unknown>();
  if (!Array.isArray(value)) {
    return result;
  }
  for (const entry of value) {
    const record = asRecord(entry);
    const path = stringValue(record.path);
    if (!path || !("asset" in record)) {
      continue;
    }
    result.set(path, record.asset);
  }
  return result;
}

function reasoningTextItems(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    const text = typeof item === "string"
      ? item
      : stringValue(asRecord(item).text);
    return text ? [text] : [];
  });
}

function patchChangesByCallIdFromPayloads(payloads: readonly unknown[]): Map<string, CodexParsedThreadItem[]> {
  const changesByCallId = new Map<string, CodexParsedThreadItem[]>();
  for (const payload of payloads) {
    const patch = patchApplyEndPayload(payload);
    if (!patch) {
      continue;
    }
    const item = parseCodexThreadItem({
      type: "fileChange",
      id: patch.call_id,
      status: patch.status ?? (patch.success === false ? "failed" : "completed"),
      changes: Object.entries(patch.changes).map(([path, change]) => ({
        path,
        kind: patchChangeKind(change),
        diff: patchChangeDiff(change)
      }))
    });
    if (item) {
      changesByCallId.set(patch.call_id, [item]);
    }
  }
  return changesByCallId;
}

function patchApplyEndPayload(payload: unknown): {
  call_id: string;
  success?: boolean;
  status?: string;
  changes: Record<string, PatchApplyChange>;
} | undefined {
  const record = asRecord(payload);
  const callId = stringValue(record.call_id);
  if (record.type !== "patch_apply_end" || !callId) {
    return undefined;
  }
  const changes = asRecord(record.changes);
  return {
    call_id: callId,
    success: booleanValue(record.success),
    status: stringValue(record.status),
    changes: Object.fromEntries(Object.entries(changes).map(([path, change]) => [path, asRecord(change) as PatchApplyChange]))
  };
}

function patchChangeKind(change: PatchApplyChange): CodexFileUpdateChange["kind"] {
  if (change.type === "add" || change.type === "delete") {
    return { type: change.type };
  }
  return { type: "update", move_path: change.move_path ?? null };
}

function patchChangeDiff(change: PatchApplyChange): string {
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

function patchChangesFromApplyPatchInput(input: string | undefined): CodexFileUpdateChange[] {
  if (!input) {
    return [];
  }

  const changes: CodexFileUpdateChange[] = [];
  let current: {
    kind: CodexFileUpdateChange["kind"];
    lines: string[];
    path: string;
  } | undefined;

  const flush = () => {
    if (!current) {
      return;
    }
    changes.push({
      path: current.path,
      kind: current.kind,
      diff: diffFromPatchLines(current.kind, current.lines)
    });
    current = undefined;
  };

  for (const line of input.split(/\r?\n/)) {
    const add = /^\*\*\* Add File: (.+)$/.exec(line);
    if (add) {
      flush();
      current = { path: add[1] ?? "", kind: { type: "add" }, lines: [] };
      continue;
    }

    const update = /^\*\*\* Update File: (.+)$/.exec(line);
    if (update) {
      flush();
      current = { path: update[1] ?? "", kind: { type: "update", move_path: null }, lines: [] };
      continue;
    }

    const deleted = /^\*\*\* Delete File: (.+)$/.exec(line);
    if (deleted) {
      flush();
      changes.push({ path: deleted[1] ?? "", kind: { type: "delete" }, diff: "" });
      continue;
    }

    if (line.startsWith("***")) {
      flush();
      continue;
    }

    if (current && (line.startsWith("+") || line.startsWith("-") || line.startsWith("@@"))) {
      current.lines.push(line);
    }
  }
  flush();

  return changes.filter((change) => change.path);
}

function diffFromPatchLines(kind: CodexFileUpdateChange["kind"], lines: readonly string[]): string {
  const diffLines = lines.filter((line) => line.startsWith("+") || line.startsWith("-"));
  if (diffLines.length === 0) {
    return "";
  }

  if (kind.type === "add") {
    return [`@@ -0,0 +1,${diffLines.length} @@`, ...diffLines].join("\n") + "\n";
  }

  if (kind.type === "delete") {
    return [`@@ -1,${diffLines.length} +0,0 @@`, ...diffLines].join("\n") + "\n";
  }

  const hasHunk = lines.some((line) => line.startsWith("@@"));
  return (hasHunk ? lines : [`@@ -1,${diffLines.length} +1,${diffLines.length} @@`, ...diffLines]).join("\n") + "\n";
}

function responseItemOutputsByCallId(payloads: readonly unknown[]): Map<string, string> {
  const outputsByCallId = new Map<string, string>();
  for (const payload of payloads) {
    const record = asRecord(payload);
    if (!isResponseItemOutput(record)) {
      continue;
    }
    const callId = stringValue(record.call_id);
    if (callId) {
      outputsByCallId.set(callId, extractOutputText(record.output).slice(0, 4000));
    }
  }
  return outputsByCallId;
}

function isResponseItemOutput(payload: unknown): boolean {
  const type = stringValue(asRecord(payload).type);
  return type === "function_call_output" || type === "custom_tool_call_output";
}

function extractOutputText(output: unknown): string {
  if (typeof output === "string") {
    return output;
  }
  return Array.isArray(output)
    ? output.map((item) => stringValue(asRecord(item).text)).filter(Boolean).join("\n")
    : "";
}

function statusWithOutput(status: string | undefined, output: string | undefined): string | undefined {
  return normalizeStatus(status) ?? (output ? "completed" : undefined);
}

function localShellStatus(status: unknown): string | undefined {
  return status === "in_progress" ? "inProgress" : stringValue(status);
}

function normalizeStatus(value: string | undefined): string | undefined {
  if (value === "in_progress") {
    return "inProgress";
  }
  return value;
}

function commandFromShellAction(action: RecordValue): string {
  const command = action.command;
  return Array.isArray(command)
    ? command.map((part) => String(part)).join(" ")
    : "Shell command";
}

function webSearchQuery(action: unknown): string | undefined {
  const record = asRecord(action);
  const query = stringValue(record.query);
  if (query) {
    return query;
  }
  return Array.isArray(record.queries)
    ? record.queries.map((item) => stringValue(item)).filter(Boolean).join(", ")
    : undefined;
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
    return typeof parsed === "object" && parsed !== null ? parsed as RecordValue : undefined;
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
  return stringValue(asRecord(value)[field]);
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
