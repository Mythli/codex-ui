import {
  createCodexAgentMessageItem,
  createCodexCommandExecutionItem,
  createCodexFileChangeItem,
  createCodexPlanItem,
  createCodexReasoningItem,
  type CodexProtocolEvent
} from "../../../../../../protocol/index.js";
import { filesFromUnifiedDiff, plural } from "./diff.js";
import { createTranscriptItem, secondsToMs, turnStateFromProtocolTurn } from "./itemProjectors.js";
import {
  ensureState,
  isEventApplied,
  markEventApplied,
  putItem,
  putTurn,
  updateItemProtocolItem
} from "./state.js";
import type {
  CodexTranscriptItemSource,
  CodexTranscriptState
} from "../model.js";

type EventStrategy<M extends CodexProtocolEvent["method"]> = (
  state: CodexTranscriptState,
  event: Extract<CodexProtocolEvent, { method: M }>,
  source: CodexTranscriptItemSource
) => CodexTranscriptState;

type AnyEventStrategy = (
  state: CodexTranscriptState,
  event: CodexProtocolEvent,
  source: CodexTranscriptItemSource
) => CodexTranscriptState;

const eventStrategies: Partial<Record<CodexProtocolEvent["method"], AnyEventStrategy>> = {
  "thread/started": forMethod("thread/started", applyThreadStarted),
  "turn/started": forMethod("turn/started", applyTurnStarted),
  "turn/completed": forMethod("turn/completed", applyTurnCompleted),
  "turn/diff/updated": forMethod("turn/diff/updated", applyTurnDiffUpdated),
  "item/started": forMethod("item/started", applyItemLifecycle),
  "item/completed": forMethod("item/completed", applyItemLifecycle),
  "item/agentMessage/delta": forMethod("item/agentMessage/delta", (state, event, source) => updateTextItem(state, event.params, source, "agentMessage")),
  "item/plan/delta": forMethod("item/plan/delta", (state, event, source) => updateTextItem(state, event.params, source, "plan")),
  "item/reasoning/summaryPartAdded": forMethod("item/reasoning/summaryPartAdded", (state, event, source) => updateReasoningPart(state, event.params, source)),
  "item/reasoning/summaryTextDelta": forMethod("item/reasoning/summaryTextDelta", (state, event, source) => updateReasoningDelta(state, event.params, source, event.method)),
  "item/reasoning/textDelta": forMethod("item/reasoning/textDelta", (state, event, source) => updateReasoningDelta(state, event.params, source, event.method)),
  "item/commandExecution/outputDelta": forMethod("item/commandExecution/outputDelta", (state, event, source) => updateCommandOutput(state, event.params, source)),
  "item/fileChange/patchUpdated": forMethod("item/fileChange/patchUpdated", (state, event, source) => updateFileChange(state, event.params, source))
};

export function applyEvent(
  state: CodexTranscriptState | undefined,
  event: CodexProtocolEvent,
  source: CodexTranscriptItemSource
): CodexTranscriptState | undefined {
  const eventKey = stableStringify(event);
  if (isEventApplied(state, eventKey)) {
    return state;
  }

  const threadId = eventThreadId(event) ?? state?.threadId;
  if (!threadId) {
    return state;
  }

  const nextState = markEventApplied(ensureState(state, threadId), eventKey);
  const strategy = eventStrategies[event.method];
  return strategy ? strategy(nextState, event, source) : nextState;
}

function applyTurnDiffUpdated(
  state: CodexTranscriptState,
  event: Extract<CodexProtocolEvent, { method: "turn/diff/updated" }>
): CodexTranscriptState {
  const turnId = event.params.turnId;
  const files = filesFromUnifiedDiff(event.params.diff).map((file) => ({
    path: file.path,
    action: "modified",
    additions: file.additions,
    deletions: file.deletions,
    diff: file.diff
  }));
  if (!turnId || files.length === 0) {
    return state;
  }
  const existing = state.turnsById[turnId];
  return putTurn(state, {
    id: turnId,
    status: existing?.status ?? "running",
    source: existing?.source ?? "live",
    startedAtMs: existing?.startedAtMs,
    completedAtMs: existing?.completedAtMs,
    durationMs: existing?.durationMs,
    filesChanged: {
      type: "fileChange",
      id: `${turnId}:files-changed`,
      title: `Edited ${plural(files.length, "file")}`,
      defaultExpanded: false,
      status: existing?.status === "completed" ? "completed" : "inProgress",
      additions: files.reduce((sum, file) => sum + file.additions, 0),
      deletions: files.reduce((sum, file) => sum + file.deletions, 0),
      files
    },
    itemOrder: [],
    itemsById: {}
  });
}

