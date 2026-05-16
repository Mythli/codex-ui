import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";

export const codexOptionsSchema = z.object({
  cwd: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  modelProvider: z.string().min(1).optional(),
  reasoningEffort: z.enum(["low", "medium", "high", "xhigh"]).default("medium"),
  sandbox: z.enum(["read-only", "workspace-write", "danger-full-access"]).default("read-only"),
  approvalPolicy: z.enum(["untrusted", "on-request", "never"]).default("never"),
  ephemeral: z.boolean().default(false),
  codexBin: z.string().min(1).optional()
});

export const messageRequestSchema = codexOptionsSchema.extend({
  message: z.string().min(1)
});

export type MessageRequest = z.infer<typeof messageRequestSchema>;
export type CodexJsonEvent = Record<string, unknown>;

export type CodexRunResult = {
  id: string;
  threadId?: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  finalMessage?: string;
  events: CodexJsonEvent[];
  diagnostics: Array<{ stream: "stdout" | "stderr"; text: string }>;
};

export type CodexChatSummary = {
  threadId: string;
  title: string;
  cwd?: string;
  source?: string;
  model?: string;
  modelProvider?: string;
  createdAt?: string;
  updatedAt?: string;
  lastUserMessage?: string;
  lastAgentMessage?: string;
  messageCount: number;
  path?: string;
};

export type CodexProjectSummary = {
  cwd: string;
  name: string;
  chatCount: number;
  updatedAt?: string;
};

export type CodexModelSummary = {
  id: string;
  model: string;
  displayName: string;
  defaultReasoningEffort: string;
  supportedReasoningEfforts: string[];
  isDefault: boolean;
};

export type CodexChatMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "activity";
  text: string;
  durationMs?: number;
  activities?: CodexActivity[];
};

export type CodexActivity = {
  id: string;
  kind: "command" | "file" | "mcp" | "browser" | "web" | "other";
  title: string;
  detail?: string;
  status?: string;
  output?: string;
  files?: Array<{ path: string; action: string; additions: number; deletions: number }>;
};

export type CodexChatDetail = {
  chat: CodexChatSummary;
  messages: CodexChatMessage[];
  raw: unknown;
};

export type CodexRunMode =
  | { kind: "new"; request: MessageRequest }
  | { kind: "resume"; threadId: string; request: MessageRequest };

export type CodexStreamEvent =
  | { type: "process.started"; runId: string; transport: "app-server"; args: string[] }
  | { type: "process.diagnostic"; stream: "stdout" | "stderr"; text: string }
  | { type: "process.completed"; exitCode: number | null; signal: NodeJS.Signals | null }
  | CodexJsonEvent;

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
};

const defaultCodexBin =
  process.env.CODEX_BIN ??
  (existsSync("/Applications/Codex.app/Contents/Resources/codex")
    ? "/Applications/Codex.app/Contents/Resources/codex"
    : "codex");

export async function listCodexChats(limit = 100, cwd?: string): Promise<CodexChatSummary[]> {
  const client = new AppServerClient();
  try {
    await client.initialize();
    const response = await client.request("thread/list", {
      limit,
      sortKey: "updated_at",
      sortDirection: "desc",
      sourceKinds: [],
      archived: false,
      cwd: cwd || null
    });

    const data = asRecord(response).data;
    return Array.isArray(data) ? data.map(threadToSummary) : [];
  } finally {
    client.close();
  }
}

export async function listCodexProjects(limit = 500): Promise<CodexProjectSummary[]> {
  const chats = await listCodexChats(limit);
  const projects = new Map<string, CodexProjectSummary>();

  for (const chat of chats) {
    if (!chat.cwd) {
      continue;
    }

    const existing = projects.get(chat.cwd);
    const updatedAt = newestIso(existing?.updatedAt, chat.updatedAt);
    projects.set(chat.cwd, {
      cwd: chat.cwd,
      name: projectName(chat.cwd),
      chatCount: (existing?.chatCount ?? 0) + 1,
      updatedAt
    });
  }

  return [...projects.values()].sort((a, b) => Date.parse(b.updatedAt ?? "") - Date.parse(a.updatedAt ?? ""));
}

