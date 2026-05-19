import { describe, expect, it, vi } from "vitest";
import { createCodexUIRuntime } from "../../core/CodexUIRuntime.js";
import type { CodexTransport } from "../../core/transport/CodexTransport.js";
import {
  parseCodexProtocolEventTraffic,
  parseCodexProtocolRequestTraffic,
  parseCodexProtocolResponseTraffic,
  type CodexProtocolTraffic,
  type CodexRequestMethod,
  type CodexRequestParams
} from "../../protocol/stream/index.js";

const fixtureCwd = "/workspace/codex-api";

describe("thread loading state e2e", () => {
  it("reduces thread/read plus fs/readFile into ready transcript state", () => {
    const runtime = createCodexUIRuntime({ transport: createManualTransport() });

    indexThread(runtime, "thread-a", "/tmp/thread-a.jsonl", "2026-05-18T10:00:00.000Z");
    readThread(runtime, "thread-a", "/tmp/thread-a.jsonl", "read-a");

    expect(runtime.state.status).toBe("loading");
    expect(runtime.state.renderBlocks).toEqual([]);

    readSessionFile(runtime, "/tmp/thread-a.jsonl", "read-a-file", "Hello from A");

    expect(runtime.state.threadId).toBe("thread-a");
    expect(runtime.state.status).toBe("ready");
    expect(runtime.state.renderBlocks.length).toBeGreaterThan(0);
    expect(runtime.shouldLoadThread("thread-a")).toBe(false);

    runtime.close();
  });

  it("routes session file reads to their owning thread reducer", () => {
    const runtime = createCodexUIRuntime({ transport: createManualTransport() });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    indexThread(runtime, "thread-a", "/tmp/thread-a.jsonl", "2026-05-18T10:00:00.000Z");
    indexThread(runtime, "thread-b", "/tmp/thread-b.jsonl", "2026-05-18T10:00:00.000Z");
    readThread(runtime, "thread-a", "/tmp/thread-a.jsonl", "read-a");

    runtime.dispatch(parseCodexProtocolRequestTraffic("fs/readFile", {
      path: "/tmp/thread-b.jsonl"
    }, { id: "read-b-file" }));

    expect(runtime.state.threadId).toBe("thread-a");
    expect(errorSpy).not.toHaveBeenCalled();

    runtime.close();
    errorSpy.mockRestore();
  });

  it("reuses fresh loaded thread state and reloads only when index metadata is stale", () => {
    const runtime = createCodexUIRuntime({ transport: createManualTransport() });

    indexThread(runtime, "thread-a", "/tmp/thread-a.jsonl", "2026-05-18T10:00:00.000Z");
    readThread(runtime, "thread-a", "/tmp/thread-a.jsonl", "read-a");
    readSessionFile(runtime, "/tmp/thread-a.jsonl", "read-a-file", "Cached A");
    indexThread(runtime, "thread-b", "/tmp/thread-b.jsonl", "2026-05-18T10:00:00.000Z");
    runtime.actions.activateThread("thread-b");
    readThread(runtime, "thread-b", "/tmp/thread-b.jsonl", "read-b");
    readSessionFile(runtime, "/tmp/thread-b.jsonl", "read-b-file", "Cached B");

    expect(runtime.state.threadId).toBe("thread-b");
    expect(runtime.shouldLoadThread("thread-a")).toBe(false);

    runtime.actions.activateThread("thread-a");
    expect(runtime.state.threadId).toBe("thread-a");
    expect(runtime.state.renderBlocks.some((block) => JSON.stringify(block).includes("Cached A"))).toBe(true);

    indexThread(runtime, "thread-a", "/tmp/thread-a-new.jsonl", "2026-05-18T10:00:00.000Z");
    expect(runtime.shouldLoadThread("thread-a")).toBe(true);

    indexThread(runtime, "thread-a", "/tmp/thread-a.jsonl", "2026-05-18T10:01:00.000Z");
    expect(runtime.shouldLoadThread("thread-a")).toBe(true);

    runtime.close();
  });

  it("does not duplicate loads while a thread has active requests", () => {
    const runtime = createCodexUIRuntime({ transport: createManualTransport() });

    runtime.actions.activateThread("thread-loading");
    runtime.dispatch(parseCodexProtocolRequestTraffic("thread/read", {
      threadId: "thread-loading",
      includeTurns: false
    }, { id: "read-loading" }));

    expect(runtime.state.threadId).toBe("thread-loading");
    expect(runtime.state.activeRequestIds).toContain("read-loading");
    expect(runtime.shouldLoadThread("thread-loading")).toBe(false);

    runtime.close();
  });

  it("ignores repeated request echoes after a request has completed", () => {
    const runtime = createCodexUIRuntime({ transport: createManualTransport() });

    indexThread(runtime, "thread-a", "/tmp/thread-a.jsonl", "2026-05-18T10:00:00.000Z");
    readThread(runtime, "thread-a", "/tmp/thread-a.jsonl", "read-a");
    readSessionFile(runtime, "/tmp/thread-a.jsonl", "read-a-file", "Loaded A");

    runtime.dispatch(parseCodexProtocolRequestTraffic("thread/read", {
      threadId: "thread-a",
      includeTurns: false
    }, { id: "read-a" }));

    expect(runtime.state.threadId).toBe("thread-a");
    expect(runtime.state.status).toBe("ready");
    expect(runtime.state.activeRequestIds).not.toContain("read-a");

    runtime.close();
  });

  it("keeps thread order stable when reading an older thread", () => {
    const runtime = createCodexUIRuntime({ transport: createManualTransport() });

    indexThread(runtime, "thread-a", "/tmp/thread-a.jsonl", "2026-05-18T10:00:00.000Z");
    indexThread(runtime, "thread-b", "/tmp/thread-b.jsonl", "2026-05-18T10:00:00.000Z");
    indexThread(runtime, "thread-c", "/tmp/thread-c.jsonl", "2026-05-18T10:01:00.000Z");

    expect(runtime.threadIndex.threadOrder).toEqual(["thread-c", "thread-b", "thread-a"]);

    readThread(runtime, "thread-a", "/tmp/thread-a.jsonl", "read-a");

    expect(runtime.threadIndex.threadOrder).toEqual(["thread-c", "thread-b", "thread-a"]);

    runtime.close();
  });

  it("scopes repeated fallback user message render ids by turn", () => {
    const runtime = createCodexUIRuntime({ transport: createManualTransport() });

    indexThread(runtime, "thread-a", "/tmp/thread-a.jsonl", "2026-05-18T10:00:00.000Z");
    readThread(runtime, "thread-a", "/tmp/thread-a.jsonl", "read-a");
    readSessionFileData(runtime, "/tmp/thread-a.jsonl", "read-a-file", repeatedUserMessageRolloutJsonl());

    const userBlocks = runtime.state.renderBlocks.filter((block) => block.type === "userMessage");
    expect(userBlocks).toHaveLength(2);
    expect(new Set(userBlocks.map((block) => block.id)).size).toBe(2);
    expect(userBlocks.map((block) => block.turnId)).toEqual(["turn-1", "turn-2"]);

    runtime.close();
  });

  it("rekeys an optimistic pending turn when the real turn starts before its user item", () => {
    const runtime = createCodexUIRuntime({ transport: createManualTransport() });

    indexThread(runtime, "thread-a", "/tmp/thread-a.jsonl", "2026-05-18T10:00:00.000Z");
    readThread(runtime, "thread-a", "/tmp/thread-a.jsonl", "read-a");
    runtime.actions.activateThread("thread-a");
    runtime.dispatch(parseCodexProtocolRequestTraffic("turn/start", {
      threadId: "thread-a",
      input: [{ type: "text", text: "hi", text_elements: [] }],
      cwd: fixtureCwd,
      approvalPolicy: "never",
      sandboxPolicy: { type: "readOnly" },
      model: null,
      effort: "medium"
    }, {
      id: "client-turn-1",
      metadata: { clientRequestId: "client-turn-1" },
      timestampMs: 1_000
    }));

    expect(userMessageTexts(runtime)).toEqual(["hi"]);

    runtime.dispatch(parseCodexProtocolResponseTraffic("turn/start", {
      turn: { id: "turn-1", status: "running", items: [] }
    }, {
      id: "backend-turn-1",
      metadata: { clientRequestId: "client-turn-1" },
      timestampMs: 1_050
    }));

    expect(runtime.state.transcript?.turnOrder).toEqual(["turn-1"]);
    expect(userMessageTexts(runtime)).toEqual(["hi"]);

    runtime.dispatch(parseCodexProtocolEventTraffic({
      method: "turn/started",
      params: {
        threadId: "thread-a",
        turnId: "turn-1",
        turn: { id: "turn-1", status: "running", items: [] }
      }
    }, { timestampMs: 1_100 }));

    expect(runtime.state.transcript?.turnOrder).toEqual(["turn-1"]);
    expect(userMessageTexts(runtime)).toEqual(["hi"]);

    runtime.dispatch(parseCodexProtocolEventTraffic({
      method: "item/started",
      params: {
        threadId: "thread-a",
        turnId: "turn-1",
        item: {
          type: "userMessage",
          id: "turn-1-user",
          content: [{ type: "text", text: "hi", text_elements: [] }]
        }
      }
    }, { timestampMs: 1_200 }));

    expect(runtime.state.transcript?.turnOrder).toEqual(["turn-1"]);
    expect(userMessageTexts(runtime)).toEqual(["hi"]);

    runtime.close();
  });

  it("merges persisted rollout turns with equivalent optimistic live turns", () => {
    const runtime = createCodexUIRuntime({ transport: createManualTransport() });

    indexThread(runtime, "thread-a", "/tmp/thread-a.jsonl", "2026-05-18T10:00:00.000Z");
    readThread(runtime, "thread-a", "/tmp/thread-a.jsonl", "read-a");
    runtime.actions.activateThread("thread-a");
    runtime.dispatch(parseCodexProtocolRequestTraffic("turn/start", {
      threadId: "thread-a",
      input: [{ type: "text", text: "Run sleep", text_elements: [] }],
      cwd: fixtureCwd,
      approvalPolicy: "never",
      sandboxPolicy: { type: "readOnly" },
      model: null,
      effort: "medium"
    }, {
      id: "client-turn-1",
      metadata: { clientRequestId: "client-turn-1" },
      timestampMs: 1_000
    }));

    readSessionFileData(runtime, "/tmp/thread-a.jsonl", "read-a-file", rolloutJsonlForTurn({
      assistantText: "done",
      message: "Run sleep",
      turnId: "persisted-turn-1"
    }));

    expect(userMessageTexts(runtime)).toEqual(["Run sleep"]);
    expect(runtime.state.transcript?.turnOrder).toEqual(["persisted-turn-1"]);

    runtime.close();
  });
});