function forMethod<M extends CodexProtocolEvent["method"]>(
  method: M,
  strategy: EventStrategy<M>
): AnyEventStrategy {
  return (state, event, source) => event.method === method
    ? strategy(state, event as Extract<CodexProtocolEvent, { method: M }>, source)
    : state;
}

function applyThreadStarted(
  state: CodexTranscriptState,
  event: Extract<CodexProtocolEvent, { method: "thread/started" }>
): CodexTranscriptState {
  return {
    ...state,
    threadId: event.params.thread.id,
    cwd: event.params.thread.cwd ?? state.cwd
  };
}

function applyTurnStarted(
  state: CodexTranscriptState,
  event: Extract<CodexProtocolEvent, { method: "turn/started" }>
): CodexTranscriptState {
  const turnId = event.params.turn?.id ?? event.params.turnId;
  if (!turnId) {
    return state;
  }
  return {
    ...putTurn(state, {
      id: turnId,
      status: "running",
      source: "live",
      startedAtMs: secondsToMs(event.params.turn?.startedAt ?? undefined),
      itemOrder: [],
      itemsById: {}
    }),
    activeTurnId: turnId
  };
}

function applyTurnCompleted(
  state: CodexTranscriptState,
  event: Extract<CodexProtocolEvent, { method: "turn/completed" }>,
  source: CodexTranscriptItemSource
): CodexTranscriptState {
  const turnId = event.params.turn?.id ?? event.params.turnId;
  if (!turnId) {
    return state;
  }
  return {
    ...putTurn(state, turnStateFromProtocolTurn(event.params.turn, turnId, source, "completed")),
    activeTurnId: state.activeTurnId === turnId ? undefined : state.activeTurnId
  };
}

function applyItemLifecycle(
  state: CodexTranscriptState,
  event: Extract<CodexProtocolEvent, { method: "item/started" | "item/completed" }>,
  source: CodexTranscriptItemSource
): CodexTranscriptState {
  const turnId = event.params.turnId;
  if (!turnId) {
    return state;
  }
  const item = createTranscriptItem(event.params.item, source, {
    startedAtMs: event.method === "item/started" ? event.params.startedAtMs : undefined,
    completedAtMs: event.method === "item/completed" ? event.params.completedAtMs : undefined
  });
  return putItem(state, turnId, item.status ? item : {
    ...item,
    status: event.method === "item/completed" ? "completed" : "inProgress"
  });
}

function updateTextItem(
  state: CodexTranscriptState,
  params: Extract<CodexProtocolEvent, { method: "item/agentMessage/delta" | "item/plan/delta" }>["params"],
  source: CodexTranscriptItemSource,
  type: "agentMessage" | "plan"
): CodexTranscriptState {
  const turnId = params.turnId;
  const itemId = params.itemId;
  const delta = params.delta;
  if (!turnId || !itemId || !delta) {
    return state;
  }
  return updateItemProtocolItem(state, turnId, itemId, source, (item) => {
    if (type === "agentMessage") {
      const existing = item?.type === "agentMessage" ? item : undefined;
      return createCodexAgentMessageItem({
        id: existing?.id ?? itemId,
        text: `${existing?.text ?? ""}${delta}`,
        phase: existing?.phase ?? null,
        memoryCitation: existing?.memoryCitation ?? null
      });
    }
    if (item?.type === "plan") {
      return createCodexPlanItem({ id: item.id, text: `${item.text}${delta}` });
    }
    return createCodexPlanItem({ id: itemId, text: delta });
  });
}

function updateReasoningPart(
  state: CodexTranscriptState,
  params: Extract<CodexProtocolEvent, { method: "item/reasoning/summaryPartAdded" }>["params"],
  source: CodexTranscriptItemSource
): CodexTranscriptState {
  const turnId = params.turnId;
  const itemId = params.itemId;
  const summaryIndex = params.summaryIndex;
  if (!turnId || !itemId || typeof summaryIndex !== "number") {
    return state;
  }
  return updateItemProtocolItem(state, turnId, itemId, source, (item) => {
    const reasoning = item?.type === "reasoning" ? item : createCodexReasoningItem({ id: itemId });
    const summary = reasoning.type === "reasoning" ? [...reasoning.summary] : [];
    summary[summaryIndex] = summary[summaryIndex] ?? "";
    return createCodexReasoningItem({ id: itemId, summary, content: reasoning.type === "reasoning" ? reasoning.content : [] });
  });
}

