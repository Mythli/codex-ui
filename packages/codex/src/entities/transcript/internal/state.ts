import { produce } from "immer";
import { createTranscriptItem } from "./itemProjectors.js";
import type {
  CodexTranscript,
  CodexTranscriptItem,
  CodexTranscriptItemSource,
  CodexTranscriptProtocolItem,
  CodexTranscriptState,
  CodexTranscriptTurn,
  CodexTranscriptTurnState,
  CodexTranscriptTurnStatus
} from "../model.js";

export function transcriptFromState(state: CodexTranscriptState | undefined): CodexTranscript | undefined {
  if (!state) {
    return undefined;
  }

  return {
    threadId: state.threadId,
    title: state.title,
    cwd: state.cwd,
    turns: state.turnOrder.flatMap((turnId) => {
      const turn = state.turnsById[turnId];
      return turn ? [selectTurn(turn)] : [];
    })
  };
}

export function createState(input: { threadId: string; title?: string; cwd?: string }): CodexTranscriptState {
  return {
    threadId: input.threadId,
    title: input.title,
    cwd: input.cwd,
    turnOrder: [],
    turnsById: {},
    appliedEventKeys: {}
  };
}

export function ensureState(
  state: CodexTranscriptState | undefined,
  threadId: string,
  meta: { title?: string; cwd?: string } = {}
): CodexTranscriptState {
  if (!state) {
    return createState({ threadId, ...meta });
  }
  return {
    ...state,
    threadId,
    title: meta.title ?? state.title,
    cwd: meta.cwd ?? state.cwd
  };
}

export function mergeHistoryState(
  current: CodexTranscriptState | undefined,
  history: CodexTranscriptState
): CodexTranscriptState {
  const base = ensureState(current, history.threadId, {
    title: history.title,
    cwd: history.cwd
  });

  return produce(base, (draft) => {
    draft.threadId = history.threadId;
    draft.title = history.title ?? draft.title;
    draft.cwd = history.cwd ?? draft.cwd;

    for (const turnId of history.turnOrder) {
      const turn = history.turnsById[turnId];
      if (turn) {
        putTurnInDraft(draft, turn);
      }
    }
  });
}

export function putTurn(state: CodexTranscriptState, incoming: CodexTranscriptTurnState): CodexTranscriptState {
  return produce(state, (draft) => {
    putTurnInDraft(draft, incoming);
  });
}

export function putItem(
  state: CodexTranscriptState,
  turnId: string,
  item: CodexTranscriptItem
): CodexTranscriptState {
  return produce(state, (draft) => {
    if (!draft.turnsById[turnId]) {
      draft.turnsById[turnId] = {
        id: turnId,
        status: "running",
        source: "live",
        itemOrder: [],
        itemsById: {}
      };
    }
    if (!draft.turnOrder.includes(turnId)) {
      draft.turnOrder.push(turnId);
    }
    upsertItemInDraft(draft.turnsById[turnId]!, item);
  });
}

export function updateItemProtocolItem(
  state: CodexTranscriptState,
  turnId: string,
  itemId: string,
  source: CodexTranscriptItemSource,
  update: (item: CodexTranscriptProtocolItem | undefined) => CodexTranscriptProtocolItem | undefined
): CodexTranscriptState {
  const turn = state.turnsById[turnId];
  const current = turn?.itemsById[itemId];
  const nextItem = update(current?.protocolItem);
  return nextItem ? putItem(state, turnId, createTranscriptItem(nextItem, source, {
    startedAtMs: current?.startedAtMs,
    completedAtMs: current?.completedAtMs
  })) : state;
}

export function updateTurnStatus(
  state: CodexTranscriptState | undefined,
  turnId: string | undefined,
  status: CodexTranscriptTurnStatus,
  completedAtMs?: number
): CodexTranscriptState | undefined {
  if (!state || !turnId || !state.turnsById[turnId]) {
    return state;
  }
  return produce(state, (draft) => {
    const turn = draft.turnsById[turnId]!;
    const startedAtMs = turn.startedAtMs;
    turn.status = status;
    turn.completedAtMs = completedAtMs ?? turn.completedAtMs;
    turn.durationMs = completedAtMs && startedAtMs ? Math.max(0, completedAtMs - startedAtMs) : turn.durationMs;
  });
}

