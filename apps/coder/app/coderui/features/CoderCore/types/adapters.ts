import type { CodexUIRuntime } from "@taylordb/codex";
import type { CoderReasoningEffort } from "./state";

export type CoderRuntimeModel = {
  id?: string;
  model: string;
  displayName: string;
  defaultReasoningEffort?: string;
  supportedReasoningEfforts?: Array<string | { reasoningEffort?: string; effort?: string }>;
  isDefault?: boolean;
};

export type CoderRuntimeConfig = {
  model?: string | null;
  reasoningEffort?: CoderReasoningEffort | null;
};

export type CoderRuntimeAdapter = {
  defaultCwd?: string;
  runtime: CodexUIRuntime;
  listModels(input: { limit: number }): Promise<CoderRuntimeModel[]>;
  readConfig?(input: { cwd?: string | null; includeLayers?: boolean }): Promise<CoderRuntimeConfig>;
};
