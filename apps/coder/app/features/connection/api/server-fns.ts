import { createServerFn } from "@tanstack/react-start";
import {
  CodexThreadIndexReducer,
  CodexThreadReducer,
  type CodexThreadState,
  type CodexThreadIndexState
} from "@taylordb/codex";
import {
  parseCodexProtocolRequestTraffic,
  parseCodexProtocolResponseTraffic,
  type CodexProtocolTraffic
} from "@taylordb/codex/protocol";
import type { CoderInitialData } from "../../conversation/state/initialData";
import { resolveInitialSelection } from "../../conversation/state/initialData";
import { DEFAULT_CODEX_CWD } from "./codexTransport";

type LoadCoderInitialDataInput = {
  chatId?: string;
};

export const loadCoderInitialDataFn = createServerFn({ method: "GET" })
  .inputValidator((input: LoadCoderInitialDataInput | undefined) => input ?? {})
  .handler(async ({ data }): Promise<Record<string, any>> =>
    loadCoderInitialData(data) as unknown as Record<string, any>);

export async function loadCoderInitialData(input: LoadCoderInitialDataInput = {}): Promise<CoderInitialData> {
  const { getSharedCodexBackend } = await import("../../../../api/codex-backend");
  const backend = getSharedCodexBackend();
  const [threadIndex, models, config] = await Promise.all([
    loadThreadIndex(),
    loadModels().catch(() => []),
    loadConfig().catch(() => undefined)
  ]);
  let selection = resolveInitialSelection(threadIndex, input.chatId);
  let nextThreadIndex = threadIndex;
  let thread: CodexThreadState | undefined;

  if (selection) {
    const hydrated = await hydrateThread(selection.chatId).catch(() => undefined);
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

  async function loadThreadIndex(): Promise<CodexThreadIndexState> {
    const reducer = new CodexThreadIndexReducer();
    const request = parseCodexProtocolRequestTraffic("thread/list", {
      limit: 100,
      sortKey: "updated_at",
      sortDirection: "desc",
      sourceKinds: [],
      archived: false,
      cwd: null
    }, { id: "ssr-thread-list", timestampMs: Date.now() });
    const response = await backend.request("thread/list", request.params);
    const responseTraffic = parseCodexProtocolResponseTraffic("thread/list", response, {
      id: request.id,
      timestampMs: Date.now()
    });
    return reducer.reduce(reducer.reduce(undefined, request), responseTraffic);
  }

  async function loadModels() {
    const response = await backend.request("model/list", {
      limit: 100,
      includeHidden: false
    });
    return response.data ?? [];
  }

  async function loadConfig() {
    const response = await backend.request("config/read", {
      cwd: DEFAULT_CODEX_CWD,
      includeLayers: false
    });
    return {
      model: response.config.model,
      model_reasoning_effort: response.config.model_reasoning_effort
    };
  }

  async function hydrateThread(threadId: string): Promise<{
    indexTraffic: CodexProtocolTraffic[];
    thread: CodexThreadState;
  }> {
    const reducer = new CodexThreadReducer({
      threadId,
      sessionPath: nextThreadIndex.threadsById[threadId]?.path
    });
    let state = reducer.initialState();
    const indexTraffic: CodexProtocolTraffic[] = [];
    const readRequest = parseCodexProtocolRequestTraffic("thread/read", {
      threadId,
      includeTurns: false
    }, { id: `ssr-thread-read-${threadId}`, timestampMs: Date.now() });
    state = reducer.reduce(state, readRequest);
    const readResponse = await backend.request("thread/read", readRequest.params);
    const readResponseTraffic = parseCodexProtocolResponseTraffic("thread/read", readResponse, {
      id: readRequest.id,
      timestampMs: Date.now()
    });
    indexTraffic.push(readResponseTraffic);
    state = reducer.reduce(state, readResponseTraffic);

    const sessionPath = readResponse.thread.path;
    if (sessionPath) {
      const fileRequest = parseCodexProtocolRequestTraffic("fs/readFile", {
        path: sessionPath
      }, { id: `ssr-fs-read-${threadId}`, timestampMs: Date.now() });
      state = reducer.reduce(state, fileRequest);
      const fileResponse = await backend.request("fs/readFile", fileRequest.params);
      const fileResponseTraffic = parseCodexProtocolResponseTraffic("fs/readFile", fileResponse, {
        id: fileRequest.id,
        timestampMs: Date.now()
      });
      state = reducer.reduce(state, fileResponseTraffic);
    }

    return {
      indexTraffic,
      thread: state
    };
  }
}

function reduceThreadIndexTraffic(
  initialState: CodexThreadIndexState,
  trafficItems: readonly CodexProtocolTraffic[]
): CodexThreadIndexState {
  const reducer = new CodexThreadIndexReducer();
  return trafficItems.reduce((state, traffic) => reducer.reduce(state, traffic), initialState);
}
