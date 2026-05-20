import type { CodexRequestParams } from "@taylordb/codex/protocol";
import { requestCodex } from "../../connection/api/codexClient";
import type { AppThunk } from "../../../store/configureStore";
import { threadHydrationFinished, threadHydrationStarted } from "./chatListMetaSlice";
import { markThreadHydrated } from "./threadsSlice";

export function refreshThreadIndex(input: Partial<CodexRequestParams<"thread/list">> = {}): AppThunk<Promise<void>> {
  return async (dispatch) => {
    await requestCodex(dispatch, "thread/list", {
      limit: input.limit ?? 100,
      sortKey: input.sortKey ?? "updated_at",
      sortDirection: input.sortDirection ?? "desc",
      sourceKinds: input.sourceKinds ?? [],
      archived: input.archived ?? false,
      cwd: "cwd" in input ? input.cwd : null,
      ...input
    });
  };
}

export function openThread(threadId: string): AppThunk<Promise<void>> {
  return async (dispatch, getState) => {
    dispatch(threadHydrationStarted(threadId));
    try {
      const readResponse = await requestCodex(dispatch, "thread/read", {
        threadId,
        includeTurns: false
      }, { targetThreadId: threadId, prefix: "thread-read" });

      const sessionPath = readResponse.thread.path;
      if (sessionPath) {
        await requestCodex(dispatch, "fs/readFile", { path: sessionPath }, {
          targetThreadId: threadId,
          prefix: "fs-read"
        });
      }

      const indexed = getState().threadIndex.threadsById[threadId];
      dispatch(markThreadHydrated({
        threadId,
        indexedUpdatedAt: indexed?.updatedAt,
        sessionPath: sessionPath ?? indexed?.path
      }));
    } finally {
      dispatch(threadHydrationFinished(threadId));
    }
  };
}

export function archiveThread(threadId: string): AppThunk<Promise<void>> {
  return async (dispatch) => {
    await requestCodex(dispatch, "thread/archive", { threadId }, {
      targetThreadId: threadId,
      prefix: "thread-archive"
    });
  };
}