export function markEventApplied(state: CodexTranscriptState, eventKey: string): CodexTranscriptState {
  return produce(state, (draft) => {
    draft.appliedEventKeys[eventKey] = true;
  });
}

export function isEventApplied(state: CodexTranscriptState | undefined, eventKey: string): boolean {
  return Boolean(state?.appliedEventKeys[eventKey]);
}

function selectTurn(turn: CodexTranscriptTurnState): CodexTranscriptTurn {
  return {
    id: turn.id,
    status: turn.status,
    source: turn.source,
    startedAtMs: turn.startedAtMs,
    completedAtMs: turn.completedAtMs,
    durationMs: turn.durationMs,
    filesChanged: turn.filesChanged,
    items: turn.itemOrder.flatMap((itemId) => turn.itemsById[itemId] ? [turn.itemsById[itemId]!] : [])
  };
}

function putTurnInDraft(state: CodexTranscriptState, incoming: CodexTranscriptTurnState): void {
  const existing = state.turnsById[incoming.id];
  state.turnsById[incoming.id] = existing ? mergeTurn(existing, incoming) : incoming;
  if (!state.turnOrder.includes(incoming.id)) {
    state.turnOrder.push(incoming.id);
  }
}

function mergeTurn(existing: CodexTranscriptTurnState, incoming: CodexTranscriptTurnState): CodexTranscriptTurnState {
  const itemsById = { ...existing.itemsById };
  const itemIdReplacements = new Map<string, string>();
  const claimedExistingItemIds = new Set<string>();

  for (const itemId of incoming.itemOrder) {
    const incomingItem = incoming.itemsById[itemId];
    if (!incomingItem) {
      continue;
    }
    const existingItemId = equivalentExistingItemId(existing, incomingItem, claimedExistingItemIds);
    const existingItem = existingItemId ? itemsById[existingItemId] : undefined;
    if (!existingItemId || !existingItem) {
      itemsById[itemId] = itemsById[itemId]
        ? mergeItem(itemsById[itemId]!, incomingItem, itemId)
        : incomingItem;
      continue;
    }

    claimedExistingItemIds.add(existingItemId);
    const mergedItem = mergeItem(existingItem, incomingItem, existingItemId);
    if (mergedItem.id !== existingItemId) {
      delete itemsById[existingItemId];
      itemIdReplacements.set(existingItemId, mergedItem.id);
    }
    if (mergedItem.id !== incomingItem.id) {
      itemIdReplacements.set(incomingItem.id, mergedItem.id);
    }
    itemsById[mergedItem.id] = mergedItem;
  }

  const itemOrder = unique([...existing.itemOrder, ...incoming.itemOrder]
    .map((itemId) => itemIdReplacements.get(itemId) ?? itemId)
    .filter((itemId) => Boolean(itemsById[itemId])));

  return {
    id: incoming.id,
    status: mergeTurnStatus(existing.status, incoming.status),
    source: existing.source === incoming.source ? existing.source : "merged",
    startedAtMs: incoming.startedAtMs ?? existing.startedAtMs,
    completedAtMs: incoming.completedAtMs ?? existing.completedAtMs,
    durationMs: incoming.durationMs ?? existing.durationMs,
    filesChanged: incoming.filesChanged ?? existing.filesChanged,
    itemOrder,
    itemsById
  };
}

function equivalentExistingItemId(
  turn: CodexTranscriptTurnState,
  incoming: CodexTranscriptItem,
  claimedItemIds: ReadonlySet<string>
): string | undefined {
  if (turn.itemsById[incoming.id]) {
    return incoming.id;
  }
  return turn.itemOrder.find((itemId) => {
    if (claimedItemIds.has(itemId)) {
      return false;
    }
    const existing = turn.itemsById[itemId];
    return existing ? areEquivalentItems(existing, incoming) : false;
  });
}

