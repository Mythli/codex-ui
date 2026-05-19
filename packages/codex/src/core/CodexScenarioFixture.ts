import { CodexThreadIndexReducer, type CodexThreadIndexState } from "../entities/threadIndex/index.js";
import { CodexThreadReducer, type CodexThreadState } from "../entities/transcript/index.js";
import {
  CodexTrafficPacket,
  parseCodexProtocolRequestTraffic,
  parseCodexProtocolResponseTraffic,
  parseRolloutJsonlEntries,
  rolloutRecordsByTurn,
  type CodexProtocolEvent,
  type CodexProtocolResponse,
  type CodexProtocolTraffic,
  type CodexRequestMethod,
  type CodexRequestParams,
  type CodexRolloutEntry
} from "../protocol/stream/index.js";
import {
  executeCodexRequestPlan,
  type CodexRequestPlan,
  type CodexRequestPlanContext,
  type CodexRequestPlanIntent
} from "./CodexActionPlanner.js";
import type { CodexTransport } from "./transport/CodexTransport.js";

export type CodexScenarioActionKind = CodexRequestPlanIntent;

export type CodexScenarioProtocolCall = {
  [M in CodexRequestMethod]: {
    id: string;
    method: M;
    params: CodexRequestParams<M>;
    response?: CodexProtocolResponse<M>;
    events: CodexProtocolEvent[];
    traffic: CodexProtocolTraffic[];
    startedAtMs?: number;
    completedAtMs?: number;
  }
}[CodexRequestMethod];

export type CodexScenarioFixture = {
  metadata: {
    id: string;
    capturedAtMs: number;
    codexVersion: string;
    activeThreadId?: string;
  };
  actions: CodexScenarioAction[];
};

export type CodexScenarioAction = {
  id: string;
  intent: CodexScenarioActionKind;
  calls: CodexScenarioProtocolCall[];
  events: CodexProtocolEvent[];
  traffic: CodexProtocolTraffic[];
  sessionRecords: CodexRolloutEntry[];
  startedAtMs?: number;
  completedAtMs?: number;
  derived?: CodexScenarioActionDerived;
};

export type CodexScenarioActionDerived = {
  threadState?: CodexThreadState;
  threadStates: CodexThreadState[];
  sessionThreadState?: CodexThreadState;
  sessionThreadStates: CodexThreadState[];
  threadIndexState?: CodexThreadIndexState;
  threadIndexStates: CodexThreadIndexState[];
};

export type CodexScenarioReplayResult = {
  actions: Array<CodexScenarioAction & { derived: CodexScenarioActionDerived }>;
  threadStates: CodexThreadState[];
  sessionThreadStates: CodexThreadState[];
  threadIndexStates: CodexThreadIndexState[];
  finalThreadState?: CodexThreadState;
  finalSessionThreadState?: CodexThreadState;
  finalThreadIndexState: CodexThreadIndexState;
  activeThreadId?: string;
};

export type CodexScenarioCaptureResult = {
  fixture: CodexScenarioFixture;
  replay: CodexScenarioReplayResult;
  traffic: CodexProtocolTraffic[];
  activeThreadId: string;
};

export async function runCodexScenarioCapture(input: {
  transport: CodexTransport;
  id: string;
  codexVersion: string;
  steps: readonly CodexRequestPlan[];
}): Promise<CodexScenarioCaptureResult> {
  const traffic: CodexProtocolTraffic[] = [];
  const actions: CodexScenarioAction[] = [];
  const maybeReplay = input.transport as CodexTransport & {
    assertFullyConsumed?: () => void;
    close?: () => void;
    initialize?: () => Promise<void>;
  };
  let context: CodexRequestPlanContext = {};

  input.transport.onTraffic((nextTraffic) => {
    traffic.push(nextTraffic);
  });

  try {
    for (const step of input.steps) {
      const startIndex = traffic.length;
      const result = await executeCodexRequestPlan({
        plan: step,
        context,
        transport: input.transport
      });
      context = result.context;
      if (step.intent === "sendMessage") {
        await waitForTurnCompleted(input.transport, traffic, startIndex, context);
      }
      if (step.intent === "compactThread") {
        await waitForTurnCompleted(input.transport, traffic, startIndex, {
          ...context,
          activeTurnId: undefined
        });
      }
      actions.push(actionFromTraffic(step.intent, traffic.slice(startIndex)));
    }
    maybeReplay.assertFullyConsumed?.();

    if (!context.activeThreadId) {
      throw new Error("Scenario capture did not produce an active thread id");
    }

    const actionsWithSessionRecords = attachSessionRecordsToActions(actions);
    const fixture = {
      metadata: {
        id: input.id,
        capturedAtMs: Date.now(),
        codexVersion: input.codexVersion,
        activeThreadId: context.activeThreadId
      },
      actions: actionsWithSessionRecords
    } satisfies CodexScenarioFixture;
    return {
      fixture,
      replay: replayCodexScenarioFixture(fixture),
      traffic,
      activeThreadId: context.activeThreadId
    };
  } finally {
    maybeReplay.close?.();
  }
}

