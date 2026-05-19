import {
  CodexSocketIoTransport,
  createCodexUIRuntime
} from "@taylordb/codex/browser";
import { GitClient, createGitSocketIoTransport } from "@taylordb/git-observer/browser";
import type { CoderReasoningEffort, CoderRuntimeAdapter } from "@taylordb/coderui";
import { io } from "socket.io-client";
import { getAppSocketAuth } from "../../../core/appSession";

const defaultCwd = "/Users/tobiasanhalt/Development/codex-api";
const codexTransport = new CodexSocketIoTransport(io("/codex", {
  path: "/app-socket",
  auth: getAppSocketAuth()
}));
const codexRuntime = createCodexUIRuntime({
  transport: codexTransport,
  defaults: {
    cwd: defaultCwd,
    reasoningEffort: "medium",
    sandbox: "read-only",
    approvalPolicy: "never"
  }
});

export function createCodexAdapter(): CoderRuntimeAdapter {
  return {
    defaultCwd,
    runtime: codexRuntime,
    listModels: async ({ limit }) => {
      const response = await codexTransport.request("model/list", {
        limit,
        includeHidden: false
      });
      return (response.data ?? []).map((model) => ({
        id: model.id ?? model.model,
        model: model.model ?? model.id ?? "",
        displayName: model.displayName ?? model.model ?? "Model",
        defaultReasoningEffort: model.defaultReasoningEffort,
        supportedReasoningEfforts: model.supportedReasoningEfforts,
        isDefault: model.isDefault
      }));
    },
    readConfig: async ({ cwd, includeLayers = false }) => {
      const response = await codexTransport.request("config/read", {
        cwd: cwd ?? null,
        includeLayers
      });
      return {
        model: response.config.model,
        reasoningEffort: response.config.model_reasoning_effort as CoderReasoningEffort | null | undefined
      };
    }
  };
}

export function createGitClient() {
  return new GitClient({
    transport: createGitSocketIoTransport("/git", { path: "/app-socket" })
  });
}
