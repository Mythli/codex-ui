import {
  CodexTrafficPacket,
  parseRolloutJsonlTokenUsage,
  parseRolloutJsonlThreadTurns,
  type CodexProtocolResponse,
  type CodexProtocolTraffic,
  type CodexRequestMethod,
  type CodexRequestParams
} from "../../protocol/stream/index.js";
import { applyEvent } from "./internal/eventStrategies.js";
import { stateFromThread } from "./internal/hydrationStrategies.js";
import { turnStateFromProtocolTurn } from "./internal/itemProjectors.js";
import { buildCodexRenderBlocks } from "./internal/renderBlocks.js";
import { mergeHistoryState, putTurn } from "./internal/state.js";
import type {
  CodexModelReroute,
  CodexRenderBlock,
  CodexRuntimeSessionSettings,
  CodexThreadTokenUsage,
  CodexTranscriptState
} from "./model.js";

export type CodexThreadStatus = "loading" | "ready" | "running" | "failed";

export type CodexThreadState = {
  threadId: string;
  title?: string;
  cwd?: string;
  sessionPath?: string;
  status: CodexThreadStatus;
  activeRequestIds: string[];
  fileReadRequestsById?: Record<string, { path: string }>;
  activeTurnId?: string;
  error?: string;
  session?: CodexRuntimeSessionSettings;
  tokenUsage?: CodexThreadTokenUsage;
  modelReroute?: CodexModelReroute;
  modelVerification?: unknown[];
  transcript?: CodexTranscriptState;
  renderBlocks: CodexRenderBlock[];
};

export type CodexThreadReducerOptions = {
  threadId: string;
  sessionPath?: string;
};

type ThreadTrafficStrategy<K extends CodexProtocolTraffic["kind"]> = (
  state: CodexThreadState,
  traffic: Extract<CodexProtocolTraffic, { kind: K }>
) => CodexThreadState;

type AnyThreadTrafficStrategy = (
  state: CodexThreadState,
  traffic: CodexProtocolTraffic
) => CodexThreadState;

type RequestTraffic<M extends CodexRequestMethod> =
  Extract<CodexProtocolTraffic, { kind: "request" }> & {
    method: M;
    params: CodexRequestParams<M>;
  };

type ResponseTraffic<M extends CodexRequestMethod> =
  Extract<CodexProtocolTraffic, { kind: "response" }> & {
    method: M;
    response: CodexProtocolResponse<M>;
  };

type AnyRequestTrafficStrategy = (
  state: CodexThreadState,
  traffic: Extract<CodexProtocolTraffic, { kind: "request" }>
) => CodexThreadState;

type AnyResponseTrafficStrategy = (
  state: CodexThreadState,
  traffic: Extract<CodexProtocolTraffic, { kind: "response" }>
) => CodexThreadState;

const trafficStrategies: Partial<Record<CodexProtocolTraffic["kind"], AnyThreadTrafficStrategy>> = {
  request: forKind("request", applyRequestTraffic),
  response: forKind("response", applyResponseTraffic),
  responseError: forKind("responseError", applyResponseErrorTraffic),
  event: forKind("event", applyEventTraffic),
  diagnostic: forKind("diagnostic", (state) => state),
  serverRequest: forKind("serverRequest", (state) => state)
};

const requestStrategies: Record<string, AnyRequestTrafficStrategy> = {
  "fs/readFile": forRequestMethod("fs/readFile", applyFsReadFileRequest),
  "thread/read": forRequestMethod("thread/read", applyThreadReadRequest),
  "thread/resume": forRequestMethod("thread/resume", applyThreadResumeRequest),
  "turn/start": forRequestMethod("turn/start", applyTurnStartRequest)
};

const responseStrategies: Record<string, AnyResponseTrafficStrategy> = {
  "fs/readFile": forResponseMethod("fs/readFile", applyFsReadFileResponse),
  "thread/read": forResponseMethod("thread/read", applyThreadReadResponse),
  "thread/start": forResponseMethod("thread/start", applyThreadStartResponse),
  "thread/resume": forResponseMethod("thread/resume", applyThreadResumeResponse),
  "turn/start": forResponseMethod("turn/start", applyTurnStartResponse)
};

export class CodexThreadReducer {
  readonly threadId: string;
  private readonly options: CodexThreadReducerOptions;

  constructor(options: CodexThreadReducerOptions) {
    this.options = options;
    this.threadId = options.threadId;
  }