export function buildCodexScenarioFixture(input: {
  id: string;
  capturedAtMs?: number;
  codexVersion: string;
  activeThreadId?: string;
  traffic: readonly CodexProtocolTraffic[];
}): CodexScenarioFixture {
  const actions = attachSessionRecordsToActions(actionsFromTraffic(input.traffic));
  return {
    metadata: {
      id: input.id,
      capturedAtMs: input.capturedAtMs ?? Date.now(),
      codexVersion: input.codexVersion,
      activeThreadId: input.activeThreadId ?? activeThreadIdFromTraffic(input.traffic)
    },
    actions
  };
}

export function replayCodexScenarioFixture(
  fixture: CodexScenarioFixture
): CodexScenarioReplayResult {
  const threadIndexReducer = new CodexThreadIndexReducer();
  let threadIndexState: CodexThreadIndexState | undefined;
  let threadReducer: CodexThreadReducer | undefined;
  let threadState: CodexThreadState | undefined;
  let activeThreadId = fixture.metadata.activeThreadId;
  const threadStates: CodexThreadState[] = [];
  const sessionThreadStates: CodexThreadState[] = [];
  const threadIndexStates: CodexThreadIndexState[] = [];
  const actions = fixture.actions.map((action) => {
    const actionThreadStates: CodexThreadState[] = [];
    const actionSessionThreadStates: CodexThreadState[] = [];
    const actionThreadIndexStates: CodexThreadIndexState[] = [];

    for (const traffic of action.traffic) {
      threadIndexState = threadIndexReducer.reduce(threadIndexState, traffic);
      threadIndexStates.push(threadIndexState);
      actionThreadIndexStates.push(threadIndexState);

      const packet = CodexTrafficPacket.from(traffic);
      if (!activeThreadId && packet.threadId) {
        activeThreadId = packet.threadId;
      }
      if (!threadReducer && packet.threadId) {
        threadReducer = new CodexThreadReducer({ threadId: packet.threadId });
        threadState = threadReducer.initialState();
      }
      if (threadReducer) {
        threadState = threadReducer.reduce(threadState, traffic);
        threadStates.push(threadState);
        actionThreadStates.push(threadState);
      }
    }

    const sessionThreadId = activeThreadId ?? actionThreadId(action);
    const sessionThreadState = action.sessionRecords.length > 0 && sessionThreadId
      ? replayCodexSessionRecords({ threadId: sessionThreadId, records: action.sessionRecords })
      : undefined;
    if (sessionThreadState) {
      sessionThreadStates.push(sessionThreadState);
      actionSessionThreadStates.push(sessionThreadState);
    }

    return {
      ...action,
      derived: {
        threadState,
        threadStates: actionThreadStates,
        sessionThreadState,
        sessionThreadStates: actionSessionThreadStates,
        threadIndexState,
        threadIndexStates: actionThreadIndexStates
      }
    };
  });

  return {
    actions,
    threadStates,
    sessionThreadStates,
    threadIndexStates,
    finalThreadState: threadState,
    finalSessionThreadState: sessionThreadStates.at(-1),
    finalThreadIndexState: threadIndexState ?? threadIndexReducer.initialState(),
    activeThreadId
  };
}