function userMessageTexts(runtime: ReturnType<typeof createCodexUIRuntime>): string[] {
  return runtime.state.renderBlocks.flatMap((block) => block.type === "userMessage" ? [block.text] : []);
}

function indexThread(
  runtime: ReturnType<typeof createCodexUIRuntime>,
  threadId: string,
  path: string,
  updatedAt: string
): void {
  runtime.dispatch(parseCodexProtocolResponseTraffic("thread/list", {
    data: [{ id: threadId, cwd: fixtureCwd, path, updatedAt, turns: [] }]
  }, { id: `list-${threadId}-${updatedAt}-${path}` }));
}

function readThread(
  runtime: ReturnType<typeof createCodexUIRuntime>,
  threadId: string,
  path: string,
  requestId: string
): void {
  runtime.dispatch(parseCodexProtocolRequestTraffic("thread/read", {
    threadId,
    includeTurns: false
  }, { id: requestId }));
  runtime.dispatch(parseCodexProtocolResponseTraffic("thread/read", {
    thread: { id: threadId, cwd: fixtureCwd, path, turns: [] }
  }, { id: requestId }));
}

function readSessionFile(
  runtime: ReturnType<typeof createCodexUIRuntime>,
  path: string,
  requestId: string,
  assistantText: string
): void {
  readSessionFileData(runtime, path, requestId, rolloutJsonl(assistantText));
}

