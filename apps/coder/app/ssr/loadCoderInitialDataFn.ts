import { createServerFn } from "@tanstack/react-start";
import { DEFAULT_CODEX_CWD } from "@coder/defaults";
import type { CoderInitialData, CodexThreadState } from "@coder/types";
import { loadInitialThreadForSsr } from "@app/features/thread/ssr/loadInitialThread";
import {
  loadThreadIndexForSsr,
  reduceThreadIndexTraffic
} from "@app/features/threads/ssr/loadThreadIndex";
import { resolveInitialSelection } from "@app/features/threads/initialData";
import {
  loadWorkspaceConfigForSsr,
  loadWorkspaceModelsForSsr
} from "@app/features/workspace/ssr/loadWorkspaceInitialData";

type LoadCoderInitialDataInput = {
  chatId?: string;
};

export const loadCoderInitialDataFn = createServerFn({ method: "GET" })
  .inputValidator((input: LoadCoderInitialDataInput | undefined) => input ?? {})
  .handler(async ({ data }): Promise<Record<string, any>> =>
    loadCoderInitialData(data) as unknown as Record<string, any>);

export async function loadCoderInitialData(
  input: LoadCoderInitialDataInput = {}
): Promise<CoderInitialData> {
  const { getDependencies } = await import("../../dependencies");
  const backend = getDependencies().liveBackend;
  const [threadIndex, models, config] = await Promise.all([
    loadThreadIndexForSsr(backend),
    loadWorkspaceModelsForSsr(backend).catch(() => []),
    loadWorkspaceConfigForSsr(backend).catch(() => undefined)
  ]);
  let selection = resolveInitialSelection(threadIndex, input.chatId);
  let nextThreadIndex = threadIndex;
  let thread: CodexThreadState | undefined;

  if (selection) {
    const hydrated = await loadInitialThreadForSsr(backend, {
      threadId: selection.chatId,
      sessionPath: nextThreadIndex.threadsById[selection.chatId]?.path
    }).catch(() => undefined);
    if (hydrated) {
      nextThreadIndex = reduceThreadIndexTraffic(nextThreadIndex, hydrated.indexTraffic);
      thread = hydrated.thread;
      selection = resolveInitialSelection(nextThreadIndex, selection.chatId) ?? selection;
    }
  }

  return {
    config,
    defaultCwd: DEFAULT_CODEX_CWD,
    generatedAtMs: Date.now(),
    models,
    selection,
    thread,
    threadIndex: nextThreadIndex
  };
}
