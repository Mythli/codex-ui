import type {
  CodexAppServerConfig,
  CodexAppServerModel
} from "./appServer.js";
import type { CodexThreadState } from "../app/features/thread/state/threadReducer/CodexThreadReducer.js";
import type { CodexThreadIndexState } from "../app/features/threads/state/threadIndexReducer/CodexThreadIndexReducer.js";

export type CoderInitialSelection = {
  chatId: string;
  projectId: string;
};

export type CoderInitialData = {
  defaultCwd?: string;
  generatedAtMs?: number;
  config?: Pick<CodexAppServerConfig, "model" | "model_reasoning_effort">;
  models?: CodexAppServerModel[];
  selection?: CoderInitialSelection;
  thread?: CodexThreadState;
  threadIndex: CodexThreadIndexState;
};