function readSessionFileData(
  runtime: ReturnType<typeof createCodexUIRuntime>,
  path: string,
  requestId: string,
  dataText: string
): void {
  runtime.dispatch(parseCodexProtocolRequestTraffic("fs/readFile", { path }, { id: requestId }));
  runtime.dispatch(parseCodexProtocolResponseTraffic("fs/readFile", {
    dataText
  }, { id: requestId }));
}

function rolloutJsonl(assistantText: string): string {
  return rolloutJsonlForTurn({
    assistantText,
    message: "Hello",
    turnId: "turn-1"
  });
}

function rolloutJsonlForTurn(input: {
  assistantText: string;
  message: string;
  turnId: string;
}): string {
  return [
    { type: "turn_context", payload: { turn_id: input.turnId } },
    { type: "event_msg", payload: { type: "user_message", message: input.message, local_images: [], text_elements: [] } },
    { type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: input.assistantText }] } },
    { type: "event_msg", payload: { type: "task_complete", turn_id: input.turnId, duration_ms: 12 } }
  ].map((entry) => JSON.stringify(entry)).join("\n");
}

function repeatedUserMessageRolloutJsonl(): string {
  return [
    { type: "turn_context", payload: { turn_id: "turn-1" } },
    { type: "event_msg", payload: { type: "user_message", message: "Repeat me", local_images: [], text_elements: [] } },
    { type: "event_msg", payload: { type: "task_complete", turn_id: "turn-1", duration_ms: 12 } },
    { type: "turn_context", payload: { turn_id: "turn-2" } },
    { type: "event_msg", payload: { type: "user_message", message: "Repeat me", local_images: [], text_elements: [] } },
    { type: "event_msg", payload: { type: "task_complete", turn_id: "turn-2", duration_ms: 12 } }
  ].map((entry) => JSON.stringify(entry)).join("\n");
}

function createManualTransport(): CodexTransport {
  const listeners = new Set<(traffic: CodexProtocolTraffic) => void>();
  return {
    request: async <M extends CodexRequestMethod>(_method: M, _params: CodexRequestParams<M>) => {
      throw new Error("Manual transport does not serve requests");
    },
    notify: async () => undefined,
    onTraffic: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onDiagnostic: () => () => undefined,
    close: () => undefined
  };
}
