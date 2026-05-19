import type { CodexAssetRef } from "../assets.js";
import type {
  CodexParsedCommandAction,
  CodexParsedThreadItem,
  CodexParsedTurn,
  CodexParsedUserInput
} from "../../../protocol/stream/index.js";
import { diffStat, fileActionLabel } from "./diff.js";
import type {
  CodexTranscriptCommandAction,
  CodexTranscriptFile,
  CodexTranscriptImage,
  CodexTranscriptItem,
  CodexTranscriptItemSource,
  CodexTranscriptProtocolItem,
  CodexTranscriptTurnState,
  CodexTranscriptTurnStatus,
  TranscriptLifecycle
} from "../model.js";

type AssetBearing = { asset?: CodexAssetRef };

export function turnStateFromProtocolTurn(
  protocolTurn: CodexParsedTurn | undefined,
  fallbackId: string,
  source: CodexTranscriptItemSource,
  fallbackStatus: CodexTranscriptTurnStatus,
  protocolItems: readonly CodexTranscriptProtocolItem[] = protocolTurn?.items ?? []
): CodexTranscriptTurnState {
  const items = protocolItems.map((item) => createTranscriptItem(item, source));
  return {
    id: protocolTurn?.id ?? fallbackId,
    status: normalizeTurnStatus(protocolTurn?.status) ?? fallbackStatus,
    source: source === "live" ? "live" : "history",
    startedAtMs: secondsToMs(protocolTurn?.startedAt ?? undefined),
    completedAtMs: secondsToMs(protocolTurn?.completedAt ?? undefined),
    durationMs: protocolTurn?.durationMs ?? undefined,
    itemOrder: items.map((item) => item.id),
    itemsById: Object.fromEntries(items.map((item) => [item.id, item]))
  };
}

export function createTranscriptItem(
  item: CodexParsedThreadItem,
  source: CodexTranscriptItemSource,
  lifecycle: TranscriptLifecycle = {}
): CodexTranscriptItem {
  const base = {
    id: item.id,
    type: item.type,
    protocolItem: item,
    renderKey: `item:${item.id}`,
    source,
    status: protocolItemStatus(item),
    ...lifecycle
  };

  switch (item.type) {
    case "userMessage":
      return {
        ...base,
        role: "user",
        text: userInputText(item.content),
        title: "User message",
        images: userInputImages(item.id, item.content)
      };
    case "agentMessage":
      return {
        ...base,
        role: "assistant",
        text: item.text,
        title: "Assistant message",
        isFinal: isFinalAssistant(item)
      };
    case "plan":
      return { ...base, role: "system", text: item.text, title: "Plan" };
    case "reasoning":
      return { ...base, text: [...item.summary, ...item.content].join("\n"), title: "Reasoning" };
    case "commandExecution":
      return {
        ...base,
        title: "Command",
        command: item.command,
        cwd: item.cwd,
        commandActions: item.commandActions.map(commandAction),
        output: item.aggregatedOutput ?? undefined,
        exitCode: item.exitCode ?? null,
        durationMs: item.durationMs ?? undefined
      };
    case "fileChange":
      return {
        ...base,
        title: "File change",
        files: item.changes.map(fileChange)
      };
    case "mcpToolCall":
      return {
        ...base,
        title: "MCP tool call",
        toolName: `${item.server} / ${item.tool}`,
        toolNamespace: item.server,
        arguments: item.arguments,
        result: item.result,
        error: item.error,
        durationMs: item.durationMs ?? undefined
      };
    case "dynamicToolCall":
      return {
        ...base,
        title: "Dynamic tool call",
        toolName: [item.namespace, item.tool].filter(Boolean).join(" / ") || item.tool,
        toolNamespace: item.namespace,
        arguments: item.arguments,
        result: item.contentItems,
        durationMs: item.durationMs ?? undefined
      };
    case "collabAgentToolCall":
      return {
        ...base,
        title: "Agent tool call",
        toolName: item.tool,
        text: item.prompt ?? undefined,
        result: item.agentsStates
      };
    case "webSearch":
      return { ...base, title: "Web search", text: item.query, result: item.action };
    case "imageView":
      return {
        ...base,
        title: "Image",
        images: [pathImage(item.id, item.path, assetOf(item as typeof item & AssetBearing))]
      };
    case "imageGeneration": {
      const asset = assetOf(item as typeof item & AssetBearing);
      const alt = item.revisedPrompt ?? "Generated image";
      const image: CodexTranscriptImage = asset
        ? { id: item.id, kind: "asset", asset, url: asset.url, path: item.savedPath ?? undefined, alt }
        : item.savedPath
          ? pathImage(item.id, item.savedPath, undefined, alt)
          : { id: item.id, kind: "dataUrl", dataUrl: imageDataUrl(item.result), alt };
      return {
        ...base,
        title: "Image generation",
        text: item.revisedPrompt ?? undefined,
        images: [image]
      };
    }
    case "hookPrompt":
    case "enteredReviewMode":
    case "exitedReviewMode":
    case "contextCompaction":
      return { ...base, title: item.type };
    case "unsupported":
      return {
        ...base,
        title: item.originalType,
        payload: item.payload
      };
  }
}

