import type { MessageRequest } from "../types.js";
import {
  CODEX_THREAD_START_EXTENDED_EVENTS_FIELD,
  type CodexParsedUserInput,
  type CodexProtocolResponse,
  type CodexRequestMethod,
  type CodexRequestParams
} from "../protocol/stream/index.js";
import type { CodexTransport } from "./transport/CodexTransport.js";

export type CodexUIRuntimeDefaults = Partial<Omit<MessageRequest, "message">>;
export type CodexUIMessageInput = string | CodexParsedUserInput[];
export type CodexUIThreadMessageOptions = {
  threadId: string;
  input: CodexUIMessageInput;
  model?: MessageRequest["model"] | null;
  reasoningEffort?: MessageRequest["reasoningEffort"] | null;
  cwd?: string;
  sandbox?: MessageRequest["sandbox"];
  approvalPolicy?: MessageRequest["approvalPolicy"];
};
export type CodexUIStartThreadMessageOptions = {
  input: CodexUIMessageInput;
  cwd: string;
  model?: MessageRequest["model"] | null;
  reasoningEffort?: MessageRequest["reasoningEffort"] | null;
  sandbox?: MessageRequest["sandbox"];
  approvalPolicy?: MessageRequest["approvalPolicy"];
};
export type CodexUIMessageOptions = Omit<CodexUIThreadMessageOptions, "threadId"> & {
  startNewThread?: boolean;
};
export type CodexUIMessageRequest = CodexUIMessageInput | CodexUIMessageOptions;

export type CodexRequestPlanIntent =
  | "initialize"
  | "newThread"
  | "resumeThread"
  | "sendMessage"
  | "startThreadWithMessage"
  | "listThreads"
  | "openThread"
  | "archiveThread"
  | "compactThread"
  | "stopTurn"
  | "protocolRequest";

export type CodexRequestPlanContext = {
  activeThreadId?: string;
  activeTurnId?: string;
  cwd?: string;
  defaults?: CodexUIRuntimeDefaults;
};

export type CodexRequestPlanExecutionContext = CodexRequestPlanContext & {
  lastThreadPath?: string;
};

export type CodexRequestParamsFactory<M extends CodexRequestMethod> = (
  context: CodexRequestPlanExecutionContext
) => CodexRequestParams<M> | undefined;

export type CodexRequestPlanStep<M extends CodexRequestMethod = CodexRequestMethod> = {
  type: "request" | "dependentRequest";
  method: M;
  params: CodexRequestParams<M> | CodexRequestParamsFactory<M>;
  capture?(context: CodexRequestPlanExecutionContext, response: CodexProtocolResponse<M>): void;
};

export type CodexRequestPlan = {
  intent: CodexRequestPlanIntent;
  label?: string;
  steps: CodexRequestPlanStep[];
};

export type CodexExecutedRequest = {
  id: string;
  method: string;
  params: unknown;
  response?: unknown;
};

export type CodexRequestPlanExecutionResult = {
  plan: CodexRequestPlan;
  requests: CodexExecutedRequest[];
  context: CodexRequestPlanExecutionContext;
  activeThreadId?: string;
};

export function planInitialize(): CodexRequestPlan {
  return {
    intent: "initialize",
    steps: []
  };
}

export function planStartThread(input: {
  cwd?: string;
  sandbox?: MessageRequest["sandbox"];
  defaults?: CodexUIRuntimeDefaults;
} = {}): CodexRequestPlan {
  return {
    intent: "newThread",
    steps: [startThreadStep(input)]
  };
}

export function planResumeThread(input: {
  threadId?: string;
  cwd?: string;
  sandbox?: MessageRequest["sandbox"];
  defaults?: CodexUIRuntimeDefaults;
} = {}): CodexRequestPlan {
  return {
    intent: "resumeThread",
    steps: [resumeThreadStep(input)]
  };
}

export function planTurnStart(input: {
  input: CodexUIMessageInput;
  model?: MessageRequest["model"] | null;
  reasoningEffort?: MessageRequest["reasoningEffort"] | null;
  cwd?: string;
  sandbox?: MessageRequest["sandbox"];
  approvalPolicy?: MessageRequest["approvalPolicy"];
  defaults?: CodexUIRuntimeDefaults;
}): CodexRequestPlan {
  return {
    intent: "protocolRequest",
    steps: [turnStartStep(input)]
  };
}

