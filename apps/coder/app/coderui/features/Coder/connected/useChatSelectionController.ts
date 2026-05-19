import { useCallback, useEffect, useRef } from "react";
import type { CodexThreadIndexState } from "@taylordb/codex";
import type { CoderProjectChatGroup, CoderSelection } from "../../CoderCore/types";
import { shouldAutoSelectFirstChat } from "../../../../features/Coder/store/selectors/hydrationGuards";

export type ChatSelectionControllerInput = {
  routeChatId?: string;
  chatGroups: CoderProjectChatGroup[];
  isRunning: boolean;
  selection: CoderSelection;
  threadIndexStatus: CodexThreadIndexState["status"];
  newChat: (projectId?: string) => void;
  onNewChatRoute?: () => void;
  onSelectChatRoute?: (chatId: string) => void;
  selectChat: (chatId: string, projectId: string) => void;
  submitPrompt: () => Promise<{ createdThreadId?: string } | undefined>;
};

export type ChatSelectionController = {
  createDraftChat: (projectId?: string) => void;
  selectRoutedChat: (chatId: string, projectId: string) => void;
  submitPromptFromSelection: () => void;
};

export function useChatSelectionController({
  routeChatId,
  chatGroups,
  isRunning,
  selection,
  threadIndexStatus,
  newChat,
  onNewChatRoute,
  onSelectChatRoute,
  selectChat,
  submitPrompt
}: ChatSelectionControllerInput): ChatSelectionController {
  const appliedRouteChatIdRef = useRef<string | undefined>(undefined);
  const pendingRouteChatIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const firstChatGroup = chatGroups.find((group) => group.chats.length > 0);
    const firstChatId = firstChatGroup?.chats[0]?.id;
    const firstChatProjectId = firstChatGroup?.id;
    const selectedThreadId = selection.kind === "thread" ? selection.threadId : undefined;

    if (!routeChatId) {
      appliedRouteChatIdRef.current = undefined;
      if (shouldAutoSelectFirstChat({
        activeChatId: selectedThreadId,
        firstChatId,
        firstChatProjectId,
        isDraftChat: selection.kind === "draft",
        isRunning
      }) && firstChatId && firstChatProjectId) {
        selectChat(firstChatId, firstChatProjectId);
      }
      return;
    }

    const isRouteChatSelected = selection.kind === "thread" &&
      routeChatId === selection.threadId;

    if (routeChatId && pendingRouteChatIdRef.current === routeChatId) {
      pendingRouteChatIdRef.current = undefined;
    }

    const isStaleDraftRoute = selection.kind === "draft" &&
      routeChatId === appliedRouteChatIdRef.current;
    if (isStaleDraftRoute) {
      return;
    }

    if (appliedRouteChatIdRef.current === routeChatId && isRouteChatSelected) {
      return;
    }

    if (isRouteChatSelected) {
      appliedRouteChatIdRef.current = routeChatId;
      return;
    }

    const isAwaitingRouteAfterLocalSelection = selection.kind === "thread" &&
      selection.threadId === pendingRouteChatIdRef.current;
    if (isAwaitingRouteAfterLocalSelection) {
      return;
    }

    const group = chatGroups.find((candidate) => candidate.chats.some((chat) => chat.id === routeChatId));
    if (!group) {
      if (threadIndexStatus === "idle" || threadIndexStatus === "loading") {
        return;
      }
      selectChat(routeChatId, "uncategorized");
      appliedRouteChatIdRef.current = routeChatId;
      return;
    }

    selectChat(routeChatId, group.id);
    appliedRouteChatIdRef.current = routeChatId;
  }, [chatGroups, isRunning, routeChatId, selectChat, selection, threadIndexStatus]);

  const createDraftChat = useCallback((projectId?: string) => {
    pendingRouteChatIdRef.current = undefined;
    newChat(projectId);
    onNewChatRoute?.();
  }, [newChat, onNewChatRoute]);

  const selectRoutedChat = useCallback((chatId: string, projectId: string) => {
    if (onSelectChatRoute) {
      pendingRouteChatIdRef.current = chatId;
    }
    selectChat(chatId, projectId);
    onSelectChatRoute?.(chatId);
  }, [onSelectChatRoute, selectChat]);

  const submitPromptFromSelection = useCallback(() => {
    void submitPrompt().then((result) => {
      if (result?.createdThreadId) {
        pendingRouteChatIdRef.current = result.createdThreadId;
        onSelectChatRoute?.(result.createdThreadId);
      }
    });
  }, [onSelectChatRoute, submitPrompt]);

  return {
    createDraftChat,
    selectRoutedChat,
    submitPromptFromSelection
  };
}