export function replayCodexSessionRecords(input: {
  threadId: string;
  records: readonly CodexRolloutEntry[];
}): CodexThreadState {
  const reducer = new CodexThreadReducer({ threadId: input.threadId });
  const requestId = `session-records:${input.threadId}`;
  const sessionPath = `${input.threadId}.jsonl`;
  let state: CodexThreadState = {
    ...reducer.initialState(),
    sessionPath
  };
  state = reducer.reduce(state, parseCodexProtocolRequestTraffic("fs/readFile", {
    path: sessionPath
  }, { id: requestId }));
  state = reducer.reduce(state, parseCodexProtocolResponseTraffic("fs/readFile", {
    dataText: jsonlFromRecords(input.records)
  }, { id: requestId }));
  return state;
}

function actionsFromTraffic(traffic: readonly CodexProtocolTraffic[]): CodexScenarioAction[] {
  const actions: CodexScenarioAction[] = [];
  let currentTraffic: CodexProtocolTraffic[] = [];

  for (const entry of traffic) {
    if (entry.kind === "request") {
      if (currentTraffic.length > 0) {
        actions.push(actionFromTraffic(intentFromTraffic(currentTraffic), currentTraffic));
      }
      currentTraffic = [entry];
      continue;
    }
    if (currentTraffic.length > 0) {
      currentTraffic.push(entry);
    }
  }

  if (currentTraffic.length > 0) {
    actions.push(actionFromTraffic(intentFromTraffic(currentTraffic), currentTraffic));
  }

  return actions;
}

function actionFromTraffic(
  intent: CodexScenarioActionKind,
  traffic: readonly CodexProtocolTraffic[]
): CodexScenarioAction {
  const calls = callsFromTraffic(traffic);
  const firstCall = calls[0];
  return {
    id: firstCall?.id ?? `${intent}-${traffic.length}`,
    intent,
    calls,
    events: traffic.flatMap((entry) => entry.kind === "event" ? [entry.event] : []),
    traffic: [...traffic],
    sessionRecords: [],
    startedAtMs: firstCall?.startedAtMs,
    completedAtMs: calls.at(-1)?.completedAtMs ?? firstCall?.completedAtMs
  };
}

function callsFromTraffic(traffic: readonly CodexProtocolTraffic[]): CodexScenarioProtocolCall[] {
  const calls: CodexScenarioProtocolCall[] = [];
  let current: CodexScenarioProtocolCall | undefined;
  for (const entry of traffic) {
    if (entry.kind === "request") {
      if (current) {
        calls.push(current);
      }
      current = {
        id: entry.id,
        method: entry.method as CodexRequestMethod,
        params: entry.params as never,
        events: [],
        traffic: [entry],
        startedAtMs: entry.timestampMs
      } as CodexScenarioProtocolCall;
      continue;
    }
    if (!current) {
      continue;
    }
    current.traffic.push(entry);
    current.completedAtMs = entry.timestampMs ?? current.completedAtMs;
    if (entry.kind === "response") {
      current.response = entry.response as never;
    } else if (entry.kind === "event") {
      current.events.push(entry.event);
    }
  }
  if (current) {
    calls.push(current);
  }
  return calls;
}

function attachSessionRecordsToActions(actions: readonly CodexScenarioAction[]): CodexScenarioAction[] {
  const sessionRecords = sessionRecordsFromActions(actions);
  const recordsByTurn = rolloutRecordsByTurn(sessionRecords);
  return actions.map((action) => {
    const turnId = actionTurnId(action);
    if (action.intent === "openThread") {
      return { ...action, sessionRecords };
    }
    return {
      ...action,
      sessionRecords: turnId ? recordsByTurn.get(turnId) ?? [] : action.sessionRecords
    };
  });
}

function sessionRecordsFromActions(actions: readonly CodexScenarioAction[]): CodexRolloutEntry[] {
  return actions.flatMap((action) => action.calls.flatMap((call) => {
    if (call.method !== "fs/readFile" || !call.response) {
      return [];
    }
    const text = responseText(call.response as CodexProtocolResponse<"fs/readFile">);
    return text ? parseRolloutJsonlEntries(text) : [];
  }));
}

