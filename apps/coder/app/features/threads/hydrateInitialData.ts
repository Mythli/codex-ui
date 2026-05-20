import type { CoderInitialData } from "@coder/types";
import { composerConfigHydrated, composerModelsHydrated, composerThreadHydrated } from "../composer/state/composerSlice";
import { hydrateSelection } from "./state/threadSelectionSlice";
import type { AppDispatch } from "../../store/configureStore";
import { hydrateThreadIndex } from "./state/threadIndexSlice";
import { hydrateThread } from "../thread/state/loadedThreadsSlice";

export function hydrateCoderInitialData(
  dispatch: AppDispatch,
  initialData: CoderInitialData
): void {
  dispatch(hydrateThreadIndex(initialData.threadIndex));
  if (initialData.models) {
    dispatch(composerModelsHydrated(initialData.models));
  }
  if (initialData.config) {
    dispatch(composerConfigHydrated(initialData.config));
  }
  if (initialData.selection) {
    dispatch(hydrateSelection({
      kind: "thread",
      threadId: initialData.selection.chatId,
      projectId: initialData.selection.projectId
    }));
  }
  const thread = initialData.thread;
  if (thread?.threadId) {
    dispatch(hydrateThread({
      thread,
      indexedUpdatedAt: initialData.threadIndex.threadsById[thread.threadId]?.updatedAt,
      loadedAtMs: initialData.generatedAtMs
    }));
    dispatch(composerThreadHydrated(thread));
  }
}