export async function listCodexModels(limit = 100): Promise<CodexModelSummary[]> {
  const client = new AppServerClient();
  try {
    await client.initialize();
    const response = await client.request("model/list", {
      limit,
      includeHidden: false
    });

    const data = asRecord(response).data;
    return Array.isArray(data) ? data.map(modelToSummary) : [];
  } finally {
    client.close();
  }
}

export async function readCodexChat(threadId: string): Promise<CodexChatDetail> {
  const client = new AppServerClient();
  try {
    await client.initialize();
    const response = await client.request("thread/read", {
      threadId,
      includeTurns: true
    });
    const thread = asRecord(asRecord(response).thread);
    return {
      chat: threadToSummary(thread),
      messages: extractMessagesWithSessionFallback(thread),
      raw: response
    };
  } finally {
    client.close();
  }
}

export async function runCodex(mode: CodexRunMode): Promise<CodexRunResult> {
  const events: CodexJsonEvent[] = [];
  const diagnostics: CodexRunResult["diagnostics"] = [];
  let threadId: string | undefined;
  let finalMessage: string | undefined;

  const result = await streamCodex(mode, (event) => {
    if (isDiagnostic(event)) {
      diagnostics.push({ stream: event.stream, text: event.text });
      return;
    }

    if (event.type === "process.started" || event.type === "process.completed") {
      return;
    }

    events.push(event);
    threadId = extractThreadId(event) ?? threadId;
    finalMessage = extractAgentMessage(event) ?? finalMessage;
  });

  return {
    id: result.runId,
    threadId,
    exitCode: result.exitCode,
    signal: result.signal,
    finalMessage,
    events,
    diagnostics
  };
}

export async function streamCodex(
  mode: CodexRunMode,
  onEvent: (event: CodexStreamEvent) => void,
  signal?: AbortSignal
): Promise<{ runId: string; exitCode: number | null; signal: NodeJS.Signals | null }> {
  const runId = randomUUID();
  const client = new AppServerClient(mode.request.codexBin);
  let threadId: string | undefined;
  let turnDone = false;
  let completedSignal: NodeJS.Signals | null = null;

  const emit = (event: CodexStreamEvent) => {
    onEvent(event);
    threadId = extractThreadId(event) ?? threadId;

    if ("method" in event && event.method === "turn/completed") {
      turnDone = true;
      client.close();
    }
  };

  client.onEvent = emit;
  client.onDiagnostic = (text) => emit({ type: "process.diagnostic", stream: "stderr", text });

  const abort = () => {
    completedSignal = "SIGTERM";
    if (threadId) {
      void client.request("turn/interrupt", { threadId }).catch(() => undefined);
    }
    client.close();
  };
  signal?.addEventListener("abort", abort, { once: true });

  emit({ type: "process.started", runId, transport: "app-server", args: ["app-server", "--listen", "stdio://"] });

  try {
    await client.initialize();
    threadId =
      mode.kind === "new"
        ? await startThread(client, mode.request)
        : await resumeThread(client, mode.threadId, mode.request);

    await client.request("turn/start", {
      threadId,
      input: [{ type: "text", text: mode.request.message, text_elements: [] }],
      cwd: mode.request.cwd ?? process.cwd(),
      approvalPolicy: mode.request.approvalPolicy,
      sandboxPolicy: toAppServerSandboxPolicy(mode.request.sandbox),
      model: mode.request.model ?? null,
      effort: mode.request.reasoningEffort
    });

    await client.waitForClose();
  } finally {
    signal?.removeEventListener("abort", abort);
  }

  const exitCode = turnDone ? 0 : client.exitCode;
  const processSignal = completedSignal ?? client.signal;
  emit({ type: "process.completed", exitCode, signal: processSignal });
  return { runId, exitCode, signal: processSignal };
}

async function startThread(client: AppServerClient, request: MessageRequest): Promise<string> {
  const response = await client.request("thread/start", {
    cwd: request.cwd ?? process.cwd(),
    model: request.model ?? null,
    modelProvider: request.modelProvider ?? null,
    approvalPolicy: request.approvalPolicy,
    sandbox: request.sandbox,
    ephemeral: request.ephemeral,
    experimentalRawEvents: false,
    persistExtendedHistory: false
  });

  return getThreadIdFromResponse(response);
}