function updateReasoningDelta(
  state: CodexTranscriptState,
  params: Extract<CodexProtocolEvent, { method: "item/reasoning/summaryTextDelta" | "item/reasoning/textDelta" }>["params"],
  source: CodexTranscriptItemSource,
  method: string
): CodexTranscriptState {
  const turnId = params.turnId;
  const itemId = params.itemId;
  const delta = params.delta;
  const index = method === "item/reasoning/summaryTextDelta"
    ? "summaryIndex" in params ? params.summaryIndex : undefined
    : "contentIndex" in params ? params.contentIndex : undefined;
  if (!turnId || !itemId || !delta || typeof index !== "number") {
    return state;
  }
  return updateItemProtocolItem(state, turnId, itemId, source, (item) => {
    const reasoning = item?.type === "reasoning" ? item : createCodexReasoningItem({ id: itemId });
    const field = method === "item/reasoning/summaryTextDelta" ? "summary" : "content";
    const values = reasoning.type === "reasoning" ? [...reasoning[field]] : [];
    values[index] = `${values[index] ?? ""}${delta}`;
    return createCodexReasoningItem({
      id: itemId,
      summary: field === "summary" ? values : reasoning.type === "reasoning" ? reasoning.summary : [],
      content: field === "content" ? values : reasoning.type === "reasoning" ? reasoning.content : []
    });
  });
}

function updateCommandOutput(
  state: CodexTranscriptState,
  params: Extract<CodexProtocolEvent, { method: "item/commandExecution/outputDelta" }>["params"],
  source: CodexTranscriptItemSource
): CodexTranscriptState {
  const turnId = params.turnId;
  const itemId = params.itemId;
  const delta = params.delta;
  if (!turnId || !itemId || !delta) {
    return state;
  }
  return updateItemProtocolItem(state, turnId, itemId, source, (item) => {
    const command = item?.type === "commandExecution" ? item : createCodexCommandExecutionItem({ id: itemId });
    return createCodexCommandExecutionItem({
      id: itemId,
      command: command.type === "commandExecution" ? command.command : undefined,
      cwd: command.type === "commandExecution" ? command.cwd : undefined,
      processId: command.type === "commandExecution" ? command.processId ?? null : null,
      source: command.type === "commandExecution" ? command.source : undefined,
      status: command.type === "commandExecution" ? command.status : undefined,
      commandActions: command.type === "commandExecution" ? command.commandActions : [],
      aggregatedOutput: `${command.type === "commandExecution" ? command.aggregatedOutput ?? "" : ""}${delta}`,
      exitCode: command.type === "commandExecution" ? command.exitCode ?? null : null,
      durationMs: command.type === "commandExecution" ? command.durationMs ?? null : null
    });
  });
}

function updateFileChange(
  state: CodexTranscriptState,
  params: Extract<CodexProtocolEvent, { method: "item/fileChange/patchUpdated" }>["params"],
  source: CodexTranscriptItemSource
): CodexTranscriptState {
  const turnId = params.turnId;
  const itemId = params.itemId;
  if (!turnId || !itemId) {
    return state;
  }
  return updateItemProtocolItem(state, turnId, itemId, source, (item) => {
    const fileChange = item?.type === "fileChange"
      ? item
      : createCodexFileChangeItem({ id: itemId, status: "inProgress" });
    return createCodexFileChangeItem({
      id: itemId,
      changes: params.changes,
      status: fileChange.type === "fileChange" ? fileChange.status ?? "inProgress" : "inProgress"
    });
  });
}

function eventThreadId(event: CodexProtocolEvent): string | undefined {
  switch (event.method) {
    case "thread/started":
      return event.params.thread.id;
    case "turn/started":
    case "turn/completed":
    case "turn/diff/updated":
      return event.params.threadId;
    case "item/started":
    case "item/completed":
    case "item/agentMessage/delta":
    case "item/plan/delta":
    case "item/reasoning/summaryPartAdded":
    case "item/reasoning/summaryTextDelta":
    case "item/reasoning/textDelta":
    case "item/commandExecution/outputDelta":
    case "item/fileChange/patchUpdated":
      return event.params.threadId;
    default:
      return undefined;
  }
}

function stableStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
