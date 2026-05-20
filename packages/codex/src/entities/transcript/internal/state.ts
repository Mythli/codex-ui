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

export function rekeyTurn(
  state: CodexTranscriptState,
  fromTurnId: string,
  toTurnId: string
): CodexTranscriptState {
  if (fromTurnId === toTurnId || !state.turnsById[fromTurnId]) {
    return state;
  }

  return produce(state, (draft) => {
    const source = draft.turnsById[fromTurnId];
    if (!source) {
      return;
    }

    const target = draft.turnsById[toTurnId];
    const movedSource = { ...source, id: toTurnId };
    draft.turnsById[toTurnId] = target ? mergeTurn(movedSource, target) : movedSource;
    delete draft.turnsById[fromTurnId];
    draft.turnOrder = unique(draft.turnOrder.map((turnId) => turnId === fromTurnId ? toTurnId : turnId))
      .filter((turnId) => Boolean(draft.turnsById[turnId]));
    if (draft.activeTurnId === fromTurnId) {
      draft.activeTurnId = toTurnId;
    }
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
    if (status === "completed" && turn.filesChanged && isActiveStatus(turn.filesChanged.status)) {
      turn.filesChanged.status = "completed";
    }
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
  let existing = state.turnsById[incoming.id];
  if (!existing && !incoming.id.startsWith("pending-turn:")) {
    const equivalentTurnId = pendingTurnIdForIncoming(state, incoming) ?? liveTurnIdForIncomingHistory(state, incoming);
    if (equivalentTurnId) {
      existing = state.turnsById[equivalentTurnId];
      delete state.turnsById[equivalentTurnId];
      state.turnOrder = state.turnOrder.map((turnId) => turnId === equivalentTurnId ? incoming.id : turnId);
      if (state.activeTurnId === equivalentTurnId) {
        state.activeTurnId = incoming.id;
      }
    }
  }
  state.turnsById[incoming.id] = existing ? mergeTurn(existing, incoming) : incoming;
  if (!state.turnOrder.includes(incoming.id)) {
    state.turnOrder.push(incoming.id);
  }
}

function pendingTurnIdForIncoming(
  state: CodexTranscriptState,
  incoming: CodexTranscriptTurnState
): string | undefined {
  if (incoming.itemOrder.length > 0 || incoming.source !== "live" || incoming.status !== "running") {
    return undefined;
  }
  const activeTurnId = state.activeTurnId;
  if (activeTurnId?.startsWith("pending-turn:") && state.turnsById[activeTurnId]) {
    return activeTurnId;
  }
  const pendingTurnIds = state.turnOrder.filter((turnId) => turnId.startsWith("pending-turn:") && state.turnsById[turnId]);
  return pendingTurnIds.length === 1 ? pendingTurnIds[0] : undefined;
}

function liveTurnIdForIncomingHistory(
  state: CodexTranscriptState,
  incoming: CodexTranscriptTurnState
): string | undefined {
  if (incoming.source !== "history" || incoming.status !== "completed" || incoming.itemOrder.length === 0) {
    return undefined;
  }
  return state.turnOrder.find((turnId) => {
    const existing = state.turnsById[turnId];
    return existing &&
      existing.source !== "history" &&
      existing.status !== "completed" &&
      turnsHaveEquivalentUserMessage(existing, incoming);
  });
}

function turnsHaveEquivalentUserMessage(
  existing: CodexTranscriptTurnState,
  incoming: CodexTranscriptTurnState
): boolean {
  const incomingUsers = incoming.itemOrder
    .map((itemId) => incoming.itemsById[itemId])
    .filter((item): item is CodexTranscriptItem => item?.type === "userMessage");
  if (incomingUsers.length === 0) {
    return false;
  }
  return existing.itemOrder.some((itemId) => {
    const existingItem = existing.itemsById[itemId];
    return existingItem?.type === "userMessage" &&
      incomingUsers.some((incomingItem) => areEquivalentItems(existingItem, incomingItem));
  });
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
    startedAtMs: earliestMs(existing.startedAtMs, incoming.startedAtMs),
    completedAtMs: incoming.completedAtMs ?? existing.completedAtMs,
    durationMs: incoming.durationMs ?? existing.durationMs,
    filesChanged: mergeFilesChanged(existing.filesChanged, incoming.filesChanged, incoming.status),
    itemOrder,
    itemsById
  };
}

function mergeFilesChanged(
  existing: CodexTranscriptTurnState["filesChanged"],
  incoming: CodexTranscriptTurnState["filesChanged"],
  incomingStatus: CodexTranscriptTurnState["status"]
): CodexTranscriptTurnState["filesChanged"] {
  const filesChanged = richerFilesChanged(existing, incoming);
  if (!filesChanged) {
    return undefined;
  }
  if (incomingStatus === "completed" && isActiveStatus(filesChanged.status)) {
    return {
      ...filesChanged,
      status: "completed"
    };
  }
  return filesChanged;
}

function richerFilesChanged(
  existing: CodexTranscriptTurnState["filesChanged"],
  incoming: CodexTranscriptTurnState["filesChanged"]
): CodexTranscriptTurnState["filesChanged"] {
  if (!existing) return incoming;
  if (!incoming) return existing;
  return fileChangeEntryRichness(incoming) >= fileChangeEntryRichness(existing) ? incoming : existing;
}

function fileChangeEntryRichness(entry: NonNullable<CodexTranscriptTurnState["filesChanged"]>): number {
  return entry.files.reduce((sum, file) => (
    sum +
    (file.additions ?? 0) +
    (file.deletions ?? 0) +
    (file.diff?.length ?? 0) +
    (file.content?.length ?? 0)
  ), 0);
}

function isActiveStatus(status: string | undefined): boolean {
  return status === "inProgress" || status === "running";
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
    return normalizeText(existing.text) === normalizeText(incoming.text) &&
      itemImagePaths(existing).join("\n") === itemImagePaths(incoming).join("\n");
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
  const existingItemId = equivalentExistingItemId(turn, incoming, new Set());
  const existing = existingItemId ? turn.itemsById[existingItemId] : undefined;
  const item = existing ? mergeItem(existing, incoming, incoming.id) : incoming;
  if (existingItemId && existingItemId !== item.id) {
    delete turn.itemsById[existingItemId];
    turn.itemOrder = turn.itemOrder.map((itemId) => itemId === existingItemId ? item.id : itemId);
  }
  turn.itemsById[item.id] = item;
  if (!turn.itemOrder.includes(item.id)) {
    turn.itemOrder.push(item.id);
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
  if (existing.type === "fileChange" && incoming.type === "fileChange" && fileChangeRichness(incoming) > fileChangeRichness(existing)) return true;
  if (incoming.completedAtMs && !existing.completedAtMs) return true;
  if (isCompletedStatus(incoming.status) && !isCompletedStatus(existing.status)) return true;
  if (incoming.text && incoming.text.length >= (existing.text?.length ?? 0)) return true;
  if (incoming.output && incoming.output.length >= (existing.output?.length ?? 0)) return true;
  return !hasRenderableContent(existing) && hasRenderableContent(incoming);
}

function fileChangeRichness(item: CodexTranscriptItem): number {
  return (item.files ?? []).reduce((sum, file) => (
    sum +
    (file.additions ?? 0) +
    (file.deletions ?? 0) +
    (file.diff?.length ?? 0) +
    (file.content?.length ?? 0)
  ), 0);
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

function earliestMs(left: number | undefined, right: number | undefined): number | undefined {
  if (left === undefined) return right;
  if (right === undefined) return left;
  return Math.min(left, right);
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