function areEquivalentItems(existing: CodexTranscriptItem, incoming: CodexTranscriptItem): boolean {
  if (existing.type !== incoming.type) {
    return false;
  }
  if (existing.type === "userMessage") {
    return normalizeText(existing.text) === normalizeText(incoming.text);
  }
  if (existing.type === "agentMessage") {
    return normalizeText(existing.text) === normalizeText(incoming.text) &&
      Boolean(existing.isFinal) === Boolean(incoming.isFinal);
  }
  if (existing.type === "commandExecution") {
    return normalizeText(existing.command) === normalizeText(incoming.command) &&
      normalizeText(existing.cwd) === normalizeText(incoming.cwd);
  }
  if (existing.type === "fileChange") {
    return itemFilePaths(existing).join("\n") === itemFilePaths(incoming).join("\n");
  }
  if (existing.type === "imageView" || existing.type === "imageGeneration") {
    return itemImagePaths(existing).join("\n") === itemImagePaths(incoming).join("\n");
  }
  return false;
}

function upsertItemInDraft(turn: CodexTranscriptTurnState, incoming: CodexTranscriptItem): void {
  const existing = turn.itemsById[incoming.id];
  turn.itemsById[incoming.id] = existing ? mergeItem(existing, incoming, incoming.id) : incoming;
  if (!turn.itemOrder.includes(incoming.id)) {
    turn.itemOrder.push(incoming.id);
  }
}

function mergeItem(existing: CodexTranscriptItem, incoming: CodexTranscriptItem, canonicalId: string): CodexTranscriptItem {
  const preferIncoming = shouldPreferIncomingItem(existing, incoming);
  const selected = preferIncoming ? incoming : existing;
  const item = createTranscriptItem(selected.protocolItem, selected.source, {
    startedAtMs: existing.startedAtMs ?? incoming.startedAtMs,
    completedAtMs: incoming.completedAtMs ?? existing.completedAtMs
  });
  return {
    ...item,
    id: canonicalId,
    renderKey: `item:${canonicalId}`
  };
}

function shouldPreferIncomingItem(existing: CodexTranscriptItem, incoming: CodexTranscriptItem): boolean {
  if (incoming.source === "threadRead" || incoming.source === "rollout") return true;
  if (existing.source === "threadRead" || existing.source === "rollout") return false;
  if (incoming.completedAtMs && !existing.completedAtMs) return true;
  if (isCompletedStatus(incoming.status) && !isCompletedStatus(existing.status)) return true;
  if (incoming.text && incoming.text.length >= (existing.text?.length ?? 0)) return true;
  if (incoming.output && incoming.output.length >= (existing.output?.length ?? 0)) return true;
  return !hasRenderableContent(existing) && hasRenderableContent(incoming);
}

function mergeTurnStatus(
  existing: CodexTranscriptTurnStatus,
  incoming: CodexTranscriptTurnStatus
): CodexTranscriptTurnStatus {
  if (existing === "completed" || incoming === "completed") return "completed";
  if (existing === "failed" || incoming === "failed") return "failed";
  return "running";
}

function isCompletedStatus(status: string | undefined): boolean {
  const normalized = status?.toLowerCase();
  return normalized === "completed" || normalized === "done";
}

function hasRenderableContent(item: CodexTranscriptItem): boolean {
  return Boolean(
    item.text ||
    item.output ||
    item.command ||
    item.toolName ||
    item.files?.length ||
    item.images?.length
  );
}

function normalizeText(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function itemFilePaths(item: CodexTranscriptItem): string[] {
  return (item.files ?? []).map((file) => file.path).sort();
}

function itemImagePaths(item: CodexTranscriptItem): string[] {
  return (item.images ?? []).map((image) => image.path ?? image.url ?? image.dataUrl ?? image.id).sort();
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