export function normalizeTurnStatus(value: string | undefined): CodexTranscriptTurnStatus | undefined {
  if (value === "completed") return "completed";
  if (value === "failed" || value === "error") return "failed";
  if (value === "running" || value === "inProgress") return "running";
  return undefined;
}

export function secondsToMs(value: number | undefined): number | undefined {
  return typeof value === "number" ? value * 1000 : undefined;
}

function commandAction(action: CodexParsedCommandAction): CodexTranscriptCommandAction {
  return {
    type: action.type,
    command: action.command ?? action.cmd,
    name: action.name,
    path: action.path,
    query: action.query
  };
}

function userInputText(content: readonly CodexParsedUserInput[]): string {
  return content.flatMap((entry) => {
    if (entry.type === "text" || entry.type === "input_text") {
      return [entry.text];
    }
    return [];
  }).join("\n");
}

function userInputImages(itemId: string, content: readonly CodexParsedUserInput[]): CodexTranscriptImage[] {
  return content.flatMap((entry, index): CodexTranscriptImage[] => {
    if (entry.type === "image") {
      const asset = assetOf(entry as typeof entry & AssetBearing);
      return [{
        id: `${itemId}-image-${index}`,
        kind: asset ? "asset" : entry.url.startsWith("data:") ? "dataUrl" : "url",
        asset,
        url: asset?.url ?? (entry.url.startsWith("data:") ? undefined : entry.url),
        dataUrl: entry.url.startsWith("data:") ? entry.url : undefined,
        alt: "Attached image"
      }];
    }
    if (entry.type === "localImage") {
      return [pathImage(`${itemId}-image-${index}`, entry.path, assetOf(entry as typeof entry & AssetBearing), "Attached image")];
    }
    if (entry.type === "input_image") {
      const asset = assetOf(entry as typeof entry & AssetBearing);
      return [{
        id: `${itemId}-image-${index}`,
        kind: asset ? "asset" : entry.image_url.startsWith("data:") ? "dataUrl" : "url",
        asset,
        url: asset?.url ?? (entry.image_url.startsWith("data:") ? undefined : entry.image_url),
        dataUrl: entry.image_url.startsWith("data:") ? entry.image_url : undefined,
        alt: "Attached image"
      }];
    }
    return [];
  });
}

function pathImage(id: string, path: string, asset?: CodexAssetRef, alt = imageAlt(path)): CodexTranscriptImage {
  return {
    id,
    kind: asset ? "asset" : "localPath",
    asset,
    path,
    url: asset?.url,
    alt
  };
}

function fileChange(change: Extract<CodexParsedThreadItem, { type: "fileChange" }>["changes"][number]): CodexTranscriptFile {
  const stats = diffStat(change.diff ?? "");
  return {
    path: change.path,
    action: fileActionLabel(change.kind?.type),
    additions: stats.additions,
    deletions: stats.deletions,
    diff: change.diff,
    asset: assetOf(change as typeof change & AssetBearing)
  };
}

function isFinalAssistant(item: { phase?: string | null }): boolean {
  const phase = item.phase?.toLowerCase();
  return phase === "final_answer" || phase === "final";
}

function protocolItemStatus(item: CodexParsedThreadItem): string | undefined {
  switch (item.type) {
    case "commandExecution":
    case "fileChange":
    case "mcpToolCall":
    case "dynamicToolCall":
    case "collabAgentToolCall":
    case "imageGeneration":
      return item.status;
    default:
      return undefined;
  }
}

function imageAlt(path: string): string {
  return path.split("/").at(-1) ?? "Image";
}

function imageDataUrl(value: string): string {
  return value.startsWith("data:") ? value : `data:image/png;base64,${value}`;
}

function assetOf(value: AssetBearing): CodexAssetRef | undefined {
  return value.asset;
}
