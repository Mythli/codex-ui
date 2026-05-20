import { useCallback, useEffect, useRef } from "react";
import type { CodexThreadIndexState } from "@taylordb/codex";
import type { CoderSelection } from "../types";
import { shouldAutoSelectFirstChat } from "../../conversation/state/hydrationGuards";

type ChatSelectionControllerInput = {
  routeChatId?: string;
  threadIndex: CodexThreadIndexState;
  isRunning: boolean;
  selection: CoderSelection;
  threadIndexStatus: CodexThreadIndexState["status"];
  newChat: (projectId?: string) => void;
  onNewChatRoute?: () => void;
  onSelectChatRoute?: (chatId: string) => void;
  selectChat: (chatId: string, projectId: string) => void;
  submitPrompt: () => Promise<{ createdThreadId?: string } | undefined>;
};

type ChatSelectionController = {
  createDraftChat: (projectId?: string) => void;
  selectRoutedChat: (chatId: string, projectId: string) => void;
  submitPromptFromSelection: () => void;
};

export function useChatSelectionController({
  routeChatId,
  threadIndex,
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
    const firstChatId = threadIndex.threadOrder[0];
    const firstChatProjectId = firstChatId ? projectIdForThread(threadIndex, firstChatId) : undefined;
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

    const routeProjectId = projectIdForThread(threadIndex, routeChatId);
    if (!routeProjectId) {
      if (threadIndexStatus === "idle" || threadIndexStatus === "loading") {
        return;
      }
      selectChat(routeChatId, "uncategorized");
      appliedRouteChatIdRef.current = routeChatId;
      return;
    }

    selectChat(routeChatId, routeProjectId);
    appliedRouteChatIdRef.current = routeChatId;
  }, [isRunning, routeChatId, selectChat, selection, threadIndex, threadIndexStatus]);

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

function projectIdForThread(threadIndex: CodexThreadIndexState, threadId: string): string | undefined {
  for (const projectId of threadIndex.projectOrder) {
    if (threadIndex.projectsByCwd[projectId]?.threadIds.includes(threadId)) {
      return projectId;
    }
  }
  return threadIndex.threadsById[threadId] ? "uncategorized" : undefined;
}
