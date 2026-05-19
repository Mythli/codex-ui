import { joinParts, plural, sentenceCase } from "./diff.js";
import type {
  CodexActivitySummaryEntry,
  CodexAssistantTextSegment,
  CodexAssistantTurnBlock,
  CodexAssistantTurnSegment,
  CodexCommandEntry,
  CodexCurrentActivity,
  CodexFileChangeEntry,
  CodexRenderBlock,
  CodexToolDisplayEntry,
  CodexTranscript,
  CodexTranscriptState,
  CodexTranscriptCommandAction,
  CodexTranscriptFile,
  CodexTranscriptItem,
  CodexTranscriptTurn,
  CodexToolEntry,
  CodexUnsupportedWorkEntry,
  CodexWorkSegment,
  CodexWorkEntry
} from "../model.js";

export function buildCodexRenderBlocks(input: CodexTranscript | CodexTranscriptState | undefined): CodexRenderBlock[] {
  if (!input) {
    return [];
  }
  const transcript = "turnOrder" in input ? selectTranscriptFromState(input) : input;
  return transcript.turns.flatMap((turn) => renderBlocksForTurn(turn, transcript.cwd));
}

function selectTranscriptFromState(state: CodexTranscriptState): CodexTranscript {
  return {
    threadId: state.threadId,
    title: state.title,
    cwd: state.cwd,
    turns: state.turnOrder.flatMap((turnId) => {
      const turn = state.turnsById[turnId];
      if (!turn) {
        return [];
      }
      return [{
        id: turn.id,
        status: turn.status,
        source: turn.source,
        startedAtMs: turn.startedAtMs,
        completedAtMs: turn.completedAtMs,
        durationMs: turn.durationMs,
        filesChanged: turn.filesChanged,
        items: turn.itemOrder.flatMap((itemId) => turn.itemsById[itemId] ? [turn.itemsById[itemId]!] : [])
      }];
    })
  };
}

function renderBlocksForTurn(turn: CodexTranscriptTurn, cwd?: string): CodexRenderBlock[] {
  const blocks: CodexRenderBlock[] = [];
  const segments: CodexAssistantTurnSegment[] = [];
  const finalTextSegments: CodexAssistantTextSegment[] = [];
  let pendingWorkEntries: CodexWorkEntry[] = [];

  const flushWorkSegment = () => {
    if (pendingWorkEntries.length === 0) {
      return;
    }
    const entries = groupActivitySummaryEntries(pendingWorkEntries, `${turn.id}:work:${segments.length}`);
    const segment: CodexWorkSegment = {
      type: "work",
      id: `${turn.id}:work:${segments.length}`,
      status: turn.status,
      durationMs: turn.durationMs,
      startedAtMs: turn.startedAtMs,
      completedAtMs: turn.completedAtMs,
      currentActivity: currentActivityForTurn(turn, entries),
      headline: workHeadline(turn, entries),
      entries
    };
    segments.push(segment);
    pendingWorkEntries = [];
  };

  const pushTextSegment = (item: CodexTranscriptItem, final: boolean) => {
    if (!item.text) {
      return;
    }
    const segment: CodexAssistantTextSegment = {
      type: "assistantText",
      id: item.id,
      text: item.text,
      final
    };
    if (final) {
      finalTextSegments.push(segment);
    } else {
      pendingWorkEntries.push({ type: "assistantProgress", id: item.id, text: item.text });
    }
  };

  for (const item of turn.items) {
    if (item.type === "userMessage") {
      blocks.push({
        type: "userMessage",
        id: renderBlockId(turn.id, item.id),
        turnId: turn.id,
        cwd,
        text: item.text ?? "",
        images: item.images ?? []
      });
      continue;
    }

    if (item.type === "agentMessage") {
      if (item.isFinal) {
        pushTextSegment(item, true);
      } else if (item.text) {
        pushTextSegment(item, false);
      }
      continue;
    }

    if (item.type === "imageView") {
      pendingWorkEntries.push(workEntryFromToolDisplay(toolDisplayForTranscriptItem(item)));
      continue;
    }

    if (item.type === "imageGeneration") {
      pendingWorkEntries.push(workEntryFromToolDisplay(toolDisplayForTranscriptItem(item)));
      blocks.push({
        type: "image",
        id: renderBlockId(turn.id, item.id),
        turnId: turn.id,
        cwd,
        images: item.images ?? []
      });
      continue;
    }

    if (item.type === "reasoning" || item.type === "plan") {
      pendingWorkEntries.push({ type: "reasoning", id: item.id, text: item.text });
      continue;
    }

    if (item.type === "fileChange" && (!item.files || item.files.length === 0) && turn.filesChanged?.files.length) {
      pendingWorkEntries.push({
        ...turn.filesChanged,
        id: item.id,
        defaultExpanded: false,
        status: item.status ?? turn.filesChanged.status
      });
      continue;
    }

    pendingWorkEntries.push(workEntryFromToolDisplay(toolDisplayForTranscriptItem(item)));
  }
  flushWorkSegment();

  if (
    turn.status === "running" &&
    segments.length === 0 &&
    finalTextSegments.length === 0 &&
    hasTurnTimingMetadata(turn) &&
    hasUserMessageBlock(blocks)
  ) {
    const segment: CodexWorkSegment = {
      type: "work",
      id: `${turn.id}:work:0`,
      status: turn.status,
      durationMs: turn.durationMs,
      startedAtMs: turn.startedAtMs,
      completedAtMs: turn.completedAtMs,
      currentActivity: currentActivityForTurn(turn, []),
      headline: workHeadline(turn, []),
      entries: []
    };
    segments.push(segment);
  }
  segments.push(...finalTextSegments);

  if (hasAssistantTurnMetadata(turn, segments)) {
    const firstNonUserIndex = blocks.findIndex((block) => block.type !== "userMessage");
    const assistantTurn: CodexAssistantTurnBlock = {
      type: "assistantTurn",
      id: `${turn.id}:assistant`,
      turnId: turn.id,
      cwd,
      status: turn.status,
      source: turn.source,
      durationMs: turn.durationMs,
      startedAtMs: turn.startedAtMs,
      completedAtMs: turn.completedAtMs,
      segments,
      artifacts: {
        filesChanged: turn.status === "completed" ? turn.filesChanged ?? aggregateFileChangeArtifact(turn) : undefined
      }
    };
    if (firstNonUserIndex === -1) {
      blocks.push(assistantTurn);
    } else {
      blocks.splice(firstNonUserIndex, 0, assistantTurn);
    }
  }

  return blocks;
}