export function planSendMessageToThread(input: CodexUIThreadMessageOptions & {
  defaults?: CodexUIRuntimeDefaults;
}): CodexRequestPlan {
  return {
    intent: "sendMessage",
    steps: [
      resumeThreadStep({
        threadId: input.threadId,
        cwd: input.cwd,
        sandbox: input.sandbox,
        approvalPolicy: input.approvalPolicy,
        model: input.model,
        defaults: input.defaults
      }),
      turnStartStep(input)
    ]
  };
}

export function planStartThreadWithMessage(input: CodexUIStartThreadMessageOptions & {
  defaults?: CodexUIRuntimeDefaults;
}): CodexRequestPlan {
  return {
    intent: "startThreadWithMessage",
    steps: [
      startThreadStep({
        cwd: input.cwd,
        sandbox: input.sandbox,
        approvalPolicy: input.approvalPolicy,
        model: input.model,
        defaults: input.defaults
      }),
      turnStartStep(input)
    ]
  };
}

export function planSendMessage(input: CodexUIMessageOptions & {
  defaults?: CodexUIRuntimeDefaults;
}): CodexRequestPlan {
  if (input.startNewThread) {
    return {
      intent: "sendMessage",
      steps: [
        startThreadStep({
          cwd: input.cwd,
          sandbox: input.sandbox,
          approvalPolicy: input.approvalPolicy,
          model: input.model,
          defaults: input.defaults
        }),
        turnStartStep(input)
      ]
    };
  }

  return {
    intent: "sendMessage",
    steps: [
      resumeThreadStep({
        cwd: input.cwd,
        sandbox: input.sandbox,
        approvalPolicy: input.approvalPolicy,
        model: input.model,
        defaults: input.defaults,
        skipWithoutThread: true
      }),
      startThreadStep({
        cwd: input.cwd,
        sandbox: input.sandbox,
        approvalPolicy: input.approvalPolicy,
        model: input.model,
        defaults: input.defaults,
        skipWithThread: true
      }),
      turnStartStep(input)
    ]
  };
}

export function planListThreads(
  params: Partial<CodexRequestParams<"thread/list">> = {}
): CodexRequestPlan {
  return {
    intent: "listThreads",
    steps: [{
      type: "request",
      method: "thread/list",
      params: {
        limit: params.limit ?? 80,
        sortKey: params.sortKey ?? "updated_at",
        sortDirection: params.sortDirection ?? "desc",
        sourceKinds: params.sourceKinds ?? [],
        archived: params.archived ?? false,
        cwd: "cwd" in params ? params.cwd : null,
        ...params
      }
    }]
  };
}

export function planOpenThread(input: {
  threadId?: string;
  includeTurns?: boolean;
  readSessionFile?: boolean;
} = {}): CodexRequestPlan {
  return {
    intent: "openThread",
    steps: [
      threadReadStep(input),
      threadReadFileStep(Boolean(input.readSessionFile))
    ]
  };
}

export function planArchiveThread(input: { threadId?: string } = {}): CodexRequestPlan {
  return {
    intent: "archiveThread",
    steps: [{
      type: "request",
      method: "thread/archive",
      params: (context) => {
        const threadId = input.threadId ?? context.activeThreadId;
        return threadId ? { threadId } : undefined;
      }
    }]
  };
}

export function planCompactThread(input: { threadId?: string } = {}): CodexRequestPlan {
  return {
    intent: "compactThread",
    steps: [{
      type: "request",
      method: "thread/compact/start",
      params: (context) => {
        const threadId = input.threadId ?? context.activeThreadId;
        return threadId ? { threadId } : undefined;
      }
    }]
  };
}

export function planStopTurn(input: { threadId?: string; turnId?: string } = {}): CodexRequestPlan {
  return {
    intent: "stopTurn",
    steps: [{
      type: "request",
      method: "turn/interrupt",
      params: (context) => ({
        threadId: input.threadId ?? context.activeThreadId,
        turnId: input.turnId ?? context.activeTurnId
      })
    }]
  };
}