  initialState(): CodexThreadState {
    return finalizeState({
      threadId: this.threadId,
      sessionPath: this.options.sessionPath,
      status: "loading",
      activeRequestIds: [],
      renderBlocks: []
    });
  }

  reduce(
    previous: CodexThreadState | undefined,
    traffic: CodexProtocolTraffic
  ): CodexThreadState {
    const state = previous ?? this.initialState();
    const packet = CodexTrafficPacket.from(traffic);
    if (!this.acceptsPacket(state, traffic, packet)) {
      return state;
    }
    const strategy = trafficStrategies[traffic.kind];
    return finalizeState(strategy ? strategy(state, traffic) : state);
  }

  private acceptsPacket(state: CodexThreadState, traffic: CodexProtocolTraffic, packet: CodexTrafficPacket): boolean {
    if (packet.threadId) {
      return packet.threadId === this.threadId;
    }
    if (packet.kind === "diagnostic" || packet.kind === "serverRequest") {
      return true;
    }
    if (packet.requestId && state.activeRequestIds.includes(packet.requestId)) {
      return true;
    }
    if (packet.kind === "request" && packet.method === "fs/readFile") {
      const accepted = traffic.kind === "request" &&
        traffic.method === "fs/readFile" &&
        Boolean(state.sessionPath) &&
        traffic.params.path === state.sessionPath;
      if (!accepted && traffic.kind === "request" && traffic.method === "fs/readFile") {
        console.error(`[codex thread reduce] request:fs/readFile ${traffic.params.path}`, {
          activeThreadId: this.threadId,
          activeThreadShortId: this.threadId.slice(0, 8),
          expectedSessionPath: state.sessionPath,
          requestId: traffic.id,
          requestPath: traffic.params.path
        });
      }
      return accepted;
    }
    if (packet.turnId && packet.turnId === state.activeTurnId) {
      return true;
    }
    return false;
  }
}

function forKind<K extends CodexProtocolTraffic["kind"]>(
  kind: K,
  strategy: ThreadTrafficStrategy<K>
): AnyThreadTrafficStrategy {
  return (state, traffic) => traffic.kind === kind
    ? strategy(state, traffic as Extract<CodexProtocolTraffic, { kind: K }>)
    : state;
}

function forRequestMethod<M extends CodexRequestMethod>(
  method: M,
  strategy: (state: CodexThreadState, traffic: RequestTraffic<M>) => CodexThreadState
): AnyRequestTrafficStrategy {
  return (state, traffic) => traffic.method === method
    ? strategy(state, traffic as RequestTraffic<M>)
    : state;
}

function forResponseMethod<M extends CodexRequestMethod>(
  method: M,
  strategy: (state: CodexThreadState, traffic: ResponseTraffic<M>) => CodexThreadState
): AnyResponseTrafficStrategy {
  return (state, traffic) => traffic.method === method
    ? strategy(state, traffic as ResponseTraffic<M>)
    : state;
}

function applyRequestTraffic(
  state: CodexThreadState,
  traffic: Extract<CodexProtocolTraffic, { kind: "request" }>
): CodexThreadState {
  const next = rememberRequest(state, traffic.id);
  return requestStrategies[traffic.method]?.(next, traffic) ?? next;
}

function applyThreadReadRequest(
  state: CodexThreadState,
  traffic: RequestTraffic<"thread/read">
): CodexThreadState {
  return {
    ...state,
    threadId: traffic.params.threadId,
    status: "loading",
    error: undefined
  };
}

function applyThreadResumeRequest(
  state: CodexThreadState,
  traffic: RequestTraffic<"thread/resume">
): CodexThreadState {
  return {
    ...state,
    threadId: traffic.params.threadId,
    cwd: typeof traffic.params.cwd === "string" ? traffic.params.cwd : state.cwd,
    session: mergeSession(state.session, {
      model: traffic.params.model,
      modelProvider: traffic.params.modelProvider,
      serviceTier: traffic.params.serviceTier
    }),
    status: "loading",
    error: undefined
  };
}

function applyTurnStartRequest(
  state: CodexThreadState,
  traffic: RequestTraffic<"turn/start">
): CodexThreadState {
  return {
    ...state,
    threadId: traffic.params.threadId,
    cwd: typeof traffic.params.cwd === "string" ? traffic.params.cwd : state.cwd,
    session: mergeSession(state.session, {
      model: traffic.params.model,
      reasoningEffort: traffic.params.effort
    }),
    status: "running",
    error: undefined
  };
}

