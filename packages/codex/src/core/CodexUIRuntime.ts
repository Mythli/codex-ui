import {
  CodexThreadReducer,
  type CodexRenderBlock,
  type CodexThreadStatus,
  type CodexTranscriptState,
  type CodexThreadState
} from "../entities/transcript/index.js";
import {
  CodexThreadIndexReducer,
  type CodexThreadIndexState
} from "../entities/threadIndex/index.js";
import {
  CodexTrafficPacket,
  type CodexRequestParams,
  type CodexProtocolTraffic
} from "../protocol/stream/index.js";
import {
  currentCwd,
  executeCodexRequestPlan,
  planArchiveThread,
  planListThreads,
  planOpenThread,
  planSendMessageToThread,
  planStartThread,
  planStartThreadWithMessage,
  planStopTurn,
  type CodexRequestPlanContext,
  type CodexUIStartThreadMessageOptions,
  type CodexUIThreadMessageOptions,
  type CodexUIRuntimeDefaults
} from "./CodexActionPlanner.js";
import { CodexRuntimeTrafficLedger } from "./CodexRuntimeTrafficLedger.js";
import type {
  CodexModelReroute,
  CodexRuntimeSessionSettings,
  CodexThreadTokenUsage
} from "../entities/transcript/index.js";
import type { CodexTransport } from "./transport/CodexTransport.js";

export type CodexUIRuntimeOptions = {
  transport: CodexTransport;
  defaults?: CodexUIRuntimeDefaults;
};

export type CodexRuntimeStatus = "empty" | CodexThreadStatus;

export type CodexRuntimeState = {
  threadId?: string;
  title?: string;
  cwd?: string;
  status: CodexRuntimeStatus;
  activeRequestIds: string[];
  activeTurnId?: string;
  error?: string;
  session?: CodexRuntimeSessionSettings;
  tokenUsage?: CodexThreadTokenUsage;
  modelReroute?: CodexModelReroute;
  modelVerification?: unknown[];
  transcript?: CodexTranscriptState;
  renderBlocks: CodexRenderBlock[];
  thread?: CodexThreadState;
};

export type CodexUIRuntimeActions = {
  activateThread(threadId: string): void;
  openThread(threadId: string): Promise<void>;
  refreshThreadIndex(input?: Pick<CodexRequestParams<"thread/list">, "limit" | "cwd">): Promise<void>;
  sendMessageToThread(input: CodexUIThreadMessageOptions): Promise<void>;
  startThreadWithMessage(input: CodexUIStartThreadMessageOptions): Promise<{ threadId: string }>;
  stopTurn(): Promise<void>;
  archiveThread(threadId?: string): Promise<void>;
  newThread(options?: { cwd?: string }): Promise<void>;
};

export type CodexUIRuntime = {
  readonly state: CodexRuntimeState;
  readonly threadIndex: CodexThreadIndexState;
  readonly actions: CodexUIRuntimeActions;
  dispatch(traffic: CodexProtocolTraffic): void;
  shouldLoadThread(threadId: string): boolean;
  subscribe(listener: (state: CodexRuntimeState) => void): () => void;
  subscribeThreadIndex(listener: (state: CodexThreadIndexState) => void): () => void;
  close(): void;
};

type ThreadCacheMetadata = {
  loadedAtMs: number;
  loadedIndexUpdatedAt?: string;
  loadedSessionPath?: string;
};

function isCachedThreadStale(
  threadIndex: CodexThreadIndexState,
  threadId: string,
  metadata: ThreadCacheMetadata
): boolean {
  const indexed = threadIndex.threadsById[threadId];
  if (indexed?.path && metadata.loadedSessionPath !== indexed.path) {
    return true;
  }
  if (indexed?.updatedAt && metadata.loadedIndexUpdatedAt !== indexed.updatedAt) {
    return true;
  }
  return false;
}

function isCompletedThreadLoad(state: CodexThreadState, traffic: CodexProtocolTraffic): boolean {
  if (state.status !== "ready" || state.activeRequestIds.length > 0) {
    return false;
  }
  if (traffic.kind === "response" && traffic.method === "fs/readFile") {
    return true;
  }
  if (traffic.kind === "response" && traffic.method === "thread/read") {
    return !state.sessionPath;
  }
  return false;
}