export async function executeCodexRequestPlan(input: {
  plan: CodexRequestPlan;
  context: CodexRequestPlanContext;
  transport: CodexTransport;
}): Promise<CodexRequestPlanExecutionResult> {
  const context: CodexRequestPlanExecutionContext = { ...input.context };
  const requests: CodexExecutedRequest[] = [];

  if (input.plan.intent === "initialize") {
    const maybeInitializable = input.transport as CodexTransport & { initialize?: () => Promise<void> };
    await maybeInitializable.initialize?.();
    return { plan: input.plan, requests, context, activeThreadId: context.activeThreadId };
  }

  for (const step of input.plan.steps) {
    const params = typeof step.params === "function"
      ? step.params(context)
      : step.params;
    if (!params) {
      continue;
    }
    const response = await input.transport.request(step.method, params);
    captureResponse(step.method, context, response);
    step.capture?.(context, response);
    requests.push({
      id: requests.length.toString(),
      method: step.method,
      params,
      response
    });
  }

  return {
    plan: input.plan,
    requests,
    context,
    activeThreadId: context.activeThreadId
  };
}

export function parseCodexUIMessageInput(input: CodexUIMessageInput): CodexParsedUserInput[] {
  return typeof input === "string"
    ? [{ type: "text", text: input, text_elements: [] }]
    : input;
}

export function normalizeCodexUIMessageRequest(input: CodexUIMessageRequest): CodexUIMessageOptions {
  if (typeof input === "string" || Array.isArray(input)) {
    return { input };
  }
  return input;
}

export function createCodexTurnStartRequestParams(input: {
  activeThreadId: string;
  cwd?: string;
  defaults?: CodexUIRuntimeDefaults;
  input: CodexUIMessageInput;
  model?: MessageRequest["model"] | null;
  reasoningEffort?: MessageRequest["reasoningEffort"] | null;
  sandbox?: MessageRequest["sandbox"];
  approvalPolicy?: MessageRequest["approvalPolicy"];
}): CodexRequestParams<"turn/start"> {
  const cwd = input.cwd ?? input.defaults?.cwd ?? currentCwd();
  return {
    threadId: input.activeThreadId,
    input: parseCodexUIMessageInput(input.input),
    cwd,
    approvalPolicy: input.approvalPolicy ?? input.defaults?.approvalPolicy ?? "never",
    sandboxPolicy: toSandboxPolicy(input.sandbox ?? input.defaults?.sandbox ?? "read-only", cwd),
    model: input.model ?? input.defaults?.model ?? null,
    effort: input.reasoningEffort ?? input.defaults?.reasoningEffort ?? "medium"
  };
}

export function currentCwd(): string {
  const maybeProcess = (globalThis as typeof globalThis & {
    process?: { cwd?: () => string };
  }).process;
  return typeof maybeProcess?.cwd === "function" ? maybeProcess.cwd() : "/";
}

function startThreadStep(input: {
  cwd?: string;
  sandbox?: MessageRequest["sandbox"];
  approvalPolicy?: MessageRequest["approvalPolicy"];
  model?: MessageRequest["model"] | null;
  defaults?: CodexUIRuntimeDefaults;
  skipWithThread?: boolean;
}): CodexRequestPlanStep<"thread/start"> {
  return {
    type: "request",
    method: "thread/start",
    params: (context) => {
      if (input.skipWithThread && context.activeThreadId) {
        return undefined;
      }
      const defaults = input.defaults ?? context.defaults;
      return {
        cwd: input.cwd ?? context.cwd ?? defaults?.cwd ?? currentCwd(),
        model: input.model ?? defaults?.model ?? null,
        modelProvider: defaults?.modelProvider ?? null,
        approvalPolicy: input.approvalPolicy ?? defaults?.approvalPolicy ?? "never",
        sandbox: input.sandbox ?? defaults?.sandbox ?? "read-only",
        ephemeral: defaults?.ephemeral ?? false,
        [CODEX_THREAD_START_EXTENDED_EVENTS_FIELD]: false,
        persistExtendedHistory: true
      };
    }
  };
}

