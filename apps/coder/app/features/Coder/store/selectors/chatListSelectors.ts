import { createSelector } from "@reduxjs/toolkit";
import type { CodexThreadIndexState, CodexThreadState } from "@taylordb/codex";
import { groupChatsByProject } from "./threadGrouping";
import type { RootState } from "../index";

export const selectUnreadThreadIds = (state: RootState) => state.chatListMeta.unreadThreadIds;
export const selectRunningThreadIds = (state: RootState) => state.chatListMeta.runningThreadIds;
export const selectHydratingThreadIds = (state: RootState) => state.chatListMeta.hydratingThreadIds;

export const selectChatGroups = createSelector(
  [
    (state: RootState) => state.threadIndex,
    (state: RootState) => state.threads.byId,
    selectUnreadThreadIds,
    selectRunningThreadIds
  ],
  (threadIndex, threadsById, unreadThreadIds, runningThreadIds) =>
    groupChatsByProject(overlayLocalThreadRows(threadIndex, threadsById, unreadThreadIds, runningThreadIds), unreadThreadIds)
);

function overlayLocalThreadRows(
  threadIndex: CodexThreadIndexState,
  threadsById: Record<string, CodexThreadState>,
  unreadThreadIds: readonly string[],
  runningThreadIds: readonly string[]
): CodexThreadIndexState {
  let next = threadIndex;
  const unread = new Set(unreadThreadIds);
  const running = new Set(runningThreadIds);
  for (const thread of Object.values(threadsById)) {
    if (thread.threadId.startsWith("local-thread:")) {
      continue;
    }
    const isRunning = thread.status === "running" || running.has(thread.threadId);
    const shouldOverlay = isRunning || unread.has(thread.threadId);
    if (!shouldOverlay) {
      continue;
    }
    const existing = next.threadsById[thread.threadId];
    const activity = isRunning ? "running" : existing?.activity ?? "none";
    if (existing && existing.activity === activity) {
      continue;
    }
    next = {
      ...next,
      threadsById: {
        ...next.threadsById,
        [thread.threadId]: {
          threadId: thread.threadId,
          title: existing?.title ?? thread.title ?? firstUserMessage(thread) ?? "Untitled",
          cwd: existing?.cwd ?? thread.cwd,
          path: existing?.path ?? thread.sessionPath,
          updatedAt: existing?.updatedAt ?? new Date().toISOString(),
          activity
        }
      },
      threadOrder: next.threadOrder.includes(thread.threadId)
        ? next.threadOrder
        : [thread.threadId, ...next.threadOrder]
    };
  }
  return next;
}

function firstUserMessage(thread: CodexThreadState): string | undefined {
  const transcript = thread.transcript;
  if (!transcript) {
    return undefined;
  }
  for (const turnId of transcript.turnOrder) {
    const turn = transcript.turnsById[turnId];
    for (const itemId of turn?.itemOrder ?? []) {
      const item = turn?.itemsById[itemId];
      if (item?.type === "userMessage") {
        return item.text;
      }
    }
  }
  return undefined;
}
