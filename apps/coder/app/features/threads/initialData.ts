import type {
  CoderInitialSelection,
  CodexThreadIndexState
} from "@coder/types";

export function resolveInitialSelection(
  threadIndex: CodexThreadIndexState,
  chatId?: string
): CoderInitialSelection | undefined {
  if (chatId) {
    return {
      chatId,
      projectId: projectIdForThread(threadIndex, chatId) ?? "uncategorized"
    };
  }

  const firstChatId = threadIndex.threadOrder[0];
  if (!firstChatId) {
    return undefined;
  }

  return {
    chatId: firstChatId,
    projectId: projectIdForThread(threadIndex, firstChatId) ?? "uncategorized"
  };
}

function projectIdForThread(threadIndex: CodexThreadIndexState, threadId: string): string | undefined {
  for (const cwd of threadIndex.projectOrder) {
    const project = threadIndex.projectsByCwd[cwd];
    if (project?.threadIds.includes(threadId)) {
      return project.cwd;
    }
  }
  return threadIndex.threadsById[threadId] ? "uncategorized" : undefined;
}
