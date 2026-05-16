import type {
  ActivityItem,
  ChatMessage,
  CodexMessage,
  CodexTranscript,
  CodexTurn,
  JsonEvent,
  TranscriptNode,
  WorkBlockNode,
  WorkItem
} from "./types";

export function messagesToTranscript(messages: ChatMessage[]): CodexTranscript {
  const transcript: CodexTranscript = [];
  let turn: ChatMessage[] = [];

  const flushTurn = () => {
    if (turn.length === 0) {
      return;
    }
    transcript.push(...messagesToTurnEntries(turn));
    turn = [];
  };

  for (const message of messages) {
    if (message.role === "user") {
      flushTurn();
    }
    turn.push(message);
  }

  flushTurn();
  return transcript;
}

function messagesToTurnEntries(turnMessages: ChatMessage[]): TranscriptNode[] {
  const [first, ...rest] = turnMessages;
  if (!first) {
    return [];
  }

  if (first.role !== "user") {
    return turnMessages.map((message) => ({
      id: message.id,
      type: "message",
      message: chatMessageToCodexMessage(message)
    }));
  }

  const workItems: WorkItem[] = [];
  let workDuration: number | undefined;
  let workStartedAt: number | undefined;
  let workId = `${first.id}-work`;
  const finalAssistantIndex = findLastIndex(rest, (message) => message.role === "assistant");
  const finalAssistant = finalAssistantIndex === -1 ? undefined : rest[finalAssistantIndex];
  const sideMessages: ChatMessage[] = [];

  rest.forEach((message, index) => {
    if (message.role === "activity") {
      if (message.text === "work") {
        workDuration = message.durationMs;
        workStartedAt = message.startedAt;
        workId = message.id;
      }
      for (const activity of message.activities ?? []) {
        workItems.push({
          id: `${message.id}-${activity.id}`,
          type: "toolSummary",
          activity
        });
      }
      return;
    }

    if (message.role === "assistant") {
      if (index !== finalAssistantIndex) {
        workItems.push({
          id: `${message.id}-note`,
          type: "assistantNote",
          text: message.text
        });
      }
      return;
    }

    sideMessages.push(message);
  });

  const hasWork = workDuration !== undefined || workStartedAt !== undefined || workItems.length > 0;
  const turn: CodexTurn = {
    id: first.id,
    type: "turn",
    userMessage: chatMessageToCodexMessage(first),
    workBlock: hasWork
      ? {
          id: workId,
          durationMs: workDuration,
          startedAt: workStartedAt,
          state: "done",
          open: false,
          items: workItems
        }
      : undefined,
    assistantFinal: finalAssistant ? chatMessageToCodexMessage(finalAssistant) : undefined
  };

  return [
    turn,
    ...sideMessages.map((message) => ({
      id: message.id,
      type: "message" as const,
      message: chatMessageToCodexMessage(message)
    }))
  ];
}

function chatMessageToCodexMessage(message: ChatMessage): CodexMessage {
  return {
    id: message.id,
    role: message.role === "activity" ? "system" : message.role,
    text: message.text
  };
}

export function createLiveTurn(prompt: string): CodexTurn {
  return {
    id: crypto.randomUUID(),
    type: "turn",
    userMessage: {
      id: crypto.randomUUID(),
      role: "user",
      text: prompt
    },
    workBlock: {
      id: crypto.randomUUID(),
      startedAt: Date.now(),
      durationMs: 0,
      state: "working",
      open: true,
      items: []
    }
  };
}

export function tickActiveWork(transcript: CodexTranscript, activeWorkId: string): CodexTranscript {
  return updateWorkBlock(transcript, activeWorkId, (work) =>
    work.startedAt ? { ...work, durationMs: Date.now() - work.startedAt } : work
  );
}

export function appendWorkActivity(
  transcript: CodexTranscript,
  activeWorkId: string,
  activity: ActivityItem
): CodexTranscript {
  return updateWorkBlock(transcript, activeWorkId, (work) => {
    const itemId = `tool-${activity.id}`;
    const existingIndex = work.items.findIndex((item) => item.id === itemId);
    const nextItem: WorkItem = { id: itemId, type: "toolSummary", activity };
    const items =
      existingIndex === -1
        ? [...work.items, nextItem]
        : work.items.map((item, index) => (index === existingIndex ? nextItem : item));

    return {
      ...work,
      durationMs: work.startedAt ? Date.now() - work.startedAt : work.durationMs,
      items
    };
  });
}

export function appendAssistantToWork(transcript: CodexTranscript, activeWorkId: string, text: string): CodexTranscript {
  return updateWorkBlock(transcript, activeWorkId, (work) => ({
    ...work,
    durationMs: work.startedAt ? Date.now() - work.startedAt : work.durationMs,
    items: [
      ...work.items,
      {
        id: `note-${crypto.randomUUID()}`,
        type: "assistantNote",
        text
      }
    ]
  }));
}

export function finishActiveWork(transcript: CodexTranscript, activeWorkId: string): CodexTranscript {
  return transcript.map((entry) => {
    if (entry.type !== "turn" || entry.workBlock?.id !== activeWorkId) {
      return entry;
    }

    const work = entry.workBlock;
    const lastAssistantIndex = findLastIndex(work.items, (item) => item.type === "assistantNote");
    const finalAssistant = lastAssistantIndex === -1 ? undefined : work.items[lastAssistantIndex];
    const nextItems = lastAssistantIndex === -1
      ? work.items
      : work.items.filter((_, itemIndex) => itemIndex !== lastAssistantIndex);

    return {
      ...entry,
      workBlock: {
        ...work,
        durationMs: work.startedAt ? Date.now() - work.startedAt : work.durationMs,
        state: "done",
        open: false,
        items: nextItems
      },
      assistantFinal:
        finalAssistant?.type === "assistantNote" && entry.assistantFinal?.text !== finalAssistant.text
          ? {
              id: `final-${crypto.randomUUID()}`,
              role: "assistant",
              text: finalAssistant.text
            }
          : entry.assistantFinal
    };
  });
}

