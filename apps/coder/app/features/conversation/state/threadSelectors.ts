import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "../../../store/configureStore";

export const selectSelection = (state: RootState) => state.selection.current;

export const selectSelectedThreadId = createSelector(
  [selectSelection],
  (selection) => selection.kind === "thread" ? selection.threadId : undefined
);

export const selectActiveThread = createSelector(
  [(state: RootState) => state.threads.byId, (state: RootState) => state.threads.activeThreadId, selectSelection],
  (threadsById, activeThreadId, selection) => {
    if (selection.kind === "draft") {
      const activeThread = activeThreadId ? threadsById[activeThreadId] : undefined;
      return activeThread?.isProvisionalThread ? activeThread : undefined;
    }
    return selection.kind === "thread" ? threadsById[selection.threadId] : undefined;
  }
);

export const selectIsRunning = createSelector(
  [selectActiveThread],
  (thread) => thread?.status === "running"
);

export const selectShouldLoadSelectedThread = createSelector(
  [
    (state: RootState) => state.threads.byId,
    (state: RootState) => state.threads.cacheMetadataByThreadId,
    (state: RootState) => state.chatListMeta.hydratingThreadIds,
    (state: RootState) => state.threadIndex.threadsById,
    selectSelection
  ],
  (threadsById, cacheMetadataByThreadId, hydratingThreadIds, indexedThreadsById, selection) => {
    if (selection.kind !== "thread") {
      return false;
    }
    const threadId = selection.threadId;
    if (hydratingThreadIds.includes(threadId)) {
      return false;
    }
    const thread = threadsById[threadId];
    if (!thread) {
      return true;
    }
    if (thread.status === "failed") {
      return true;
    }
    if (thread.activeRequestIds.length > 0) {
      return false;
    }
    if (thread.status === "loading") {
      return thread.renderBlocks.length === 0;
    }
    if (thread.status === "running") {
      return false;
    }
    const metadata = cacheMetadataByThreadId[threadId];
    if (!metadata) {
      return thread.renderBlocks.length === 0;
    }
    const indexed = indexedThreadsById[threadId];
    if (indexed?.path && metadata.loadedSessionPath !== indexed.path) {
      return true;
    }
    if (indexed?.updatedAt && metadata.loadedIndexUpdatedAt && metadata.loadedIndexUpdatedAt !== indexed.updatedAt) {
      return true;
    }
    return false;
  }
);
