import {
  CodexThreadIndexReducer,
  CodexThreadReducer,
  CodexTrafficPacket,
  type CodexProtocolTraffic,
  type CodexRuntimeState,
  type CodexThreadIndexState,
  type CodexThreadState,
  type CodexUIRuntime
} from "@taylordb/codex";
import type { CoderRuntimeAdapter } from "../types";

export type MockCoderAdapterOptions = {
  openThreadError?: string | ((threadId: string) => string | undefined);
};

export function createMockCoderAdapter(options: MockCoderAdapterOptions = {}): CoderRuntimeAdapter {
  return {
    defaultCwd: "/workspace/coder",
    runtime: createMockRuntime(options),
    listModels: async () => [
      {
        model: "gpt-5.5",
        displayName: "OpenAI: GPT-5.5",
        defaultReasoningEffort: "medium",
        supportedReasoningEfforts: ["low", "medium", "high", "xhigh"],
        isDefault: true
      },
      {
        model: "gpt-5.4",
        displayName: "OpenAI: GPT-5.4",
        defaultReasoningEffort: "low",
        supportedReasoningEfforts: ["minimal", "low", "medium", "high"]
      }
    ],
    readConfig: async () => ({
      model: "gpt-5.5",
      reasoningEffort: "medium"
    })
  };
}