export function createCodexUIRuntime(options: CodexUIRuntimeOptions): CodexUIRuntime {
  return new CodexUIRuntimeImpl(options);
}

class CodexUIRuntimeImpl implements CodexUIRuntime {
  #activeThreadId?: string;
  #reducersByThreadId = new Map<string, CodexThreadReducer>();
  #threadStatesByThreadId = new Map<string, CodexThreadState>();
  #threadCacheMetadataByThreadId = new Map<string, ThreadCacheMetadata>();
  #threadIndexReducer = new CodexThreadIndexReducer();
  #trafficLedger = new CodexRuntimeTrafficLedger();
  #state: CodexRuntimeState = emptyRuntimeState();
  #threadIndexState: CodexThreadIndexState = this.#threadIndexReducer.initialState();
  #listeners = new Set<(state: CodexRuntimeState) => void>();
  #threadIndexListeners = new Set<(state: CodexThreadIndexState) => void>();
  #awaitingThreadStart = false;
  #pendingThreadStartRequestIds = new Set<string>();
  #unsubscribe: () => void;

  readonly actions: CodexUIRuntimeActions = {
    activateThread: (threadId) => this.activateThread(threadId),
    openThread: (threadId) => this.openThread(threadId),
    refreshThreadIndex: (input) => this.refreshThreadIndex(input),
    sendMessageToThread: (input) => this.sendMessageToThread(input),
    startThreadWithMessage: (input) => this.startThreadWithMessage(input),
    stopTurn: () => this.stopTurn(),
    archiveThread: (threadId) => this.archiveThread(threadId),
    newThread: (options) => this.newThread(options)
  };

  constructor(private readonly options: CodexUIRuntimeOptions) {
    this.#unsubscribe = options.transport.onTraffic((traffic) => this.dispatch(traffic));
  }

  get state(): CodexRuntimeState {
    return this.#state;
  }

  get threadIndex(): CodexThreadIndexState {
    return this.#threadIndexState;
  }

