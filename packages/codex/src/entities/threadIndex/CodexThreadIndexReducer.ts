import {
  CodexTrafficPacket,
  codexCanonicalRequestId,
  type CodexParsedThread,
  type CodexProtocolResponse,
  type CodexProtocolTraffic
} from "../../protocol/stream/index.js";

export type CodexThreadIndexActivity = "none" | "running";

export type CodexThreadIndexItem = {
  threadId: string;
  title: string;
  cwd?: string;
  path?: string;
  updatedAt?: string;
  activity: CodexThreadIndexActivity;
};

export type CodexProjectIndexItem = {
  cwd: string;
  name: string;
  threadIds: string[];
};

export type CodexThreadIndexStatus = "idle" | "loading" | "ready" | "failed";

export type CodexThreadIndexState = {
  status: CodexThreadIndexStatus;
  activeRequestIds: string[];
  threadsById: Record<string, CodexThreadIndexItem>;
  threadIdsByTurnId: Record<string, string>;
  threadOrder: string[];
  projectsByCwd: Record<string, CodexProjectIndexItem>;
  projectOrder: string[];
  error?: string;
};

export class CodexThreadIndexReducer {
  initialState(): CodexThreadIndexState {
    return finalizeState({
      status: "idle",
      activeRequestIds: [],
      threadsById: {},
      threadIdsByTurnId: {},
      threadOrder: [],
      projectsByCwd: {},
      projectOrder: []
    });
  }

  reduce(
    previous: CodexThreadIndexState | undefined,
    traffic: CodexProtocolTraffic
  ): CodexThreadIndexState {
    const state = previous ?? this.initialState();

    if (traffic.kind === "request" && traffic.method === "thread/list") {
      return {
        ...state,
        status: "loading",
        activeRequestIds: rememberRequest(state.activeRequestIds, codexCanonicalRequestId(traffic)),
        error: undefined
      };
    }

    if (traffic.kind === "response" && traffic.method === "thread/list") {
      const response = traffic.response as CodexProtocolResponse<"thread/list">;
      return finalizeState(mergeThreads({
        ...state,
        status: "ready",
        activeRequestIds: forgetRequest(state.activeRequestIds, codexCanonicalRequestId(traffic)),
        error: undefined
      }, response.data ?? []));
    }

    if (traffic.kind === "responseError" && traffic.method === "thread/list") {
      return {
        ...state,
        status: "failed",
        activeRequestIds: forgetRequest(state.activeRequestIds, codexCanonicalRequestId(traffic)),
        error: errorMessage(traffic.error)
      };
    }

    if (traffic.kind === "request" && traffic.method === "turn/start") {
      const threadId = stringValue((traffic.params as { threadId?: unknown }).threadId);
      if (!threadId) {
        return state;
      }
      return finalizeState(patchOrCreateThread(state, threadId, {
        activity: "running",
        updatedAt: timestampIso(traffic.timestampMs ?? Date.now())
      }));
    }

    if (
      traffic.kind === "response" &&
      (traffic.method === "thread/start" || traffic.method === "thread/resume" || traffic.method === "thread/read")
    ) {
      const thread = threadFromResponse(traffic.response);
      return thread ? finalizeState(upsertThread(state, thread)) : state;
    }

    if (traffic.kind !== "event") {
      return state;
    }

    const packet = CodexTrafficPacket.from(traffic);
    const event = traffic.event;
    const params = event.params as Record<string, unknown>;
    const method = event.method === "unknown" ? event.eventMethod : event.method;

    if (method === "thread/started") {
      const thread = asThread(params.thread);
      return thread ? finalizeState(upsertThread(state, thread)) : state;
    }

    if (method === "thread/status/changed") {
      const threadId = stringValue(params.threadId) ?? packet.threadId;
      if (!threadId) {
        return state;
      }
      const active = isActiveStatus(params.status);
      return finalizeState(patchOrCreateThread(state, threadId, {
        activity: active ? "running" : "none",
        updatedAt: active ? timestampIso(traffic.timestampMs ?? Date.now()) : undefined
      }));
    }

    if (method === "turn/started") {
      const threadId = stringValue(params.threadId) ?? packet.threadId;
      if (!threadId) {
        return state;
      }
      const turnId = stringValue(params.turnId) ?? packet.turnId;
      return finalizeState(rememberTurnThreadId(patchOrCreateThread(state, threadId, {
        activity: "running",
        updatedAt: timestampIso(traffic.timestampMs ?? Date.now())
      }), turnId, threadId));
    }

    if (method === "turn/completed") {
      const turnId = stringValue(params.turnId) ?? packet.turnId;
      const threadId = stringValue(params.threadId) ?? packet.threadId ?? threadIdForTurn(state, turnId);
      return threadId ? finalizeState(patchOrCreateThread(state, threadId, { activity: "none" })) : state;
    }

    if (method === "thread/name/updated") {
      const threadId = stringValue(params.threadId) ?? packet.threadId;
      const title = stringValue(params.threadName);
      return threadId && title ? finalizeState(patchThread(state, threadId, { title })) : state;
    }

    if (method === "thread/archived") {
      const threadId = stringValue(params.threadId) ?? packet.threadId;
      return threadId ? finalizeState(removeThread(state, threadId)) : state;
    }

    if (method === "thread/unarchived") {
      const thread = asThread(params.thread);
      return thread ? finalizeState(upsertThread(state, thread)) : state;
    }

    return state;
  }
}