function applyFsReadFileRequest(
  state: CodexThreadState,
  traffic: RequestTraffic<"fs/readFile">
): CodexThreadState {
  return {
    ...state,
    fileReadRequestsById: {
      ...state.fileReadRequestsById,
      [traffic.id]: { path: traffic.params.path }
    }
  };
}

function applyResponseTraffic(
  state: CodexThreadState,
  traffic: Extract<CodexProtocolTraffic, { kind: "response" }>
): CodexThreadState {
  const next = forgetRequest(state, traffic.id);
  return responseStrategies[traffic.method]?.(next, traffic) ?? next;
}

function applyThreadReadResponse(
  state: CodexThreadState,
  traffic: ResponseTraffic<"thread/read">
): CodexThreadState {
  return withTranscript({
    ...state,
    sessionPath: traffic.response.thread.path ?? state.sessionPath
  }, mergeHistoryState(state.transcript, stateFromThread(traffic.response.thread)), "ready");
}

function applyThreadStartResponse(
  state: CodexThreadState,
  traffic: ResponseTraffic<"thread/start">
): CodexThreadState {
  return withTranscript({
    ...state,
    session: sessionFromResponse(state.session, traffic.response),
    sessionPath: traffic.response.thread.path ?? state.sessionPath
  }, mergeHistoryState(state.transcript, stateFromThread(traffic.response.thread)), "ready");
}

function applyThreadResumeResponse(
  state: CodexThreadState,
  traffic: ResponseTraffic<"thread/resume">
): CodexThreadState {
  const status = state.status === "running" ? "running" : "ready";
  return withTranscript({
    ...state,
    session: sessionFromResponse(state.session, traffic.response),
    sessionPath: traffic.response.thread.path ?? state.sessionPath
  }, mergeHistoryState(state.transcript, stateFromThread(traffic.response.thread)), status);
}

function applyTurnStartResponse(
  state: CodexThreadState,
  traffic: ResponseTraffic<"turn/start">
): CodexThreadState {
  const turn = traffic.response.turn;
  const base = state.transcript ?? {
    threadId: state.threadId,
    turnOrder: [],
    turnsById: {},
    appliedEventKeys: {}
  };
  const transcript = {
    ...putTurn(base, turnStateFromProtocolTurn(turn, turn.id, "live", "running")),
    activeTurnId: turn.id
  };
  return withTranscript(state, transcript, "running");
}

function applyFsReadFileResponse(
  state: CodexThreadState,
  traffic: ResponseTraffic<"fs/readFile">
): CodexThreadState {
  const request = state.fileReadRequestsById?.[traffic.id];
  const nextRequests = forgetFileReadRequest(state.fileReadRequestsById, traffic.id);
  if (!request || !request.path.endsWith(".jsonl")) {
    return { ...state, fileReadRequestsById: nextRequests };
  }

  const jsonl = responseText(traffic.response);
  if (!jsonl) {
    return { ...state, fileReadRequestsById: nextRequests };
  }

  const turnsById = parseRolloutJsonlThreadTurns(jsonl);
  if (turnsById.size === 0) {
    return { ...state, fileReadRequestsById: nextRequests };
  }

  const base = state.transcript ?? {
    threadId: state.threadId,
    turnOrder: [],
    turnsById: {},
    appliedEventKeys: {}
  };
  let transcript = base;
  for (const [turnId, turn] of turnsById) {
    transcript = putTurn(transcript, turnStateFromProtocolTurn(turn, turnId, "rollout", "completed"));
  }

  return withTranscript({
    ...state,
    fileReadRequestsById: nextRequests,
    tokenUsage: parseRolloutJsonlTokenUsage(jsonl) ?? state.tokenUsage
  }, transcript, "ready");
}

function applyResponseErrorTraffic(
  state: CodexThreadState,
  traffic: Extract<CodexProtocolTraffic, { kind: "responseError" }>
): CodexThreadState {
  return {
    ...forgetRequest(state, traffic.id),
    status: "failed",
    error: errorMessage(traffic.error)
  };
}

function applyEventTraffic(
  state: CodexThreadState,
  traffic: Extract<CodexProtocolTraffic, { kind: "event" }>
): CodexThreadState {
  const metadataState = applyMetadataEvent(state, traffic.event);
  const transcript = applyEvent(state.transcript, traffic.event, "live") ?? state.transcript;
  const nextStatus = eventStatus(traffic.event.method, state.status);
  return withTranscript(metadataState, transcript, nextStatus);
}

