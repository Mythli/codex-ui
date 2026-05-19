import type {
  CodexThreadIndexState,
  CodexThreadState
} from "@taylordb/codex";
import type {
  CoderComposerState,
  CoderReasoningEffort,
  CoderSelection
} from "../../../coderui/features/CoderCore/types";

export type ThreadCacheMetadata = {
  loadedAtMs: number;
  loadedIndexUpdatedAt?: string;
  loadedSessionPath?: string;
};

export type CoderConnectionState = {
  status: "idle" | "connecting" | "connected" | "disconnected" | "closed" | "failed";
  initialized: boolean;
  diagnostics: string[];
  closed?: { exitCode: number | null; signal: string | null };
  error?: string;
};

export type CoderThreadsState = {
  byId: Record<string, CodexThreadState>;
  activeThreadId?: string;
  requestThreadIdsById: Record<string, string>;
  turnThreadIdsById: Record<string, string>;
  sessionThreadIdsByPath: Record<string, string>;
  cacheMetadataByThreadId: Record<string, ThreadCacheMetadata>;
};

export type CoderChatListMetaState = {
  unreadThreadIds: string[];
  runningThreadIds: string[];
  hydratingThreadIds: string[];
};

export type CoderModelsConfigState = {
  modelsStatus: "idle" | "loading" | "ready" | "failed";
  configStatus: "idle" | "loading" | "ready" | "failed";
  error?: string;
};

export type CoderFixtureState = {
  status: "idle" | "active";
};

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

export type CoderSelectionState = {
  current: CoderSelection;
  nextDraftId: number;
};

export type CoderReduxState = {
  codexConnection: CoderConnectionState;
  threadIndex: CodexThreadIndexState;
  threads: CoderThreadsState;
  selection: CoderSelectionState;
  composer: CoderComposerState;
  chatListMeta: CoderChatListMetaState;
  modelsConfig: CoderModelsConfigState;
  fixture: CoderFixtureState;
};

export type CoderSubmitPromptResult = { createdThreadId?: string } | undefined;