function mergeThreads(state: CodexThreadIndexState, threads: CodexParsedThread[]): CodexThreadIndexState {
  let next = state;
  for (const thread of threads) {
    next = upsertThreadWithExisting(next, thread, state.threadsById[thread.id]);
  }
  return next;
}

function upsertThread(state: CodexThreadIndexState, thread: CodexParsedThread): CodexThreadIndexState {
  return upsertThreadWithExisting(state, thread, state.threadsById[thread.id]);
}

function upsertThreadWithExisting(
  state: CodexThreadIndexState,
  thread: CodexParsedThread,
  existing: CodexThreadIndexItem | undefined
): CodexThreadIndexState {
  return {
    ...state,
    threadsById: {
      ...state.threadsById,
      [thread.id]: {
        threadId: thread.id,
        title: thread.name ?? thread.preview ?? existing?.title ?? "Untitled",
        cwd: thread.cwd ?? existing?.cwd,
        path: thread.path ?? existing?.path,
        updatedAt: timestampIso(thread.updatedAt ?? thread.createdAt) ?? existing?.updatedAt,
        activity: activityFromStatus(thread.status) ?? existing?.activity ?? "none"
      }
    },
    threadOrder: unique([...state.threadOrder, thread.id])
  };
}

function patchThread(
  state: CodexThreadIndexState,
  threadId: string,
  patch: Partial<CodexThreadIndexItem>
): CodexThreadIndexState {
  const existing = state.threadsById[threadId];
  if (!existing) {
    return state;
  }
  return {
    ...state,
    threadsById: {
      ...state.threadsById,
      [threadId]: {
        ...existing,
        ...patch
      }
    }
  };
}

function patchOrCreateThread(
  state: CodexThreadIndexState,
  threadId: string,
  patch: Partial<CodexThreadIndexItem>
): CodexThreadIndexState {
  const existing = state.threadsById[threadId];
  if (existing) {
    return patchThread(state, threadId, patch);
  }
  return {
    ...state,
    threadsById: {
      ...state.threadsById,
      [threadId]: {
        threadId,
        title: patch.title ?? "Untitled",
        cwd: patch.cwd,
        path: patch.path,
        updatedAt: patch.updatedAt,
        activity: patch.activity ?? "none"
      }
    },
    threadOrder: unique([...state.threadOrder, threadId])
  };
}

function rememberTurnThreadId(
  state: CodexThreadIndexState,
  turnId: string | undefined,
  threadId: string
): CodexThreadIndexState {
  if (!turnId || state.threadIdsByTurnId?.[turnId] === threadId) {
    return state;
  }
  return {
    ...state,
    threadIdsByTurnId: {
      ...state.threadIdsByTurnId,
      [turnId]: threadId
    }
  };
}

function threadIdForTurn(
  state: CodexThreadIndexState,
  turnId: string | undefined
): string | undefined {
  return turnId ? state.threadIdsByTurnId?.[turnId] : undefined;
}