function withTranscript(
  state: CodexThreadState,
  transcript: CodexTranscriptState | undefined,
  status: CodexThreadStatus
): CodexThreadState {
  return {
    ...state,
    threadId: transcript?.threadId ?? state.threadId,
    title: transcript?.title ?? state.title,
    cwd: transcript?.cwd ?? state.cwd,
    activeTurnId: transcript ? transcript.activeTurnId : state.activeTurnId,
    transcript,
    status,
    error: status === "failed" ? state.error : undefined
  };
}

function sessionFromResponse(
  existing: CodexRuntimeSessionSettings | undefined,
  response: CodexProtocolResponse<"thread/start"> | CodexProtocolResponse<"thread/resume">
): CodexRuntimeSessionSettings | undefined {
  return mergeSession(existing, {
    model: response.model,
    modelProvider: response.modelProvider,
    serviceTier: response.serviceTier,
    reasoningEffort: response.reasoningEffort
  });
}

function mergeSession(
  existing: CodexRuntimeSessionSettings | undefined,
  next: CodexRuntimeSessionSettings
): CodexRuntimeSessionSettings | undefined {
  const merged = { ...existing };
  let changed = false;
  for (const key of ["model", "modelProvider", "serviceTier", "reasoningEffort"] as const) {
    if (key in next && next[key] !== undefined) {
      merged[key] = next[key];
      changed = true;
    }
  }
  return changed || existing ? merged : undefined;
}

function applyMetadataEvent(
  state: CodexThreadState,
  event: Extract<CodexProtocolTraffic, { kind: "event" }>["event"]
): CodexThreadState {
  if (event.method === "thread/tokenUsage/updated") {
    return {
      ...state,
      tokenUsage: event.params.tokenUsage
    };
  }
  if (event.method === "thread/compacted") {
    return {
      ...state,
      tokenUsage: undefined
    };
  }
  if (event.method === "model/rerouted") {
    return {
      ...state,
      session: mergeSession(state.session, { model: event.params.toModel }),
      modelReroute: {
        fromModel: event.params.fromModel,
        toModel: event.params.toModel,
        reason: event.params.reason
      }
    };
  }
  if (event.method === "model/verification") {
    return {
      ...state,
      modelVerification: event.params.verifications
    };
  }
  return state;
}

function rememberRequest(state: CodexThreadState, requestId: string): CodexThreadState {
  return state.activeRequestIds.includes(requestId)
    ? state
    : { ...state, activeRequestIds: [...state.activeRequestIds, requestId] };
}

function forgetRequest(state: CodexThreadState, requestId: string): CodexThreadState {
  return {
    ...state,
    activeRequestIds: state.activeRequestIds.filter((id) => id !== requestId)
  };
}

function forgetFileReadRequest(
  requests: CodexThreadState["fileReadRequestsById"],
  requestId: string
): CodexThreadState["fileReadRequestsById"] {
  if (!requests?.[requestId]) {
    return requests;
  }
  const { [requestId]: _removed, ...remaining } = requests;
  return Object.keys(remaining).length > 0 ? remaining : undefined;
}

function responseText(response: CodexProtocolResponse<"fs/readFile">): string | undefined {
  if (typeof response.dataText === "string") {
    return response.dataText;
  }
  if (typeof response.dataBase64 !== "string") {
    return undefined;
  }
  const bufferValue = (globalThis as typeof globalThis & { Buffer?: { from(value: string, encoding: "base64"): { toString(encoding: "utf8"): string } } }).Buffer;
  if (bufferValue) {
    return bufferValue.from(response.dataBase64, "base64").toString("utf8");
  }
  const atobValue = (globalThis as typeof globalThis & { atob?: (value: string) => string }).atob;
  if (!atobValue) {
    return undefined;
  }
  const binary = atobValue(response.dataBase64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function finalizeState(state: CodexThreadState): CodexThreadState {
  return {
    ...state,
    renderBlocks: buildCodexRenderBlocks(state.transcript)
  };
}

function eventStatus(method: string, current: CodexThreadStatus): CodexThreadStatus {
  if (method === "turn/started" || method === "item/started" || method.endsWith("/delta") || method === "item/fileChange/patchUpdated") {
    return "running";
  }
  if (method === "turn/completed") {
    return "ready";
  }
  return current;
}

function errorMessage(error: Extract<CodexProtocolTraffic, { kind: "responseError" }>["error"]): string {
  return typeof error.message === "string" ? error.message : JSON.stringify(error);
}