async function resumeThread(client: AppServerClient, threadId: string, request: MessageRequest): Promise<string> {
  const response = await client.request("thread/resume", {
    threadId,
    cwd: request.cwd || null,
    model: request.model ?? null,
    modelProvider: request.modelProvider ?? null,
    approvalPolicy: request.approvalPolicy,
    sandbox: request.sandbox,
    persistExtendedHistory: false
  });

  return getThreadIdFromResponse(response);
}

function getThreadIdFromResponse(response: unknown): string {
  const thread = asRecord(asRecord(response).thread);
  const id = thread.id;
  if (typeof id !== "string") {
    throw new Error("Codex app-server did not return a thread id");
  }
  return id;
}

class AppServerClient {
  private child: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private stdoutBuffer = "";
  private closePromise: Promise<void>;

  exitCode: number | null = null;
  signal: NodeJS.Signals | null = null;
  onEvent?: (event: CodexStreamEvent) => void;
  onDiagnostic?: (text: string) => void;

  constructor(codexBin = defaultCodexBin) {
    this.child = spawn(codexBin, ["app-server", "--listen", "stdio://"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"]
    });

    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => this.readStdout(chunk));
    this.child.stderr.on("data", (chunk: string) => this.readStderr(chunk));
    this.child.once("error", (error) => this.rejectAll(error));
    this.closePromise = new Promise((resolve) => {
      this.child.once("close", (code, signal) => {
        this.exitCode = code;
        this.signal = signal;
        this.rejectAll(new Error(`Codex app-server closed before responding`));
        resolve();
      });
    });
  }

  async initialize(): Promise<void> {
    await this.request("initialize", {
      clientInfo: { name: "codex-api", version: "0.1.0" },
      capabilities: null
    });
    this.notify("initialized");
  }

  request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    this.write({ id, method, params });

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  notify(method: string, params?: unknown): void {
    this.write(params === undefined ? { method } : { method, params });
  }

  close(): void {
    if (!this.child.killed) {
      this.child.kill("SIGTERM");
    }
  }

  waitForClose(): Promise<void> {
    return this.closePromise;
  }

  private write(message: unknown): void {
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private readStdout(chunk: string): void {
    this.stdoutBuffer += chunk;

    for (;;) {
      const newlineIndex = this.stdoutBuffer.indexOf("\n");
      if (newlineIndex === -1) {
        break;
      }

      const line = this.stdoutBuffer.slice(0, newlineIndex);
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);
      this.handleMessage(line);
    }
  }

  private readStderr(chunk: string): void {
    for (const line of chunk.split("\n")) {
      if (line.trim()) {
        this.onDiagnostic?.(line);
      }
    }
  }

  private handleMessage(line: string): void {
    if (!line.trim()) {
      return;
    }

    let message: CodexJsonEvent;
    try {
      message = JSON.parse(line) as CodexJsonEvent;
    } catch {
      this.onDiagnostic?.(line);
      return;
    }

    if (typeof message.id === "number" && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id)!;
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(message.error);
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (typeof message.id === "number" && message.method && isServerRequest(message.method)) {
      this.write({ id: message.id, result: defaultServerRequestResponse(message.method) });
      return;
    }

    this.onEvent?.(message);
  }

  private rejectAll(error: unknown): void {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }
}

function isServerRequest(method: unknown): method is string {
  return typeof method === "string" && method.includes("/request");
}

function defaultServerRequestResponse(method: string): unknown {
  if (method.includes("requestApproval") || method.includes("permissions")) {
    return { decision: "denied" };
  }
  if (method.includes("requestUserInput")) {
    return { answers: {} };
  }
  if (method.includes("elicitation")) {
    return { action: "cancel" };
  }
  return {};
}

function threadToSummary(value: unknown): CodexChatSummary {
  const thread = asRecord(value);
  const createdAt = toIsoSeconds(thread.createdAt);
  const updatedAt = toIsoSeconds(thread.updatedAt);
  const title = stringValue(thread.name) ?? stringValue(thread.preview) ?? stringValue(thread.id) ?? "Untitled chat";

  return {
    threadId: stringValue(thread.id) ?? "",
    title: cleanPreview(title) ?? "Untitled chat",
    cwd: stringValue(thread.cwd),
    source: typeof thread.source === "string" ? thread.source : JSON.stringify(thread.source ?? "unknown"),
    modelProvider: stringValue(thread.modelProvider),
    createdAt,
    updatedAt,
    messageCount: extractMessagesFromThread(thread).length,
    path: stringValue(thread.path)
  };
}

