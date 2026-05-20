import { describe, expect, it } from "vitest";
import type { CodexTransport } from "./transport/CodexTransport.js";
import {
  executeCodexRequestPlan,
  planSendMessageToThread,
  planStartThreadWithMessage
} from "./CodexActionPlanner.js";

function createRecordingTransport() {
  const requests: Array<{ method: string; params: unknown }> = [];
  const transport: CodexTransport = {
    request: async (method, params) => {
      requests.push({ method, params });
      if (method === "thread/start" || method === "thread/resume") {
        return {
          thread: {
            id: "thread-1",
            cwd: "/workspace/project",
            turns: []
          }
        } as never;
      }
      if (method === "turn/start") {
        return {
          turn: {
            id: "turn-1",
            status: "completed",
            items: []
          }
        } as never;
      }
      return {} as never;
    },
    notify: () => undefined,
    onTraffic: () => () => undefined,
    onDiagnostic: () => () => undefined,
    close: () => undefined
  };
  return { requests, transport };
}

describe("CodexActionPlanner permissions and image input", () => {
  it("passes permission overrides through thread start and turn start", async () => {
    const { requests, transport } = createRecordingTransport();

    await executeCodexRequestPlan({
      plan: planStartThreadWithMessage({
        input: "hello",
        cwd: "/workspace/project",
        sandbox: "danger-full-access",
        approvalPolicy: "never"
      }),
      context: {},
      transport
    });

    expect(requests[0]).toMatchObject({
      method: "thread/start",
      params: {
        sandbox: "danger-full-access",
        approvalPolicy: "never"
      }
    });
    expect(requests[1]).toMatchObject({
      method: "turn/start",
      params: {
        approvalPolicy: "never",
        sandboxPolicy: { type: "dangerFullAccess" }
      }
    });
  });

  it("passes auto-review overrides through thread resume and preserves image inputs", async () => {
    const { requests, transport } = createRecordingTransport();

    await executeCodexRequestPlan({
      plan: planSendMessageToThread({
        threadId: "thread-1",
        input: [
          { type: "text", text: "look at this", text_elements: [] },
          { type: "image", url: "data:image/png;base64,aaa" }
        ],
        cwd: "/workspace/project",
        sandbox: "workspace-write",
        approvalPolicy: "on-request"
      }),
      context: {},
      transport
    });

    expect(requests[0]).toMatchObject({
      method: "thread/resume",
      params: {
        sandbox: "workspace-write",
        approvalPolicy: "on-request"
      }
    });
    expect(requests[1]).toMatchObject({
      method: "turn/start",
      params: {
        approvalPolicy: "on-request",
        sandboxPolicy: { type: "workspaceWrite" },
        input: [
          { type: "text", text: "look at this", text_elements: [] },
          { type: "image", url: "data:image/png;base64,aaa" }
        ]
      }
    });
  });
});