function renderBlockId(turnId: string, itemId: string): string {
  return `${turnId}:${itemId}`;
}

function toolDisplayForTranscriptItem(item: CodexTranscriptItem): CodexToolDisplayEntry {
  switch (item.type) {
    case "commandExecution": {
      const actions = item.commandActions ?? [];
      return {
        kind: "command",
        id: item.id,
        title: commandTitle(item.command),
        details: commandActionDetails(actions),
        status: item.status,
        icon: "command",
        commandActions: actions,
        command: item.command,
        cwd: item.cwd,
        output: item.output,
        exitCode: item.exitCode,
        result: actions.length > 0 ? actions : undefined,
        payload: item.payload
      };
    }
    case "fileChange":
      return {
        kind: "fileChange",
        id: item.id,
        title: item.files?.length ? fileChangeTitle(item.files) : item.title ?? "File change",
        status: item.status,
        icon: "file",
        files: item.files ?? [],
        payload: item.payload
      };
    case "mcpToolCall":
      return {
        kind: "mcpTool",
        id: item.id,
        title: item.toolName ?? item.title ?? "MCP tool call",
        status: item.status,
        icon: "mcp",
        arguments: item.arguments,
        result: item.result,
        error: item.error,
        payload: item.payload
      };
    case "dynamicToolCall":
      if (isImageInspectionTool(item.toolName)) {
        return {
          kind: "image",
          id: item.id,
          title: "Image",
          details: item.text,
          status: item.status,
          icon: "image",
          arguments: item.arguments,
          result: item.result,
          payload: item.payload
        };
      }
      return {
        kind: "dynamicTool",
        id: item.id,
        title: item.toolName ?? item.title ?? "Dynamic tool call",
        status: item.status,
        icon: "other",
        arguments: item.arguments,
        result: item.result,
        error: item.error,
        payload: item.payload
      };
    case "collabAgentToolCall":
      return {
        kind: "collabAgent",
        id: item.id,
        title: item.toolName ?? item.title ?? "Agent tool call",
        details: item.text,
        status: item.status,
        icon: "agent",
        result: item.result,
        payload: item.payload
      };
    case "webSearch":
      return {
        kind: "webSearch",
        id: item.id,
        title: item.title ?? "Web search",
        details: item.text,
        status: item.status,
        icon: "web",
        result: item.result,
        payload: item.payload
      };
    case "imageView":
    case "imageGeneration":
      return {
        kind: "image",
        id: item.id,
        title: item.title ?? "Image",
        details: item.text,
        status: item.status,
        icon: "image",
        images: item.images ?? [],
        payload: item.payload
      };
    default:
      return {
        kind: "unsupported",
        id: item.id,
        title: item.title ?? item.type,
        details: item.text,
        status: item.status,
        icon: "other",
        payload: item.payload
      };
  }
}