function modelToSummary(value: unknown): CodexModelSummary {
  const model = asRecord(value);
  const efforts = model.supportedReasoningEfforts;

  return {
    id: stringValue(model.id) ?? stringValue(model.model) ?? "",
    model: stringValue(model.model) ?? stringValue(model.id) ?? "",
    displayName: stringValue(model.displayName) ?? stringValue(model.model) ?? "Model",
    defaultReasoningEffort: stringValue(model.defaultReasoningEffort) ?? "medium",
    supportedReasoningEfforts: Array.isArray(efforts)
      ? efforts
          .map((effort) => stringValue(asRecord(effort).effort) ?? stringValue(effort))
          .filter((effort): effort is string => Boolean(effort))
      : ["medium"],
    isDefault: model.isDefault === true
  };
}

function extractMessagesFromThread(thread: Record<string, unknown>): CodexChatMessage[] {
  const turns = thread.turns;
  if (!Array.isArray(turns)) {
    return [];
  }

  return turns.flatMap((turn) => {
    const turnRecord = asRecord(turn);
    const items = turnRecord.items;
    if (!Array.isArray(items)) {
      return [];
    }

    const result: CodexChatMessage[] = [];
    let pendingActivities: CodexActivity[] = [];
    let activityIndex = 0;
    let workMarkerAdded = false;
    const turnId = stringValue(turnRecord.id) ?? randomUUID();
    const durationMs = numberValue(turnRecord.durationMs);

    for (const item of items) {
      const activity = itemToActivity(item);
      if (activity) {
        if (!workMarkerAdded && durationMs !== undefined) {
          result.push({
            id: `${turnId}-work`,
            role: "activity",
            text: "work",
            durationMs,
            activities: []
          });
          workMarkerAdded = true;
        }
        pendingActivities.push(activity);
        continue;
      }

      const messages = itemToMessage(item);
      if (messages.length === 0) {
        continue;
      }

      if (pendingActivities.length > 0) {
        result.push({
          id: `${turnId}-activity-${activityIndex++}`,
          role: "activity",
          text: "",
          activities: pendingActivities
        });
        pendingActivities = [];
      }

      result.push(...messages);
    }

    if (pendingActivities.length > 0) {
      result.push({
        id: `${turnId}-activity-${activityIndex}`,
        role: "activity",
        text: "",
        activities: pendingActivities
      });
    }

    return result;
  });
}

function extractMessagesWithSessionFallback(thread: Record<string, unknown>): CodexChatMessage[] {
  const appServerMessages = extractMessagesFromThread(thread);
  const hasActivities = appServerMessages.some((message) => (message.activities?.length ?? 0) > 0);
  if (hasActivities) {
    return appServerMessages;
  }

  const sessionPath = stringValue(thread.path);
  if (!sessionPath) {
    return appServerMessages;
  }

  const sessionMessages = extractMessagesFromSessionLog(sessionPath, appServerMessages);
  return sessionMessages.length > 0 ? sessionMessages : appServerMessages;
}

