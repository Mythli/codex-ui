import type { CodexThreadIndexState } from "@taylordb/codex";
import type {
  CoderChatItem,
  CoderProjectChatGroup
} from "../../../../coderui/features/CoderCore/types";

export function groupChatsByProject(
  threadIndex: CodexThreadIndexState,
  unreadThreadIds: readonly string[] = []
): CoderProjectChatGroup[] {
  const unreadSet = new Set(unreadThreadIds);
  const knownProjectGroups = threadIndex.projectOrder.flatMap((cwd) => {
    const project = threadIndex.projectsByCwd[cwd];
    if (!project) {
      return [];
    }
    return [{
      id: project.cwd,
      name: project.name,
      chats: project.threadIds.flatMap((threadId) => {
        const thread = threadIndex.threadsById[threadId];
          return thread ? [chatItemFromThread(thread, unreadSet.has(threadId))] : [];
      })
    }];
  });

  const groupedThreadIds = new Set(knownProjectGroups.flatMap((group) => group.chats.map((chat) => chat.id)));
  const uncategorizedChats = threadIndex.threadOrder
    .filter((threadId) => !groupedThreadIds.has(threadId))
    .flatMap((threadId) => {
      const thread = threadIndex.threadsById[threadId];
      return thread ? [chatItemFromThread(thread, unreadSet.has(threadId))] : [];
    });

  return [
    ...knownProjectGroups.filter((group) => group.chats.length > 0),
    ...(uncategorizedChats.length > 0
      ? [{ id: "uncategorized", name: "Other chats", chats: uncategorizedChats }]
      : [])
  ];
}

function chatItemFromThread(
  thread: CodexThreadIndexState["threadsById"][string],
  unread: boolean
): CoderChatItem {
  return {
    id: thread.threadId,
    title: thread.title,
    updatedLabel: formatUpdatedLabel(thread.updatedAt),
    activity: thread.activity,
    unread,
    additions: undefined,
    deletions: undefined
  };
}

function formatUpdatedLabel(value?: string) {
  if (!value) {
    return undefined;
  }

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return undefined;
  }

  const diffMs = Date.now() - timestamp;
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (minutes < 1) {
    return "now";
  }
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