function workEntryFromToolDisplay(display: CodexToolDisplayEntry): CodexWorkEntry {
  if (display.kind === "command") {
    return {
      type: "command",
      id: display.id,
      title: display.title,
      defaultExpanded: false,
      commandActions: display.commandActions,
      command: display.command,
      cwd: display.cwd,
      output: display.output,
      exitCode: display.exitCode,
      status: display.status
    };
  }

  if (display.kind === "fileChange") {
    const files = display.files ?? [];
    return {
      type: "fileChange",
      id: display.id,
      title: display.title,
      defaultExpanded: false,
      status: display.status,
      additions: files.reduce((sum, file) => sum + (file.additions ?? 0), 0),
      deletions: files.reduce((sum, file) => sum + (file.deletions ?? 0), 0),
      files
    };
  }

  if (display.kind !== "unsupported") {
    return {
      type: "tool",
      id: display.id,
      icon: display.icon === "mcp" ? "mcp" : display.icon === "browser" || display.icon === "image" ? "browser" : display.icon === "web" ? "web" : "other",
      title: display.title,
      defaultExpanded: false,
      status: display.status,
      arguments: display.arguments,
      result: display.result,
      error: display.error,
      images: display.images
    };
  }

  return {
    type: "unsupported",
    id: display.id,
    title: display.title,
    defaultExpanded: false,
    status: display.status,
    payload: display.payload,
  };
}

function hasAssistantTurnMetadata(turn: CodexTranscriptTurn, segments: readonly CodexAssistantTurnSegment[]): boolean {
  return Boolean(
    segments.length > 0 ||
    turn.filesChanged
  );
}

function hasUserMessageBlock(blocks: readonly CodexRenderBlock[]): boolean {
  return blocks.some((block) => block.type === "userMessage");
}

function hasTurnTimingMetadata(turn: CodexTranscriptTurn): boolean {
  return Boolean(
    turn.status === "running" ||
    turn.durationMs !== undefined ||
    turn.startedAtMs !== undefined ||
    turn.completedAtMs !== undefined
  );
}

function workHeadline(turn: CodexTranscriptTurn, entries: readonly CodexWorkEntry[]): CodexWorkSegment["headline"] {
  const active = turn.status === "running";
  return {
    label: active ? activeWorkLabel(entries) : turn.status === "failed" ? "Failed" : "Worked",
    durationLabel: durationLabel(turn),
    defaultExpanded: false,
    hasEntries: entries.length > 0,
    entryCount: entries.length
  };
}

function currentActivityForTurn(turn: CodexTranscriptTurn, entries: readonly CodexWorkEntry[]): CodexCurrentActivity | undefined {
  if (turn.status !== "running") {
    return undefined;
  }
  const entry = latestActiveEntry(entries) ?? latestActivityEntry(entries);
  return entry ? currentActivityFromEntry(entry) : undefined;
}

function latestActiveEntry(entries: readonly CodexWorkEntry[]): CodexWorkEntry | undefined {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (!entry) {
      continue;
    }
    if (entry.type === "activitySummary") {
      for (let itemIndex = entry.items.length - 1; itemIndex >= 0; itemIndex -= 1) {
        const item = entry.items[itemIndex];
        if (item && isActiveStatus(item.status)) {
          return item;
        }
      }
      if (isActiveStatus(entry.status)) {
        return entry.items.at(-1) ?? entry;
      }
      continue;
    }
    if (isEntryActive(entry)) {
      return entry;
    }
  }
  return undefined;
}