function extractMessagesFromSessionLog(path: string, appServerMessages: CodexChatMessage[]): CodexChatMessage[] {
  if (!existsSync(path)) {
    return [];
  }

  const userMessage = appServerMessages.find((message) => message.role === "user");
  if (!userMessage) {
    return [];
  }

  const messages: CodexChatMessage[] = [userMessage];
  const calls = new Map<string, CodexActivity>();
  let pendingActivities: CodexActivity[] = [];
  let activityIndex = 0;
  let assistantIndex = 0;
  let durationMs: number | undefined;
  let workMarkerAdded = false;

  const addWorkMarker = () => {
    if (workMarkerAdded) {
      return;
    }
    messages.push({
      id: `${userMessage.id}-session-work`,
      role: "activity",
      text: "work",
      durationMs,
      activities: []
    });
    workMarkerAdded = true;
  };

  const flushActivities = () => {
    if (pendingActivities.length === 0) {
      return;
    }
    addWorkMarker();
    messages.push({
      id: `${userMessage.id}-session-activity-${activityIndex++}`,
      role: "activity",
      text: "",
      activities: pendingActivities
    });
    pendingActivities = [];
  };

  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) {
      continue;
    }

    const entry = safeJsonParse(line);
    const payload = asRecord(asRecord(entry).payload);

    if (asRecord(entry).type === "event_msg" && payload.type === "task_complete") {
      durationMs = numberValue(payload.duration_ms) ?? numberValue(payload.durationMs) ?? durationMs;
      continue;
    }

    if (asRecord(entry).type === "event_msg" && payload.type === "agent_message") {
      const text = stringValue(payload.message);
      if (text) {
        flushActivities();
        messages.push({
          id: `session-agent-${assistantIndex++}`,
          role: "assistant",
          text
        });
      }
      continue;
    }

    if (asRecord(entry).type !== "response_item") {
      continue;
    }

    if (payload.type === "function_call") {
      const callId = stringValue(payload.call_id);
      const activity = functionCallToActivity(payload);
      if (callId && activity) {
        calls.set(callId, activity);
      }
      continue;
    }

    if (payload.type === "function_call_output") {
      const callId = stringValue(payload.call_id);
      const activity = callId ? calls.get(callId) : undefined;
      if (callId && activity) {
        calls.delete(callId);
        pendingActivities.push({
          ...activity,
          status: "completed",
          output: stringValue(payload.output)?.slice(0, 4000)
        });
      }
    }
  }

  flushActivities();

  if (durationMs !== undefined) {
    const marker = messages.find((message) => message.role === "activity" && message.text === "work");
    if (marker) {
      marker.durationMs = durationMs;
    }
  }

  return messages.length > 1 ? messages : [];
}

function functionCallToActivity(payload: Record<string, unknown>): CodexActivity | undefined {
  const name = stringValue(payload.name);
  if (!name) {
    return undefined;
  }

  const id = stringValue(payload.call_id) ?? randomUUID();
  const args = safeJsonParse(stringValue(payload.arguments) ?? "{}");
  const argRecord = asRecord(args);

  if (name === "exec_command" || name.endsWith(".exec_command")) {
    const command = stringValue(argRecord.cmd) ?? "Command";
    const cwd = stringValue(argRecord.workdir);
    return {
      id,
      kind: "command",
      title: command,
      detail: cwd ? `cwd: ${cwd}` : undefined
    };
  }

  if (name === "apply_patch" || name.endsWith(".apply_patch")) {
    return {
      id,
      kind: "file",
      title: "Edited files",
      files: []
    };
  }

  if (name.includes("browser") || stringValue(payload.arguments)?.includes("browser")) {
    return {
      id,
      kind: "browser",
      title: "Used the browser"
    };
  }

  return {
    id,
    kind: "other",
    title: name.replace(/^functions\./, "")
  };
}

function itemToActivity(itemValue: unknown): CodexActivity | undefined {
  const item = asRecord(itemValue);
  const id = stringValue(item.id) ?? randomUUID();
  const status = stringValue(item.status);

  if (item.type === "commandExecution") {
    const command = stringValue(item.command) ?? "Command";
    const cwd = stringValue(item.cwd);
    const exitCode = numberValue(item.exitCode);
    const output = stringValue(item.aggregatedOutput);
    return {
      id,
      kind: "command",
      title: command,
      detail: [cwd ? `cwd: ${cwd}` : undefined, exitCode !== undefined ? `exit ${exitCode}` : undefined]
        .filter(Boolean)
        .join(" · "),
      status,
      output: output ? output.slice(0, 4000) : undefined
    };
  }

  if (item.type === "fileChange") {
    const changes = Array.isArray(item.changes) ? item.changes : [];
    const files = changes.map((change) => {
      const changeRecord = asRecord(change);
      const stats = diffStat(stringValue(changeRecord.diff) ?? "");
      return {
        path: stringValue(changeRecord.path) ?? "Unknown file",
        action: fileAction(changeRecord.kind),
        additions: stats.additions,
        deletions: stats.deletions
      };
    });
    const additions = files.reduce((sum, file) => sum + file.additions, 0);
    const deletions = files.reduce((sum, file) => sum + file.deletions, 0);
    return {
      id,
      kind: "file",
      title: `${files.length} file${files.length === 1 ? "" : "s"} changed`,
      detail: `+${additions} -${deletions}`,
      status,
      files
    };
  }

  if (item.type === "mcpToolCall") {
    const server = stringValue(item.server) ?? "server";
    const tool = stringValue(item.tool) ?? "tool";
    if (`${server} ${tool}`.toLowerCase().includes("browser")) {
      return {
        id,
        kind: "browser",
        title: "Used the browser",
        detail: stringValue(item.error),
        status
      };
    }
    return {
      id,
      kind: "mcp",
      title: `${server} / ${tool}`,
      detail: stringValue(item.error),
      status
    };
  }

  if (item.type === "webSearch") {
    return { id, kind: "web", title: "Web search", status };
  }

  if (item.type === "dynamicToolCall") {
    return { id, kind: "other", title: "Dynamic tool call", status };
  }

  return undefined;
}

