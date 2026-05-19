import type { CodexThreadIndexState, CodexThreadState } from "@taylordb/codex";
import type { CoderReasoningEffort } from "../../../../coderui/features/CoderCore/types";
import type { CoderRuntimeConfig, CoderRuntimeModel } from "../types";

export type CoderInitialSelection = {
  chatId: string;
  projectId: string;
};

export type CoderInitialData = {
  defaultCwd?: string;
  generatedAtMs?: number;
  config?: CoderRuntimeConfig;
  models?: CoderRuntimeModel[];
  selection?: CoderInitialSelection;
  thread?: CodexThreadState;
  threadIndex: CodexThreadIndexState;
};

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

export function normalizeInitialReasoningEffort(value?: string | null): CoderReasoningEffort | undefined {
  return value === "none" ||
    value === "minimal" ||
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "xhigh"
    ? value
    : undefined;
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