function latestActivityEntry(entries: readonly CodexWorkEntry[]): CodexWorkEntry | undefined {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (!entry) {
      continue;
    }
    if (entry.type === "activitySummary") {
      return entry.items.at(-1) ?? entry;
    }
    return entry;
  }
  return undefined;
}

function activeWorkLabel(entries: readonly CodexWorkEntry[]): string {
  return entries.length > 0 ? "Working" : "Thinking";
}

function currentActivityFromEntry(entry: CodexWorkEntry): CodexCurrentActivity | undefined {
  if (entry.type === "command") {
    const command = entry.command ? compactCommand(entry.command) : undefined;
    return {
      id: entry.id,
      type: "command",
      title: command ? `Running ${commandTitleText(command)}` : "Running command",
      description: commandActionDetails(entry.commandActions ?? []),
      command,
      status: entry.status,
      icon: "command"
    };
  }
  if (entry.type === "fileChange") {
    return {
      id: entry.id,
      type: "fileChange",
      title: `Editing ${plural(entry.files.length || 1, "file")}`,
      status: entry.status,
      icon: "file"
    };
  }
  if (entry.type === "tool") {
    return {
      id: entry.id,
      type: "tool",
      title: activeToolTitle(entry),
      status: entry.status,
      icon: entry.icon
    };
  }
  if (entry.type === "reasoning") {
    return {
      id: entry.id,
      type: "reasoning",
      title: "Thinking",
      description: entry.text,
      icon: "other"
    };
  }
  if (entry.type === "assistantProgress") {
    return {
      id: entry.id,
      type: "assistantProgress",
      title: "Writing update",
      description: entry.text,
      icon: "other"
    };
  }
  if (entry.type === "unsupported") {
    return {
      id: entry.id,
      type: "unsupported",
      title: entry.title,
      status: entry.status,
      icon: "other"
    };
  }
  return undefined;
}

function activeToolTitle(entry: CodexToolEntry): string {
  if (entry.icon === "web") {
    return "Searching";
  }
  return entry.title;
}

function commandTitleText(command: string): string {
  if (/^ls(?:\s|$)/.test(command.trim())) {
    return "files";
  }
  return command;
}

function isActiveStatus(status: string | undefined): boolean {
  return status === "inProgress" || status === "running";
}

function isEntryActive(entry: CodexWorkEntry): boolean {
  return "status" in entry && isActiveStatus(entry.status);
}

function compactCommand(command: string): string {
  return command.replace(/^\/bin\/(?:zsh|bash) -lc '(.+)'$/, "$1");
}

function commandTitle(command: string | undefined): string {
  if (!command) {
    return "Ran command";
  }
  const compact = compactCommand(command);
  if (/^ls(?:\s|$)/.test(compact.trim())) {
    return "Listed files";
  }
  return `Ran ${compact}`;
}

function groupActivitySummaryEntries(entries: CodexWorkEntry[], turnId: string): CodexWorkEntry[] {
  const grouped: CodexWorkEntry[] = [];
  let pending: {
    key: string;
    label: string;
    icon: CodexActivitySummaryEntry["icon"];
    items: Array<CodexCommandEntry | CodexFileChangeEntry | CodexToolEntry | CodexUnsupportedWorkEntry>;
  } | undefined;

  const flush = () => {
    if (!pending) {
      return;
    }
    const firstItem = pending.items[0]!;
    grouped.push({
      type: "activitySummary",
      id: `${turnId}:activity:${pending.key}:${firstItem.id}`,
      icon: pending.icon,
      label: activitySummaryLabel(pending.label, pending.items),
      defaultExpanded: false,
      status: aggregateActivityStatus(pending.items),
      itemIds: pending.items.map((item) => item.id),
      items: pending.items
    });
    pending = undefined;
  };

  for (const entry of entries) {
    const group = activityGroupForEntry(entry);
    if (!group) {
      flush();
      grouped.push(entry);
      continue;
    }
    if (!pending || pending.key !== group.key) {
      flush();
      pending = { ...group, items: [] };
    }
    if (isActivitySummaryItem(entry)) {
      pending.items.push(entry);
    }
  }
  flush();

  return grouped;
}