function resumeThreadStep(input: {
  threadId?: string;
  cwd?: string;
  sandbox?: MessageRequest["sandbox"];
  approvalPolicy?: MessageRequest["approvalPolicy"];
  model?: MessageRequest["model"] | null;
  defaults?: CodexUIRuntimeDefaults;
  skipWithoutThread?: boolean;
}): CodexRequestPlanStep<"thread/resume"> {
  return {
    type: "request",
    method: "thread/resume",
    params: (context) => {
      const threadId = input.threadId ?? context.activeThreadId;
      if (!threadId && input.skipWithoutThread) {
        return undefined;
      }
      if (!threadId) {
        throw new Error("Cannot resume a thread without a thread id");
      }
      const defaults = input.defaults ?? context.defaults;
      return {
        threadId,
        cwd: input.cwd ?? context.cwd ?? defaults?.cwd ?? currentCwd(),
        model: input.model ?? defaults?.model ?? null,
        modelProvider: defaults?.modelProvider ?? null,
        approvalPolicy: input.approvalPolicy ?? defaults?.approvalPolicy ?? "never",
        sandbox: input.sandbox ?? defaults?.sandbox ?? "read-only",
        persistExtendedHistory: true
      };
    }
  };
}

function turnStartStep(input: {
  input: CodexUIMessageInput;
  cwd?: string;
  sandbox?: MessageRequest["sandbox"];
  approvalPolicy?: MessageRequest["approvalPolicy"];
  model?: MessageRequest["model"] | null;
  reasoningEffort?: MessageRequest["reasoningEffort"] | null;
  defaults?: CodexUIRuntimeDefaults;
}): CodexRequestPlanStep<"turn/start"> {
  return {
    type: "dependentRequest",
    method: "turn/start",
    params: (context) => {
      if (!context.activeThreadId) {
        throw new Error("Cannot start a turn without a thread id");
      }
      return createCodexTurnStartRequestParams({
        ...input,
        activeThreadId: context.activeThreadId,
        cwd: input.cwd ?? context.cwd,
        defaults: input.defaults ?? context.defaults
      });
    }
  };
}

function threadReadStep(input: {
  threadId?: string;
  includeTurns?: boolean;
}): CodexRequestPlanStep<"thread/read"> {
  return {
    type: "request",
    method: "thread/read",
    params: (context) => {
      const threadId = input.threadId ?? context.activeThreadId;
      if (!threadId) {
        throw new Error("Cannot read a thread without a thread id");
      }
      return {
        threadId,
        includeTurns: input.includeTurns ?? true
      };
    }
  };
}

function threadReadFileStep(enabled: boolean): CodexRequestPlanStep<"fs/readFile"> {
  return {
    type: "dependentRequest",
    method: "fs/readFile",
    params: (context) => context.lastThreadPath && enabled
      ? { path: context.lastThreadPath }
      : undefined
  };
}

function captureResponse<M extends CodexRequestMethod>(
  method: M,
  context: CodexRequestPlanExecutionContext,
  response: CodexProtocolResponse<M>
): void {
  const responseRecord = response as {
    thread?: { id?: unknown; cwd?: unknown; path?: unknown };
    turn?: { id?: unknown };
  };
  const thread = responseRecord.thread as { id?: unknown; cwd?: unknown; path?: unknown } | undefined;
  const turn = responseRecord.turn as { id?: unknown } | undefined;
  if (typeof thread?.id === "string") {
    context.activeThreadId = thread.id;
  }
  if (typeof thread?.cwd === "string") {
    context.cwd = thread.cwd;
  }
  if (method === "thread/read") {
    context.lastThreadPath = typeof thread?.path === "string" ? thread.path : undefined;
  }
  if (typeof turn?.id === "string") {
    context.activeTurnId = turn.id;
  }
}

function toSandboxPolicy(
  sandbox: MessageRequest["sandbox"],
  cwd: string
): CodexRequestParams<"turn/start">["sandboxPolicy"] {
  if (sandbox === "danger-full-access") {
    return { type: "dangerFullAccess" };
  }
  if (sandbox === "workspace-write") {
    return {
      type: "workspaceWrite",
      writableRoots: [cwd],
      networkAccess: false,
      excludeTmpdirEnvVar: false,
      excludeSlashTmp: false
    };
  }
  return { type: "readOnly", networkAccess: false };
}
