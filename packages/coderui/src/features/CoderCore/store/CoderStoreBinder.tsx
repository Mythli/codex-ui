import { useEffect, useRef } from "react";
import { requireCoderUIDependency, useCoderUIConfig } from "../../../system";
import { useCoderDashboard } from "../hooks";
import { shouldHydrateActiveChat } from "./hydrationGuards";
import {
  selectIsRunning,
  selectSelectedThreadId
} from "./coderSelectors";
import {
  useCoderStore
} from "./coderStore";

export function CoderStoreBinder() {
  const { adapters } = useCoderUIConfig();
  const coder = requireCoderUIDependency(adapters?.coder, "Coder runtime adapter");
  const dashboard = useCoderDashboard();
  const activeChatId = useCoderStore(selectSelectedThreadId);
  const beginThreadHydration = useCoderStore((state) => state.beginThreadHydration);
  const endThreadHydration = useCoderStore((state) => state.endThreadHydration);
  const isDraftChat = useCoderStore((state) => state.selection.kind === "draft");
  const isRunning = useCoderStore(selectIsRunning);
  const runtime = useCoderStore((state) => state.runtime);
  const runtimeState = useCoderStore((state) => state.runtimeState);
  const threadIndex = useCoderStore((state) => state.threadIndex);
  const hydrateConfig = useCoderStore((state) => state.hydrateConfig);
  const hydrateModels = useCoderStore((state) => state.hydrateModels);
  const hydratingThreadIdsRef = useRef(new Set<string>());

  useEffect(() => {
    const store = useCoderStore.getState();
    store.bindRuntime(coder.runtime, { defaultCwd: coder.defaultCwd });
    const unsubscribeRuntime = coder.runtime.subscribe((state) => {
      useCoderStore.getState().setRuntimeState(state);
    });
    const unsubscribeThreadIndex = coder.runtime.subscribeThreadIndex((state) => {
      useCoderStore.getState().setThreadIndex(state);
    });
    void coder.runtime.actions.refreshThreadIndex()
      .catch(() => undefined);
    return () => {
      unsubscribeRuntime();
      unsubscribeThreadIndex();
      useCoderStore.getState().clearRuntime(coder.runtime);
    };
  }, [coder]);

  useEffect(() => {
    if (dashboard.modelsQuery.data) {
      hydrateModels(dashboard.modelsQuery.data);
    }
  }, [dashboard.modelsQuery.data, hydrateModels]);

  useEffect(() => {
    const config = dashboard.configQuery.data;
    if (!config) {
      return;
    }
    hydrateConfig({
      model: config.model,
      reasoningEffort: config.reasoningEffort
    });
  }, [dashboard.configQuery.data, hydrateConfig]);

  useEffect(() => {
    const chatId = activeChatId;
    const shouldLoadThread = chatId && runtime ? runtime.shouldLoadThread(chatId) : false;
    const isHydratingThread = chatId ? hydratingThreadIdsRef.current.has(chatId) : false;
    if (!shouldHydrateActiveChat({
      activeChatId: chatId,
      isDraftChat,
      isHydratingThread,
      isRunning,
      shouldLoadThread
    })) {
      if (
        chatId &&
        runtime &&
        !isDraftChat &&
        !isRunning &&
        (!shouldLoadThread || isHydratingThread) &&
        runtimeState.threadId !== chatId
      ) {
        runtime.actions.activateThread(chatId);
      }
      return;
    }
    if (!chatId || !runtime) {
      return;
    }

    hydratingThreadIdsRef.current.add(chatId);
    beginThreadHydration(chatId);
    let isCurrent = true;
    const startedAt = Date.now();
    const watchdog = window.setTimeout(() => {
      if (!isCurrent) {
        return;
      }
      console.warn("[codex ui] thread-open:watchdog", {
        requestedThreadId: chatId,
        selectedThreadId: activeChatId,
        runtimeThreadId: runtime.state.threadId,
        runtimeStatus: runtime.state.status,
        activeRequestCount: runtime.state.activeRequestIds.length,
        threadIndexStatus: runtime.threadIndex.status,
        elapsedMs: Date.now() - startedAt
      });
    }, 5_000);
    void runtime.actions
      .openThread(chatId)
      .catch(() => undefined)
      .finally(() => {
        hydratingThreadIdsRef.current.delete(chatId);
        endThreadHydration(chatId);
        window.clearTimeout(watchdog);
      });

    return () => {
      isCurrent = false;
      window.clearTimeout(watchdog);
    };
  }, [activeChatId, beginThreadHydration, endThreadHydration, isDraftChat, isRunning, runtime, runtimeState, threadIndex]);

  return null;
}
