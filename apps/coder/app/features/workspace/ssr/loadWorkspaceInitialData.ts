import { DEFAULT_CODEX_CWD } from "@coder/defaults";
import type {
  CodexAppServerConfig,
  CodexAppServerModel,
  CodexTransport
} from "@coder/types";

export async function loadWorkspaceModelsForSsr(backend: CodexTransport): Promise<CodexAppServerModel[]> {
  const response = await backend.request("model/list", {
    limit: 100,
    includeHidden: false
  });
  return response.data ?? [];
}

export async function loadWorkspaceConfigForSsr(
  backend: CodexTransport
): Promise<Pick<CodexAppServerConfig, "model" | "model_reasoning_effort">> {
  const response = await backend.request("config/read", {
    cwd: DEFAULT_CODEX_CWD,
    includeLayers: false
  });
  return {
    model: response.config.model,
    model_reasoning_effort: response.config.model_reasoning_effort
  };
}