function removeThread(state: CodexThreadIndexState, threadId: string): CodexThreadIndexState {
  const { [threadId]: _removed, ...threadsById } = state.threadsById;
  return {
    ...state,
    threadsById,
    threadOrder: state.threadOrder.filter((id) => id !== threadId)
  };
}

function finalizeState(state: CodexThreadIndexState): CodexThreadIndexState {
  const projectsByCwd: Record<string, CodexProjectIndexItem> = {};
  const sortedThreadOrder = unique([...state.threadOrder, ...Object.keys(state.threadsById)])
    .filter((threadId) => Boolean(state.threadsById[threadId]))
    .sort((a, b) =>
      compareThreadActivity(state.threadsById[a], state.threadsById[b])
    );

  for (const threadId of sortedThreadOrder) {
    const thread = state.threadsById[threadId];
    if (!thread?.cwd) {
      continue;
    }
    const project = projectsByCwd[thread.cwd] ?? {
      cwd: thread.cwd,
      name: folderName(thread.cwd),
      threadIds: []
    };
    projectsByCwd[thread.cwd] = {
      ...project,
      threadIds: [...project.threadIds, threadId]
    };
  }

  const projectOrder = Object.values(projectsByCwd)
    .sort((a, b) => compareProjectActivity(a, b, state.threadsById))
    .map((project) => project.cwd);

  return {
    ...state,
    threadIdsByTurnId: state.threadIdsByTurnId ?? {},
    threadOrder: sortedThreadOrder,
    projectsByCwd,
    projectOrder
  };
}

function rememberRequest(requestIds: string[], requestId: string): string[] {
  return requestIds.includes(requestId) ? requestIds : [...requestIds, requestId];
}

function forgetRequest(requestIds: string[], requestId: string): string[] {
  return requestIds.filter((id) => id !== requestId);
}

function isActiveStatus(status: unknown): boolean {
  return Boolean(status && typeof status === "object" && "type" in status && status.type === "active");
}

function activityFromStatus(status: unknown): CodexThreadIndexActivity | undefined {
  if (!status || typeof status !== "object" || !("type" in status)) {
    return undefined;
  }
  return status.type === "active" ? "running" : "none";
}

function threadFromResponse(response: unknown): CodexParsedThread | undefined {
  return response && typeof response === "object" && "thread" in response
    ? asThread(response.thread)
    : undefined;
}

function errorMessage(error: Extract<CodexProtocolTraffic, { kind: "responseError" }>["error"]): string {
  return typeof error.message === "string" ? error.message : JSON.stringify(error);
}

function asThread(value: unknown): CodexParsedThread | undefined {
  return value && typeof value === "object" && "id" in value && typeof value.id === "string"
    ? value as CodexParsedThread
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function timestampIso(value: unknown): string | undefined {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "number") {
    return new Date(value < 10_000_000_000 ? value * 1000 : value).toISOString();
  }
  if (typeof value === "string") {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
  }
  return undefined;
}

function compareThreadActivity(a: CodexThreadIndexItem | undefined, b: CodexThreadIndexItem | undefined): number {
  const timestampDelta = timestampMs(b?.updatedAt) - timestampMs(a?.updatedAt);
  if (timestampDelta !== 0) {
    return timestampDelta;
  }
  return (b?.threadId ?? "").localeCompare(a?.threadId ?? "");
}

function compareProjectActivity(
  a: CodexProjectIndexItem,
  b: CodexProjectIndexItem,
  threadsById: Record<string, CodexThreadIndexItem>
): number {
  const timestampDelta = newestProjectTimestamp(b, threadsById) - newestProjectTimestamp(a, threadsById);
  if (timestampDelta !== 0) {
    return timestampDelta;
  }
  return b.cwd.localeCompare(a.cwd);
}

function newestProjectTimestamp(
  project: CodexProjectIndexItem,
  threadsById: Record<string, CodexThreadIndexItem>
): number {
  return Math.max(0, ...project.threadIds.map((threadId) => timestampMs(threadsById[threadId]?.updatedAt)));
}

function timestampMs(value: string | undefined): number {
  if (!value) {
    return 0;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function folderName(cwd: string): string {
  return cwd.split("/").filter(Boolean).at(-1) ?? cwd;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
