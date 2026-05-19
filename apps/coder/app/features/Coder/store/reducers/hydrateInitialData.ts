import type { CoderInitialData } from "./initialData";
import type { AppDispatch } from "../index";
import { composerConfigHydrated, composerModelsHydrated, composerThreadHydrated } from "../slices/composerSlice";
import { hydrateSelection } from "../slices/selectionSlice";
import { hydrateThreadIndex } from "../slices/threadIndexSlice";
import { hydrateThread } from "../slices/threadsSlice";

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
      indexedUpdatedAt: initialData.threadIndex.threadsById[thread.threadId]?.updatedAt
    }));
    dispatch(composerThreadHydrated(thread));
  }
}