  dispatch(traffic: CodexProtocolTraffic): void {
    if (!this.#trafficLedger.shouldReduce(traffic)) {
      return;
    }

    const beforeThreadIndex = summarizeThreadIndex(this.#threadIndexState);
    const beforeRuntime = summarizeRuntimeState(this.#state);
    let activeThreadReduction = "skipped";
    let dispatchAction = "reduce";

    this.#threadIndexState = this.#threadIndexReducer.reduce(this.#threadIndexState, traffic);
    this.emitThreadIndex();

    const packet = CodexTrafficPacket.from(traffic);
    if (packet.isEvent("thread/archived") && packet.threadId) {
      this.#reducersByThreadId.delete(packet.threadId);
      this.#threadStatesByThreadId.delete(packet.threadId);
      this.#threadCacheMetadataByThreadId.delete(packet.threadId);
      if (packet.threadId === this.#activeThreadId) {
        this.#activeThreadId = undefined;
        this.#state = emptyRuntimeState();
        this.emit();
      }
      dispatchAction = "active-thread-archived";
      logRuntimeReduction(traffic, packet, {
        activeThreadReduction,
        dispatchAction,
        beforeRuntime,
        beforeThreadIndex,
        afterRuntime: summarizeRuntimeState(this.#state),
        afterThreadIndex: summarizeThreadIndex(this.#threadIndexState)
      });
      return;
    }
    if (this.#awaitingThreadStart && packet.isRequest("thread/start") && packet.requestId) {
      this.#pendingThreadStartRequestIds.add(packet.requestId);
      dispatchAction = "remember-pending-thread-start";
      logRuntimeReduction(traffic, packet, {
        activeThreadReduction,
        dispatchAction,
        beforeRuntime,
        beforeThreadIndex,
        afterRuntime: summarizeRuntimeState(this.#state),
        afterThreadIndex: summarizeThreadIndex(this.#threadIndexState)
      });
      return;
    }
    if (this.isPendingThreadStartResult(packet)) {
      if (traffic.kind === "responseError") {
        this.#state = { ...emptyRuntimeState("failed"), error: runtimeErrorMessage(traffic.error) };
        this.forgetPendingThreadStart(packet.requestId);
        this.emit();
        dispatchAction = "pending-thread-start-failed";
        logRuntimeReduction(traffic, packet, {
          activeThreadReduction,
          dispatchAction,
          beforeRuntime,
          beforeThreadIndex,
          afterRuntime: summarizeRuntimeState(this.#state),
          afterThreadIndex: summarizeThreadIndex(this.#threadIndexState)
        });
        return;
      }
      if (packet.threadId) {
        this.activateThread(packet.threadId);
        dispatchAction = "activate-pending-thread";
      }
      this.forgetPendingThreadStart(packet.requestId);
    }
    if (!this.#activeThreadId && this.isThreadActivationTraffic(traffic, packet)) {
      this.activateThread(packet.threadId!);
      dispatchAction = "activate-thread";
    }
    const targetThreadId = this.targetThreadIdForTraffic(traffic, packet);
    if (targetThreadId) {
      const { previous, next } = this.reduceThread(targetThreadId, traffic);
      activeThreadReduction = previous === next ? "ignored" : "reduced";
      if (targetThreadId === this.#activeThreadId) {
        this.#state = runtimeStateFromThread(next);
        this.emit();
      }
    }
    logRuntimeReduction(traffic, packet, {
      activeThreadReduction,
      dispatchAction,
      beforeRuntime,
      beforeThreadIndex,
      afterRuntime: summarizeRuntimeState(this.#state),
      afterThreadIndex: summarizeThreadIndex(this.#threadIndexState)
    });
  }

  subscribe(listener: (state: CodexRuntimeState) => void): () => void {
    this.#listeners.add(listener);
    listener(this.#state);
    return () => this.#listeners.delete(listener);
  }

  shouldLoadThread(threadId: string): boolean {
    const state = this.#threadStatesByThreadId.get(threadId);
    if (!state) {
      return true;
    }
    if (state.status === "failed") {
      return true;
    }
    if (state.status === "loading" || state.activeRequestIds.length > 0) {
      return false;
    }

    const metadata = this.#threadCacheMetadataByThreadId.get(threadId);
    if (!metadata) {
      return true;
    }

    return isCachedThreadStale(this.#threadIndexState, threadId, metadata);
  }

  subscribeThreadIndex(listener: (state: CodexThreadIndexState) => void): () => void {
    this.#threadIndexListeners.add(listener);
    listener(this.#threadIndexState);
    return () => this.#threadIndexListeners.delete(listener);
  }

  close(): void {
    this.#unsubscribe();
    this.options.transport.close();
  }

  private async openThread(threadId: string): Promise<void> {
    this.activateThread(threadId);
    await executeCodexRequestPlan({
      plan: planOpenThread({ threadId, includeTurns: false, readSessionFile: true }),
      context: this.actionContext({ activeThreadId: threadId }),
      transport: this.options.transport
    });
  }

  private async refreshThreadIndex(input: Pick<CodexRequestParams<"thread/list">, "limit" | "cwd"> = {}): Promise<void> {
    await executeCodexRequestPlan({
      plan: planListThreads(input),
      context: this.actionContext(),
      transport: this.options.transport
    });
  }

  private async newThread(options: { cwd?: string } = {}): Promise<void> {
    this.#activeThreadId = undefined;
    this.#state = emptyRuntimeState("loading");
    this.emit();
    await this.withPendingThreadStart(async () => {
      const result = await executeCodexRequestPlan({
        plan: planStartThread({ cwd: options.cwd }),
        context: this.actionContext(),
        transport: this.options.transport
      });
      if (result.activeThreadId) {
        this.ensureThread(result.activeThreadId);
      }
    });
  }

  private async sendMessageToThread(input: CodexUIThreadMessageOptions): Promise<void> {
    this.ensureThread(input.threadId);
    const result = await executeCodexRequestPlan({
      plan: planSendMessageToThread(input),
      context: this.actionContext({ activeThreadId: input.threadId }),
      transport: this.options.transport
    });
    if (result.activeThreadId) {
      this.ensureThread(result.activeThreadId);
    }
  }

  private async startThreadWithMessage(input: CodexUIStartThreadMessageOptions): Promise<{ threadId: string }> {
    this.#activeThreadId = undefined;
    this.#state = emptyRuntimeState("loading");
    this.emit();
    let threadId: string | undefined;
    await this.withPendingThreadStart(async () => {
      const result = await executeCodexRequestPlan({
        plan: planStartThreadWithMessage(input),
        context: this.actionContext(),
        transport: this.options.transport
      });
      threadId = result.activeThreadId;
      if (threadId) {
        this.ensureThread(threadId);
      }
    });
    if (!threadId) {
      throw new Error("No thread id returned after starting thread with message");
    }
    return { threadId };
  }

  private async stopTurn(): Promise<void> {
    await executeCodexRequestPlan({
      plan: planStopTurn(),
      context: this.actionContext(),
      transport: this.options.transport
    });
  }

  private async archiveThread(threadId = this.#state.threadId): Promise<void> {
    await executeCodexRequestPlan({
      plan: planArchiveThread({ threadId }),
      context: this.actionContext(),
      transport: this.options.transport
    });
  }

  private activateThread(threadId: string): void {
    this.#activeThreadId = threadId;
    this.ensureThreadReducer(threadId);
    this.#state = runtimeStateFromThread(this.threadState(threadId));
    this.emit();
  }

  private ensureThread(threadId: string): void {
    if (this.#activeThreadId === threadId) {
      return;
    }
    this.activateThread(threadId);
  }

  private ensureThreadReducer(threadId: string): CodexThreadReducer {
    const existing = this.#reducersByThreadId.get(threadId);
    if (existing) {
      return existing;
    }
    const reducer = new CodexThreadReducer({
      threadId,
      sessionPath: this.#threadIndexState.threadsById[threadId]?.path
    });
    this.#reducersByThreadId.set(threadId, reducer);
    this.#threadStatesByThreadId.set(threadId, reducer.initialState());
    return reducer;
  }

  private threadState(threadId: string): CodexThreadState {
    this.ensureThreadReducer(threadId);
    return this.#threadStatesByThreadId.get(threadId)!;
  }

  private reduceThread(threadId: string, traffic: CodexProtocolTraffic): {
    previous: CodexThreadState;
    next: CodexThreadState;
  } {
    const reducer = this.ensureThreadReducer(threadId);
    const previous = this.threadState(threadId);
    const next = reducer.reduce(previous, traffic);
    this.#threadStatesByThreadId.set(threadId, next);
    this.rememberThreadLoaded(threadId, next, traffic);
    return { previous, next };
  }

  private rememberThreadLoaded(threadId: string, state: CodexThreadState, traffic: CodexProtocolTraffic): void {
    if (!isCompletedThreadLoad(state, traffic)) {
      return;
    }
    const indexed = this.#threadIndexState.threadsById[threadId];
    this.#threadCacheMetadataByThreadId.set(threadId, {
      loadedAtMs: Date.now(),
      loadedIndexUpdatedAt: indexed?.updatedAt,
      loadedSessionPath: state.sessionPath ?? indexed?.path
    });
  }

  private targetThreadIdForTraffic(traffic: CodexProtocolTraffic, packet: CodexTrafficPacket): string | undefined {
    if (packet.threadId) {
      return packet.threadId;
    }
    if (traffic.kind === "request" && traffic.method === "fs/readFile") {
      return this.threadIdForSessionPath(traffic.params.path);
    }
    if (packet.requestId) {
      return this.threadIdForRequestId(packet.requestId);
    }
    if (packet.turnId) {
      return this.threadIdForTurnId(packet.turnId);
    }
    return this.#activeThreadId;
  }

  private threadIdForSessionPath(path: unknown): string | undefined {
    if (typeof path !== "string") {
      return undefined;
    }
    for (const [threadId, state] of this.#threadStatesByThreadId) {
      if (state.sessionPath === path) {
        return threadId;
      }
    }
    for (const thread of Object.values(this.#threadIndexState.threadsById)) {
      if (thread.path === path) {
        return thread.threadId;
      }
    }
    return undefined;
  }

  private threadIdForRequestId(requestId: string): string | undefined {
    for (const [threadId, state] of this.#threadStatesByThreadId) {
      if (state.activeRequestIds.includes(requestId)) {
        return threadId;
      }
    }
    return undefined;
  }

  private threadIdForTurnId(turnId: string): string | undefined {
    for (const [threadId, state] of this.#threadStatesByThreadId) {
      if (state.activeTurnId === turnId) {
        return threadId;
      }
    }
    return undefined;
  }

  private isPendingThreadStartResult(packet: CodexTrafficPacket): boolean {
    if (!packet.requestId || !this.#pendingThreadStartRequestIds.has(packet.requestId)) {
      return false;
    }
    return packet.isResponse("thread/start") || packet.isErrorResponse("thread/start");
  }

  private isThreadActivationTraffic(traffic: CodexProtocolTraffic, packet: CodexTrafficPacket): boolean {
    if (!packet.threadId) {
      return false;
    }
    if (traffic.kind === "response") {
      return traffic.method === "thread/start" ||
        traffic.method === "thread/resume" ||
        traffic.method === "thread/read" ||
        traffic.method === "turn/start";
    }
    if (traffic.kind === "event") {
      return traffic.event.method !== "thread/archived";
    }
    return false;
  }

  private forgetPendingThreadStart(requestId: string | undefined): void {
    if (requestId) {
      this.#pendingThreadStartRequestIds.delete(requestId);
    }
  }

  private emit(): void {
    for (const listener of this.#listeners) {
      listener(this.#state);
    }
  }

  private emitThreadIndex(): void {
    for (const listener of this.#threadIndexListeners) {
      listener(this.#threadIndexState);
    }
  }

  private actionContext(overrides: Partial<CodexRequestPlanContext> = {}): CodexRequestPlanContext {
    return {
      activeThreadId: this.#state.threadId,
      activeTurnId: this.#state.activeTurnId,
      cwd: this.#state.cwd ?? this.options.defaults?.cwd ?? currentCwd(),
      defaults: this.options.defaults,
      ...overrides
    };
  }

  private async withPendingThreadStart(
    run: () => Promise<void>,
    enabled = true
  ): Promise<void> {
    const previous = this.#awaitingThreadStart;
    this.#awaitingThreadStart = previous || enabled;
    try {
      await run();
    } finally {
      this.#awaitingThreadStart = previous;
      if (!previous) {
        this.#pendingThreadStartRequestIds.clear();
      }
    }
  }
}

function emptyRuntimeState(status: CodexRuntimeStatus = "empty"): CodexRuntimeState {
  return {
    status,
    activeRequestIds: [],
    renderBlocks: []
  };
}

function runtimeStateFromThread(thread: CodexThreadState): CodexRuntimeState {
  return {
    ...thread,
    thread
  };
}

function runtimeErrorMessage(error: unknown): string {
  return error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message
    : JSON.stringify(error);
}

type RuntimeReductionSummary = {
  activeThreadReduction: string;
  dispatchAction: string;
  beforeRuntime: ReturnType<typeof summarizeRuntimeState>;
  beforeThreadIndex: ReturnType<typeof summarizeThreadIndex>;
  afterRuntime: ReturnType<typeof summarizeRuntimeState>;
  afterThreadIndex: ReturnType<typeof summarizeThreadIndex>;
};

function logRuntimeReduction(
  traffic: CodexProtocolTraffic,
  packet: CodexTrafficPacket,
  summary: RuntimeReductionSummary
): void {
  console.info(`[codex runtime reduce] ${trafficLabel(traffic, packet)} ${trafficSubject(traffic, packet, summary)}`, JSON.stringify({
    traffic: summarizeTraffic(traffic, packet),
    index: {
      changed: !sameSummary(summary.beforeThreadIndex, summary.afterThreadIndex),
      before: summary.beforeThreadIndex,
      after: summary.afterThreadIndex
    },
    activeThread: {
      reduction: summary.activeThreadReduction,
      action: summary.dispatchAction,
      changed: !sameSummary(summary.beforeRuntime, summary.afterRuntime),
      before: summary.beforeRuntime,
      after: summary.afterRuntime
    }
  }));
}

function trafficLabel(traffic: CodexProtocolTraffic, packet: CodexTrafficPacket): string {
  if (traffic.kind === "event") {
    const method = traffic.event.method === "unknown" ? traffic.event.eventMethod : traffic.event.method;
    return `${traffic.kind}:${method}`;
  }
  return packet.method ? `${traffic.kind}:${packet.method}` : traffic.kind;
}

function trafficSubject(
  traffic: CodexProtocolTraffic,
  packet: CodexTrafficPacket,
  summary: RuntimeReductionSummary
): string {
  if (packet.threadId) {
    return shortId(packet.threadId);
  }
  const path = trafficPath(traffic) ?? summary.afterRuntime.sessionPath ?? summary.beforeRuntime.sessionPath;
  return typeof path === "string" && path ? path : "-";
}

function shortId(value: string): string {
  return value.slice(0, 8);
}

function trafficPath(traffic: CodexProtocolTraffic): string | undefined {
  if (traffic.kind === "request" && traffic.method === "fs/readFile") {
    return typeof traffic.params.path === "string" ? traffic.params.path : undefined;
  }
  return undefined;
}

function summarizeTraffic(traffic: CodexProtocolTraffic, packet: CodexTrafficPacket): Record<string, unknown> {
  const base = {
    kind: traffic.kind,
    requestId: packet.requestId,
    threadId: packet.threadId,
    method: packet.method
  };

  if (traffic.kind === "request") {
    return {
      ...base,
      params: summarizeRequestParams(traffic.params)
    };
  }
  if (traffic.kind === "response") {
    return {
      ...base,
      response: summarizeResponse(traffic.response)
    };
  }
  if (traffic.kind === "responseError") {
    return {
      ...base,
      error: traffic.error
    };
  }
  if (traffic.kind === "event") {
    return {
      ...base,
      eventMethod: traffic.event.method === "unknown" ? traffic.event.eventMethod : traffic.event.method
    };
  }
  if (traffic.kind === "diagnostic") {
    return {
      ...base,
      text: traffic.text
    };
  }
  return base;
}

function summarizeRequestParams(params: unknown): Record<string, unknown> | undefined {
  if (!params || typeof params !== "object") {
    return undefined;
  }
  const record = params as Record<string, unknown>;
  return {
    threadId: record.threadId,
    cwd: record.cwd,
    limit: record.limit,
    sortKey: record.sortKey,
    sortDirection: record.sortDirection,
    archived: record.archived,
    searchTerm: record.searchTerm,
    includeTurns: record.includeTurns,
    path: record.path
  };
}

function summarizeResponse(response: unknown): Record<string, unknown> | undefined {
  if (!response || typeof response !== "object") {
    return undefined;
  }
  const record = response as Record<string, unknown>;
  const data = Array.isArray(record.data) ? record.data : undefined;
  const thread = record.thread && typeof record.thread === "object"
    ? record.thread as Record<string, unknown>
    : undefined;
  return {
    dataCount: data?.length,
    nextCursor: record.nextCursor,
    backwardsCursor: record.backwardsCursor,
    threadId: thread?.id,
    threadName: thread?.name,
    threadCwd: thread?.cwd,
    threadPath: thread?.path
  };
}

function summarizeThreadIndex(state: CodexThreadIndexState) {
  return {
    status: state.status,
    activeRequestCount: state.activeRequestIds.length,
    threadCount: state.threadOrder.length,
    projectCount: state.projectOrder.length,
    firstThreadId: state.threadOrder[0],
    firstProjectId: state.projectOrder[0],
    error: state.error
  };
}

function summarizeRuntimeState(state: CodexRuntimeState) {
  return {
    threadId: state.threadId,
    sessionPath: state.thread?.sessionPath,
    status: state.status,
    activeRequestCount: state.activeRequestIds.length,
    activeTurnId: state.activeTurnId,
    renderBlockCount: state.renderBlocks.length,
    turnCount: state.transcript?.turnOrder.length,
    error: state.error
  };
}

function sameSummary(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