export function setWorkOpen(transcript: CodexTranscript, workId: string, open: boolean): CodexTranscript {
  return updateWorkBlock(transcript, workId, (work) => (work.state === "working" ? work : { ...work, open }));
}

export function eventToActivity(event: JsonEvent): ActivityItem | undefined {
  if (
    (event.method === "item/started" || event.method === "item/updated" || event.method === "item/completed")
    && event.params?.item
  ) {
    return itemToActivity(event.params.item);
  }

  if (event.method === "item/fileChange/patchUpdated") {
    return {
      id: "file-change-updated",
      kind: "file",
      title: "File changes updated"
    };
  }

  if (event.method === "item/mcpToolCall/progress") {
    return {
      id: "mcp-progress",
      kind: "mcp",
      title: "Tool progress"
    };
  }

  return undefined;
}

function itemToActivity(item: NonNullable<NonNullable<JsonEvent["params"]>["item"]>): ActivityItem | undefined {
  if (item.type === "commandExecution") {
    return {
      id: activityId(item, "command"),
      kind: "command",
      title: item.command ?? "Command",
      detail: [item.cwd ? `cwd: ${item.cwd}` : undefined, typeof item.exitCode === "number" ? `exit ${item.exitCode}` : undefined]
        .filter(Boolean)
        .join(" · "),
      status: typeof item.status === "string" ? item.status : undefined,
      output: item.aggregatedOutput ? item.aggregatedOutput.slice(0, 4000) : undefined
    };
  }

  if (item.type === "fileChange") {
    const files = (item.changes ?? []).map((change) => {
      const record = change as { path?: string; diff?: string };
      const stats = diffStat(record.diff ?? "");
      return {
        path: record.path ?? "Unknown file",
        action: "Edited",
        additions: stats.additions,
        deletions: stats.deletions
      };
    });
    const additions = files.reduce((sum, file) => sum + file.additions, 0);
    const deletions = files.reduce((sum, file) => sum + file.deletions, 0);
    return {
      id: activityId(item, "file"),
      kind: "file",
      title: `${files.length} file${files.length === 1 ? "" : "s"} changed`,
      detail: `+${additions} -${deletions}`,
      status: typeof item.status === "string" ? item.status : undefined,
      files
    };
  }

  if (item.type === "mcpToolCall") {
    if (isBrowserToolCall(item)) {
      return {
        id: activityId(item, "browser"),
        kind: "browser",
        title: "Used the browser",
        status: typeof item.status === "string" ? item.status : undefined
      };
    }

    return {
      id: activityId(item, "mcp"),
      kind: "mcp",
      title: `${item.server ?? "server"} / ${item.tool ?? "tool"}`,
      status: typeof item.status === "string" ? item.status : undefined
    };
  }

  if (item.type === "dynamicToolCall") {
    return {
      id: activityId(item, "dynamic"),
      kind: "other",
      title: "Dynamic tool call",
      status: typeof item.status === "string" ? item.status : undefined
    };
  }

  if (item.type === "webSearch") {
    return {
      id: activityId(item, "web"),
      kind: "web",
      title: "Web search",
      status: typeof item.status === "string" ? item.status : undefined
    };
  }

  return undefined;
}

function updateWorkBlock(
  transcript: CodexTranscript,
  workId: string,
  updater: (work: WorkBlockNode) => WorkBlockNode
): CodexTranscript {
  return transcript.map((entry) => {
    if (entry.type !== "turn" || entry.workBlock?.id !== workId) {
      return entry;
    }
    return { ...entry, workBlock: updater(entry.workBlock) };
  });
}

function isBrowserToolCall(item: NonNullable<NonNullable<JsonEvent["params"]>["item"]>): boolean {
  const server = String(item.server ?? "").toLowerCase();
  const tool = String(item.tool ?? "").toLowerCase();
  if (server.includes("browser") || tool.includes("browser")) {
    return true;
  }

  const serialized = JSON.stringify({
    arguments: item.arguments,
    result: item.result
  }).toLowerCase();

  return (
    server === "node_repl"
    && tool === "js"
    && ["browser", "playwright", "chromium", "page.", "tab.", "locator", "screenshot", "getbytext", "goto("].some((needle) =>
      serialized.includes(needle)
    )
  );
}

function findLastIndex<T>(values: T[], predicate: (value: T) => boolean): number {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (predicate(values[index])) {
      return index;
    }
  }
  return -1;
}

function activityId(item: NonNullable<NonNullable<JsonEvent["params"]>["item"]>, fallback: string) {
  return typeof (item as { id?: unknown }).id === "string" ? (item as { id: string }).id : `${fallback}-${crypto.randomUUID()}`;
}

function diffStat(diff: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;

  for (const line of diff.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) {
      continue;
    }
    if (line.startsWith("+")) {
      additions += 1;
    } else if (line.startsWith("-")) {
      deletions += 1;
    }
  }

  return { additions, deletions };
}