function createMockRuntime(options: MockCoderAdapterOptions): CodexUIRuntime {
  let reducer: CodexThreadReducer | undefined;
  const indexReducer = new CodexThreadIndexReducer();
  let threadState: CodexThreadState | undefined;
  let state: CodexRuntimeState = emptyRuntimeState();
  let threadIndex: CodexThreadIndexState = indexReducer.initialState();
  const listeners = new Set<(nextState: CodexRuntimeState) => void>();
  const indexListeners = new Set<(nextState: CodexThreadIndexState) => void>();

  const dispatch = (traffic: CodexProtocolTraffic) => {
    threadIndex = indexReducer.reduce(threadIndex, traffic);
    for (const listener of indexListeners) {
      listener(threadIndex);
    }

    const packet = CodexTrafficPacket.from(traffic);
    if (!reducer && packet.threadId) {
      reducer = new CodexThreadReducer({ threadId: packet.threadId });
      threadState = reducer.initialState();
      state = runtimeStateFromThread(threadState);
    }
    if (reducer) {
      threadState = reducer.reduce(threadState, traffic);
      state = runtimeStateFromThread(threadState);
    }
    for (const listener of listeners) {
      listener(state);
    }
  };

  const stringifyMockInput = (input: Parameters<CodexUIRuntime["actions"]["startThreadWithMessage"]>[0]["input"]) =>
    typeof input === "string"
      ? input
      : input.flatMap((entry) => entry.type === "text" || entry.type === "input_text" ? [entry.text] : []).join("\n");
  const mockInputContent = (input: Parameters<CodexUIRuntime["actions"]["startThreadWithMessage"]>[0]["input"]) =>
    typeof input === "string"
      ? [{ type: "text" as const, text: input, text_elements: [] }]
      : input.map((entry) => entry.type === "input_image"
        ? { type: "input_image" as const, image_url: entry.image_url }
        : entry.type === "image"
          ? { type: "image" as const, url: entry.url }
          : entry.type === "localImage"
            ? { type: "localImage" as const, path: entry.path }
            : entry.type === "input_text"
              ? { type: "text" as const, text: entry.text, text_elements: [] }
              : entry.type === "text"
                ? { type: "text" as const, text: entry.text, text_elements: entry.text_elements ?? [] }
                : { type: "text" as const, text: "", text_elements: [] });

  const dispatchMockTurn = (
    threadId: string,
    turnId: string,
    input: Parameters<CodexUIRuntime["actions"]["startThreadWithMessage"]>[0]["input"]
  ) => {
    const text = stringifyMockInput(input);
    dispatch({
      kind: "event",
      event: {
        method: "turn/started",
        params: {
          threadId,
          turnId,
          turn: { id: turnId, status: "running", itemsView: "full", items: [], startedAt: Date.now() / 1000 }
        }
      }
    });
    dispatch({
      kind: "event",
      event: {
        method: "item/completed",
        params: {
          threadId,
          turnId,
          completedAtMs: Date.now(),
          item: {
            type: "userMessage",
            id: `${turnId}:user`,
            content: mockInputContent(input)
          }
        }
      }
    });
    dispatch({
      kind: "event",
      event: {
        method: "item/completed",
        params: {
          threadId,
          turnId,
          completedAtMs: Date.now(),
          item: {
            type: "agentMessage",
            id: `${turnId}:assistant`,
            text: "Done. I added the requested UI pieces and kept the runtime boundary clean.",
            phase: "final_answer",
            memoryCitation: null
          }
        }
      }
    });
    dispatch({
      kind: "event",
      event: {
        method: "turn/completed",
        params: {
          threadId,
          turnId,
          turn: {
            id: turnId,
            status: "completed",
            itemsView: "full",
            startedAt: Date.now() / 1000,
            completedAt: Date.now() / 1000,
            durationMs: 250,
            items: []
          }
        }
      }
    });
    dispatch({
      kind: "event",
      event: {
        method: "thread/tokenUsage/updated",
        params: {
          threadId,
          turnId,
          tokenUsage: {
            total: {
              totalTokens: 103_000,
              inputTokens: 100_000,
              cachedInputTokens: 50_000,
              outputTokens: 3_000,
              reasoningOutputTokens: 1_000
            },
            last: {
              totalTokens: 4_200,
              inputTokens: 4_000,
              cachedInputTokens: 2_000,
              outputTokens: 200,
              reasoningOutputTokens: 20
            },
            modelContextWindow: 258_000
          }
        }
      }
    });
  };

  return {
    get state() {
      return state;
    },
    get threadIndex() {
      return threadIndex;
    },
    shouldLoadThread: (threadId) => state.threadId !== threadId || state.status === "failed",
    actions: {
      activateThread: (threadId) => {
        if (state.threadId === threadId) {
          return;
        }
        reducer = new CodexThreadReducer({ threadId });
        threadState = reducer.initialState();
        state = runtimeStateFromThread(threadState);
        for (const listener of listeners) {
          listener(state);
        }
      },
      openThread: async (threadId) => {
        reducer = new CodexThreadReducer({ threadId });
        threadState = reducer.initialState();
        state = runtimeStateFromThread(threadState);
        const openError = typeof options.openThreadError === "function"
          ? options.openThreadError(threadId)
          : options.openThreadError;
        if (openError) {
          const requestId = `mock-read-${threadId}`;
          dispatch({
            kind: "request",
            id: requestId,
            method: "thread/read",
            params: { threadId, includeTurns: false }
          });
          dispatch({
            kind: "responseError",
            id: requestId,
            method: "thread/read",
            error: {
              message: openError
            }
          });
          return;
        }
        dispatch(mockThreadReadTraffic(threadId));
      },
      refreshThreadIndex: async () => {
        dispatch({
          kind: "response",
          id: `mock-thread-list-${Date.now()}`,
          method: "thread/list",
          response: {
            data: mockThreads()
          }
        });
      },
      sendMessageToThread: async (message) => {
        const threadId = message.threadId;
        const turnId = `mock-turn-${Date.now()}`;
        dispatchMockTurn(threadId, turnId, message.input);
      },
      startThreadWithMessage: async (message) => {
        const threadId = `mock-thread-${Date.now()}`;
        const turnId = `mock-turn-${Date.now()}`;
        dispatch({
          kind: "response",
          id: `mock-new-${threadId}`,
          method: "thread/start",
          response: {
            thread: {
              id: threadId,
              name: "New chat",
              cwd: message.cwd,
              turns: []
            }
          }
        });
        dispatchMockTurn(threadId, turnId, message.input);
        return { threadId };
      },
      stopTurn: async () => {},
      archiveThread: async () => {},
      newThread: async (options) => {
        const threadId = `mock-thread-${Date.now()}`;
        reducer = undefined;
        threadState = undefined;
        state = emptyRuntimeState("loading");
        dispatch({
          kind: "response",
          id: `mock-new-${threadId}`,
          method: "thread/start",
          response: {
            thread: {
              id: threadId,
              name: "New chat",
              cwd: options?.cwd ?? "/workspace/coder",
              turns: []
            }
          }
        });
      }
    },
    dispatch,
    subscribe: (listener) => {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    subscribeThreadIndex: (listener) => {
      indexListeners.add(listener);
      listener(threadIndex);
      return () => indexListeners.delete(listener);
    },
    close: () => {
      listeners.clear();
      indexListeners.clear();
    }
  };
}

function mockThreads() {
  const now = new Date().toISOString();
  return [
    {
      id: "publish-controls",
      name: "Publish controls and commit switcher",
      cwd: "/workspace/coder",
      updatedAt: now,
      turns: []
    },
    {
      id: "chat-switcher",
      name: "Project grouped chat switcher",
      cwd: "/workspace/coder",
      updatedAt: now,
      turns: []
    },
    {
      id: "file-upload",
      name: "File upload with drag-and-drop",
      cwd: "/workspace/admin",
      updatedAt: now,
      turns: []
    }
  ];
}

function emptyRuntimeState(status: CodexRuntimeState["status"] = "empty"): CodexRuntimeState {
  return {
    status,
    activeRequestIds: [],
    renderBlocks: []
  };
}

function runtimeStateFromThread(thread: CodexThreadState): CodexRuntimeState {
  return {
    ...thread,
    thread
  };
}

function mockThreadReadTraffic(threadId: string): Extract<CodexProtocolTraffic, { kind: "response" }> {
  return {
    kind: "response",
    id: `mock-read-${threadId}`,
    method: "thread/read",
    response: {
      thread: {
        id: threadId,
        name: "Project grouped chat switcher",
        cwd: "/workspace/coder",
        turns: []
      }
    }
  };
}
