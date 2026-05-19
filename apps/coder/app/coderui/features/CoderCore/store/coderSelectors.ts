import type { CodexRuntimeState } from "@taylordb/codex";
import {
  deriveActiveTranscript,
  deriveIsRunning
} from "./derivedState";
import { groupChatsByProject } from "./threadGrouping";
import type { CoderChatItem } from "../types";
import type { CoderStoreState } from "./coderStore";

let cachedThreadIndex: CoderStoreState["threadIndex"] | undefined;
let cachedUnreadThreadIds: CoderStoreState["unreadThreadIds"] | undefined;
let cachedChatGroups: ReturnType<typeof groupChatsByProject> | undefined;

export function selectChatGroups(state: CoderStoreState): ReturnType<typeof groupChatsByProject> {
  if (
    cachedChatGroups &&
    cachedThreadIndex === state.threadIndex &&
    cachedUnreadThreadIds === state.unreadThreadIds
  ) {
    return cachedChatGroups;
  }
  cachedThreadIndex = state.threadIndex;
  cachedUnreadThreadIds = state.unreadThreadIds;
  cachedChatGroups = groupChatsByProject(state.threadIndex, state.unreadThreadIds);
  return cachedChatGroups;
}

export function selectActiveChat(state: CoderStoreState): CoderChatItem | undefined {
  const threadId = state.selection.kind === "thread" ? state.selection.threadId : undefined;
  return threadId
    ? selectChatGroups(state).flatMap((group) => group.chats).find((chat) => chat.id === threadId)
    : undefined;
}

export function selectActiveTranscript(state: CoderStoreState): CodexRuntimeState | undefined {
  return deriveActiveTranscript(state.runtimeState, state.selection);
}

export function selectCurrentProjectId(state: CoderStoreState): string {
  const activeChat = selectActiveChat(state);
  const selectedProjectId = state.selection.kind === "none" ? undefined : state.selection.projectId;
  const activeGroup = selectChatGroups(state).find((group) =>
    selectedProjectId
      ? group.id === selectedProjectId
      : group.chats.some((chat) => chat.id === activeChat?.id)
  );
  return activeGroup?.id ?? state.defaultCwd ?? "workspace";
}

export function selectIsRunning(state: CoderStoreState): boolean {
  return deriveIsRunning(selectActiveTranscript(state));
}

export function selectSelectedThreadId(state: CoderStoreState): string | undefined {
  return state.selection.kind === "thread" ? state.selection.threadId : undefined;
}