function itemToMessage(itemValue: unknown): CodexChatMessage[] {
  const item = asRecord(itemValue);
  const id = stringValue(item.id) ?? randomUUID();

  if (item.type === "userMessage") {
    const text = userInputText(item.content);
    return text ? [{ id, role: "user", text }] : [];
  }

  if (item.type === "agentMessage") {
    const text = stringValue(item.text);
    return text ? [{ id, role: "assistant", text }] : [];
  }

  if (item.type === "plan") {
    const text = stringValue(item.text);
    return text ? [{ id, role: "system", text }] : [];
  }

  return [];
}

function userInputText(contentValue: unknown): string | undefined {
  if (!Array.isArray(contentValue)) {
    return undefined;
  }

  const text = contentValue
    .map((entry) => {
      const input = asRecord(entry);
      return input.type === "text" ? stringValue(input.text) : undefined;
    })
    .filter((entry): entry is string => Boolean(entry))
    .join("\n");

  return text || undefined;
}

function toAppServerSandboxPolicy(sandbox: MessageRequest["sandbox"]): Record<string, unknown> {
  if (sandbox === "danger-full-access") {
    return { type: "dangerFullAccess" };
  }
  if (sandbox === "workspace-write") {
    return {
      type: "workspaceWrite",
      writableRoots: [process.cwd()],
      networkAccess: false,
      excludeTmpdirEnvVar: false,
      excludeSlashTmp: false
    };
  }
  return { type: "readOnly" };
}

function isDiagnostic(
  event: CodexStreamEvent
): event is { type: "process.diagnostic"; stream: "stdout" | "stderr"; text: string } {
  return (
    event.type === "process.diagnostic" &&
    event.stream === "stderr" &&
    typeof event.text === "string"
  );
}

function extractThreadId(event: CodexJsonEvent): string | undefined {
  const params = asRecord(event.params);
  const thread = asRecord(params.thread);
  return stringValue(params.threadId) ?? stringValue(thread.id);
}

function extractAgentMessage(event: CodexJsonEvent): string | undefined {
  if (event.method !== "item/completed") {
    return undefined;
  }
  const item = asRecord(asRecord(event.params).item);
  return item.type === "agentMessage" ? stringValue(item.text) : undefined;
}

function toIsoSeconds(value: unknown): string | undefined {
  return typeof value === "number" ? new Date(value * 1000).toISOString() : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function diffStat(diff: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;

  for (const line of diff.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) {
      continue;
    }
    if (line.startsWith("+")) {
      additions += 1;
    } else if (line.startsWith("-")) {
      deletions += 1;
    }
  }

  return { additions, deletions };
}

function fileAction(kindValue: unknown): string {
  const kind = asRecord(kindValue);
  if (kind.type === "add") {
    return "Added";
  }
  if (kind.type === "delete") {
    return "Deleted";
  }
  if (kind.type === "update") {
    return "Edited";
  }
  return "Changed";
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function cleanPreview(value: string | undefined): string | undefined {
  const compact = value?.replace(/\s+/g, " ").trim();
  if (!compact) {
    return undefined;
  }
  return compact.length > 140 ? `${compact.slice(0, 137)}...` : compact;
}

function newestIso(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

function projectName(cwd: string): string {
  const parts = cwd.split("/").filter(Boolean);
  return parts.at(-1) ?? cwd;
}