function activityGroupForEntry(entry: CodexWorkEntry): { key: string; label: string; icon: CodexActivitySummaryEntry["icon"] } | undefined {
  if (entry.type === "fileChange") {
    return { key: "workspace:local", label: entry.title, icon: "file" };
  }

  if (entry.type === "command") {
    return { key: "workspace:local", label: "Ran command", icon: "command" };
  }

  if (entry.type === "tool") {
    if (entry.icon === "web") {
      return { key: "web", label: "Searched web", icon: "web" };
    }
    if (entry.title.toLowerCase().includes("openaideveloperdocs")) {
      return { key: "openai-developer-docs", label: "Read OpenAI docs", icon: "mcp" };
    }
    if (entry.icon === "browser") {
      return { key: `browser:${entry.title}`, label: entry.title, icon: "browser" };
    }
    if (entry.icon === "mcp") {
      const provider = entry.title.split(" / ")[0]?.trim() || "MCP";
      return { key: `mcp:${provider}`, label: `Called ${compactProviderLabel(provider)}`, icon: "mcp" };
    }
    const provider = entry.title.split(" / ")[0]?.trim() || "Tool";
    return { key: `tool:${provider}`, label: `Called ${compactProviderLabel(provider)}`, icon: "other" };
  }

  if (entry.type === "unsupported") {
    return { key: `unsupported:${entry.title}`, label: `Called ${compactProviderLabel(entry.title)}`, icon: "other" };
  }

  return undefined;
}

function activitySummaryLabel(
  fallback: string,
  items: readonly (CodexCommandEntry | CodexFileChangeEntry | CodexToolEntry | CodexUnsupportedWorkEntry)[]
): string {
  const fileChanges = items.filter((item): item is CodexFileChangeEntry => item.type === "fileChange");
  const commands = items.filter((item): item is CodexCommandEntry => item.type === "command");
  const listCommands = commands.filter(isListCommand);
  const shellCommands = commands.filter((command) => !isListCommand(command));
  if (fileChanges.length > 0) {
    const fileCount = fileChanges.reduce((sum, entry) => sum + Math.max(1, entry.files.length), 0);
    const fileVerb = fileChangeGroupVerb(fileChanges);
    const parts = [
      `${fileVerb} ${plural(fileCount, "file")}`,
      shellCommands.length > 0 ? `ran ${plural(shellCommands.length, "command")}` : undefined,
      listCommands.length > 0 ? listCommandPhrase(listCommands.length).toLowerCase() : undefined
    ].filter((part): part is string => Boolean(part));
    return joinParts(parts);
  }
  if (listCommands.length > 0 && shellCommands.length > 0 && listCommands.length + shellCommands.length === items.length) {
    return joinParts([
      listCommandPhrase(listCommands.length),
      `ran ${plural(shellCommands.length, "command")}`
    ]);
  }
  if (listCommands.length > 0 && listCommands.length === items.length) {
    return listCommandPhrase(listCommands.length);
  }
  if (commands.length === items.length && commands.length > 0) {
    return `Ran ${plural(commands.length, "command")}`;
  }
  return fallback;
}

function isActivitySummaryItem(entry: CodexWorkEntry): entry is CodexCommandEntry | CodexFileChangeEntry | CodexToolEntry | CodexUnsupportedWorkEntry {
  return entry.type === "command" || entry.type === "fileChange" || entry.type === "tool" || entry.type === "unsupported";
}

function aggregateActivityStatus(entries: readonly (CodexCommandEntry | CodexFileChangeEntry | CodexToolEntry | CodexUnsupportedWorkEntry)[]): string | undefined {
  if (entries.some((entry) => entry.status === "failed")) {
    return "failed";
  }
  if (entries.some((entry) => entry.status === "inProgress" || entry.status === "running")) {
    return "inProgress";
  }
  if (entries.some((entry) => entry.status === "declined")) {
    return "declined";
  }
  return entries.find((entry) => entry.status)?.status;
}

function isListCommand(entry: CodexCommandEntry): boolean {
  const normalized = compactCommand(entry.command ?? entry.title).trim();
  return /^ls(?:\s|$)/.test(normalized) ||
    /^find\s+.+\s+-maxdepth\s+1\b/.test(normalized) ||
    entry.commandActions?.some((action) => action.type === "list" || action.type === "listFiles") === true;
}

