import type { CodexThreadState } from "@taylordb/codex";

export type ThreadCacheMetadata = {
  loadedAtMs: number;
  loadedIndexUpdatedAt?: string;
  loadedSessionPath?: string;
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
  hydratingThreadIds: string[];
};
