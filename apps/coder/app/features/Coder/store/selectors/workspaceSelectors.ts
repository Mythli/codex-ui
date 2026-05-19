import { createSelector } from "@reduxjs/toolkit";
import type { ChatPaneState, CoderChatItem, CoderProjectItem } from "../../../../coderui/features/CoderCore/types";
import { DEFAULT_CODEX_CWD } from "../../adapters/codexTransport";
import type { RootState } from "../index";
import { selectChatGroups, selectHydratingThreadIds } from "./chatListSelectors";
import { selectActiveThread, selectSelection } from "./threadSelectors";

export const selectActiveChat = createSelector(
  [selectChatGroups, selectSelection],
  (chatGroups, selection): CoderChatItem | undefined =>
    selection.kind === "thread"
      ? chatGroups.flatMap((group) => group.chats).find((chat) => chat.id === selection.threadId)
      : undefined
);

export const selectCurrentProject = createSelector(
  [selectChatGroups, selectActiveChat, selectSelection],
  (chatGroups, activeChat, selection): CoderProjectItem => {
    const selectedProjectId = selection.kind === "none" ? undefined : selection.projectId;
    const activeGroup = chatGroups.find((group) =>
      selectedProjectId
        ? group.id === selectedProjectId
        : group.chats.some((chat) => chat.id === activeChat?.id)
    );
    return activeGroup
      ? { id: activeGroup.id, name: activeGroup.name }
      : fallbackProject(DEFAULT_CODEX_CWD);
  }
);

export const selectChatPane = createSelector(
  [
    selectSelection,
    selectActiveChat,
    selectActiveThread,
    selectHydratingThreadIds,
    (state: RootState) => state.threadIndex.error
  ],
  (selection, activeChat, activeThread, hydratingThreadIds, threadIndexError): ChatPaneState => {
    if (threadIndexError) {
      return {
        kind: "error",
        chatId: selection.kind === "thread" ? selection.threadId : undefined,
        message: threadIndexError
      };
    }
    if (selection.kind === "draft") {
      if (activeThread?.isProvisionalThread && activeThread.renderBlocks.length > 0) {
        return { kind: "ready", chatId: selection.draftId, blocks: activeThread.renderBlocks };
      }
      if (activeThread?.isProvisionalThread && activeThread.status === "loading") {
        return { kind: "loading", chatId: selection.draftId };
      }
      return { kind: "home" };
    }
    if (selection.kind === "none") {
      return { kind: "home" };
    }
    const threadId = selection.threadId;
    if (hydratingThreadIds.includes(threadId) && (!activeThread || activeThread.renderBlocks.length === 0)) {
      return { kind: "loading", chatId: threadId, title: activeChat?.title };
    }
    if (!activeThread) {
      return { kind: "loading", chatId: threadId, title: activeChat?.title };
    }
    if (activeThread.status === "failed") {
      return {
        kind: "error",
        chatId: threadId,
        message: activeThread.error ?? "Failed to load chat."
      };
    }
    if (activeThread.status === "loading" && activeThread.renderBlocks.length === 0) {
      return { kind: "loading", chatId: threadId, title: activeChat?.title };
    }
    if (activeThread.renderBlocks.length > 0) {
      return { kind: "ready", chatId: threadId, blocks: activeThread.renderBlocks };
    }
    return { kind: "empty", chatId: threadId, title: activeChat?.title };
  }
);

function fallbackProject(cwd: string): CoderProjectItem {
  return {
    id: cwd,
    name: cwd.split("/").filter(Boolean).at(-1) ?? cwd
  };
}