function actionThreadId(action: CodexScenarioAction): string | undefined {
  for (const traffic of action.traffic) {
    const packet = CodexTrafficPacket.from(traffic);
    if (packet.threadId) {
      return packet.threadId;
    }
  }
  return undefined;
}

function actionTurnId(action: CodexScenarioAction): string | undefined {
  for (const call of action.calls) {
    if (call.method === "turn/start" && call.response && "turn" in call.response) {
      const turn = (call.response as CodexProtocolResponse<"turn/start">).turn;
      if (typeof turn.id === "string") {
        return turn.id;
      }
    }
  }
  for (const event of action.events) {
    if ("params" in event && event.params && typeof event.params === "object" && "turnId" in event.params) {
      const turnId = event.params.turnId;
      if (typeof turnId === "string") {
        return turnId;
      }
    }
  }
  return undefined;
}

function responseText(response: CodexProtocolResponse<"fs/readFile">): string | undefined {
  if (typeof response.dataText === "string") {
    return response.dataText;
  }
  if (typeof response.dataBase64 !== "string") {
    return undefined;
  }
  return decodeBase64(response.dataBase64);
}

function decodeBase64(value: string): string | undefined {
  const bufferValue = (globalThis as typeof globalThis & { Buffer?: { from(value: string, encoding: "base64"): { toString(encoding: "utf8"): string } } }).Buffer;
  if (bufferValue) {
    return bufferValue.from(value, "base64").toString("utf8");
  }
  const atobValue = (globalThis as typeof globalThis & { atob?: (value: string) => string }).atob;
  if (!atobValue) {
    return undefined;
  }
  const binary = atobValue(value);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function jsonlFromRecords(records: readonly CodexRolloutEntry[]): string {
  return records.map((record) => JSON.stringify(record)).join("\n");
}

function intentFromTraffic(traffic: readonly CodexProtocolTraffic[]): CodexScenarioActionKind {
  const firstRequest = traffic.find((entry): entry is Extract<CodexProtocolTraffic, { kind: "request" }> =>
    entry.kind === "request"
  );
  if (!firstRequest) {
    return "protocolRequest";
  }
  switch (firstRequest.method) {
    case "initialize":
    case "initialized":
      return "initialize";
    case "thread/start":
      return "newThread";
    case "thread/resume":
      return "resumeThread";
    case "turn/start":
      return "sendMessage";
    case "thread/list":
      return "listThreads";
    case "thread/read":
      return "openThread";
    case "thread/archive":
      return "archiveThread";
    case "thread/compact/start":
      return "compactThread";
    case "turn/interrupt":
      return "stopTurn";
    default:
      return "protocolRequest";
  }
}

function activeThreadIdFromTraffic(traffic: readonly CodexProtocolTraffic[]): string | undefined {
  for (let index = traffic.length - 1; index >= 0; index -= 1) {
    const packet = CodexTrafficPacket.from(traffic[index]!);
    if (packet.threadId) {
      return packet.threadId;
    }
  }
  return undefined;
}

async function waitForTurnCompleted(
  transport: CodexTransport,
  traffic: readonly CodexProtocolTraffic[],
  startIndex: number,
  context: CodexRequestPlanContext
): Promise<void> {
  const completed = () => traffic.slice(startIndex).some((entry) => {
    if (entry.kind !== "event" || entry.event.method !== "turn/completed") {
      return false;
    }
    const params = entry.event.params;
    const turnId = params.turnId ?? params.turn?.id;
    return (!context.activeTurnId || turnId === context.activeTurnId) &&
      (!context.activeThreadId || !params.threadId || params.threadId === context.activeThreadId);
  });
  if (completed()) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Timed out waiting for turn/completed for ${context.activeTurnId ?? context.activeThreadId ?? "active turn"}`));
    }, 180_000);
    const unsubscribe = transport.onTraffic(() => {
      if (!completed()) {
        return;
      }
      clearTimeout(timeout);
      unsubscribe();
      resolve();
    });
    if (completed()) {
      clearTimeout(timeout);
      unsubscribe();
      resolve();
    }
  });
}