function fileChangeGroupVerb(entries: readonly CodexFileChangeEntry[]): string {
  const actions = new Set(entries.flatMap((entry) => entry.files.map((file) => file.action).filter(Boolean)));
  if (actions.size === 1 && actions.has("added")) {
    return "Created";
  }
  if (actions.size === 1 && actions.has("deleted")) {
    return "Deleted";
  }
  return "Edited";
}

function listCommandPhrase(count: number): string {
  return count === 1 ? "Listed files" : `Listed ${plural(count, "file group")}`;
}

function compactProviderLabel(provider: string): string {
  return provider
    .replace(/^mcp__/, "")
    .replace(/__$/, "")
    .replace(/[_\s-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join("");
}

function fileChangeTitle(files: readonly CodexTranscriptFile[]): string {
  const actions = new Set(files.map((file) => file.action).filter(Boolean));
  if (actions.size === 1 && actions.has("added")) {
    return `Created ${plural(files.length, "file")}`;
  }
  if (actions.size === 1 && actions.has("deleted")) {
    return `Deleted ${plural(files.length, "file")}`;
  }
  return `Edited ${plural(files.length, "file")}`;
}

function aggregateFileChangeArtifact(turn: CodexTranscriptTurn): CodexFileChangeEntry | undefined {
  const fileChangeEntries = turn.items
    .filter((item) => item.type === "fileChange" && item.files?.length)
    .map((item) => workEntryFromToolDisplay(toolDisplayForTranscriptItem(item)))
    .filter((entry): entry is CodexFileChangeEntry => entry.type === "fileChange" && entry.files.length > 0);
  if (fileChangeEntries.length === 0) {
    return undefined;
  }

  const filesByPath = new Map<string, CodexTranscriptFile>();
  for (const entry of fileChangeEntries) {
    for (const file of entry.files) {
      const existing = filesByPath.get(file.path);
      filesByPath.set(file.path, {
        ...file,
        additions: (existing?.additions ?? 0) + (file.additions ?? 0),
        deletions: (existing?.deletions ?? 0) + (file.deletions ?? 0),
        diff: file.diff ?? existing?.diff,
        asset: file.asset ?? existing?.asset
      });
    }
  }

  const files = [...filesByPath.values()].sort((a, b) => a.path.localeCompare(b.path));
  return {
    type: "fileChange",
    id: `${turn.id}:files-changed`,
    title: `Edited ${plural(files.length, "file")}`,
    defaultExpanded: false,
    status: aggregateFileChangeStatus(fileChangeEntries),
    additions: files.reduce((sum, file) => sum + (file.additions ?? 0), 0),
    deletions: files.reduce((sum, file) => sum + (file.deletions ?? 0), 0),
    files
  };
}

function aggregateFileChangeStatus(entries: CodexFileChangeEntry[]): string | undefined {
  if (entries.some((entry) => entry.status === "failed")) {
    return "failed";
  }
  if (entries.some((entry) => entry.status === "inProgress")) {
    return "inProgress";
  }
  return entries.find((entry) => entry.status)?.status;
}

function durationLabel(turn: CodexTranscriptTurn): string | undefined {
  const durationMs = turn.durationMs ?? (
    turn.startedAtMs !== undefined && turn.completedAtMs !== undefined
      ? Math.max(0, turn.completedAtMs - turn.startedAtMs)
      : undefined
  );
  if (durationMs === undefined) {
    return undefined;
  }
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  const totalSeconds = Math.round(durationMs / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

function commandActionDetails(actions: readonly CodexTranscriptCommandAction[]): string | undefined {
  if (actions.length === 0) {
    return undefined;
  }

  const labels = actions.map((action) => {
    const type = action.type;
    if (type === "read") {
      return `read ${action.path ?? action.name ?? "file"}`;
    }
    if (type === "list" || type === "listFiles") {
      return `list ${action.path ?? "files"}`;
    }
    if (type === "search") {
      return `search ${action.query ?? "workspace"}`;
    }
    if (type === "unknown") {
      return "unknown command action";
    }
    return type ?? "unknown command action";
  });

  return joinParts(labels.map(sentenceCase));
}

function isImageInspectionTool(name: string | undefined | null): boolean {
  const normalized = (name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  return normalized === "viewimage" || normalized === "imageview";
}
