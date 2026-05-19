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
  CodexTranscriptAttachment,
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
    case "userMessage": {
      const userInput = projectUserInput(item.id, item.content);
      return {
        ...base,
        role: "user",
        text: userInput.text,
        title: "User message",
        attachments: userInput.attachments,
        images: userInputImages(item.id, item.content)
      };
    }
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

function projectUserInput(itemId: string, content: readonly CodexParsedUserInput[]): {
  attachments: CodexTranscriptAttachment[];
  text: string;
} {
  const attachments: CodexTranscriptAttachment[] = [];
  const text = content.flatMap((entry, entryIndex) => {
    if (entry.type === "text" || entry.type === "input_text") {
      const projected = projectAttachmentReferences(itemId, entryIndex, entry.text);
      attachments.push(...projected.attachments);
      return projected.text ? [projected.text] : [];
    }
    if (entry.type === "localImage") {
      const asset = assetOf(entry as typeof entry & AssetBearing);
      if (!isImagePath(entry.path, asset)) {
        attachments.push(fileAttachmentFromPath(`${itemId}-attachment-${entryIndex}`, entry.path, asset));
      }
    }
    return [];
  }).join("\n");
  return { attachments, text };
}

function projectAttachmentReferences(itemId: string, entryIndex: number, text: string): {
  attachments: CodexTranscriptAttachment[];
  text: string;
} {
  const attachments: CodexTranscriptAttachment[] = [];
  const lines = text.split(/\r?\n/);
  const visibleLines = lines.flatMap((line, lineIndex) => {
    const projected = projectAttachmentReferenceLine(`${itemId}-attachment-${entryIndex}-${lineIndex}`, line);
    if (!projected) {
      return [line];
    }
    attachments.push(projected.attachment);
    return projected.text ? [projected.text] : [];
  });
  return {
    attachments,
    text: attachments.length > 0 ? visibleLines.join("\n").trim() : text
  };
}

function projectAttachmentReferenceLine(id: string, line: string): {
  attachment: CodexTranscriptAttachment;
  text: string;
} | undefined {
  const match = line.match(/^(.*?)Attached file: (.+) \(([^,]+), ([^)]+)\) at (.+)\. Inspect it if relevant\.$/);
  if (!match) {
    return undefined;
  }
  return {
    attachment: {
      id,
      kind: "file",
      name: match[2] ?? "attachment",
      mimeType: match[3],
      sizeLabel: match[4],
      path: match[5]
    },
    text: (match[1] ?? "").trimEnd()
  };
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
      const asset = assetOf(entry as typeof entry & AssetBearing);
      return isImagePath(entry.path, asset)
        ? [pathImage(`${itemId}-image-${index}`, entry.path, asset, "Attached image")]
        : [];
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

function fileAttachmentFromPath(id: string, path: string, asset?: CodexAssetRef): CodexTranscriptAttachment {
  return {
    id,
    kind: "file",
    name: fileNameFromPath(path),
    mimeType: asset?.mimeType ?? mimeTypeFromPath(path),
    path,
    sizeLabel: asset?.sizeBytes ? formatSize(asset.sizeBytes) : undefined
  };
}

function isImagePath(path: string, asset?: CodexAssetRef): boolean {
  if (asset?.mimeType) {
    return asset.mimeType.startsWith("image/");
  }
  const extension = extensionFromPath(path);
  return extension ? imageExtensions.has(extension) : false;
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).at(-1) || "attachment";
}

function extensionFromPath(path: string): string | undefined {
  const fileName = fileNameFromPath(path).toLowerCase();
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex > 0 ? fileName.slice(dotIndex + 1) : undefined;
}

function mimeTypeFromPath(path: string): string | undefined {
  const extension = extensionFromPath(path);
  return extension ? mimeTypesByExtension[extension] : undefined;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  for (const unit of units) {
    if (value < 1024 || unit === units.at(-1)) {
      return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
    }
    value /= 1024;
  }
  return `${bytes} B`;
}

const imageExtensions = new Set(["avif", "bmp", "gif", "heic", "jpeg", "jpg", "png", "svg", "tif", "tiff", "webp"]);

const mimeTypesByExtension: Record<string, string> = {
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  dxf: "application/x-dxf",
  json: "application/json",
  md: "text/markdown",
  pdf: "application/pdf",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip"
};

function fileChange(change: Extract<CodexParsedThreadItem, { type: "fileChange" }>["changes"][number]): CodexTranscriptFile {
  const stats = diffStat(change.diff ?? "");
  return {
    path: change.path,
    action: fileActionLabel(change.kind?.type),
    additions: stats.additions,
    content: change.content,
    deletions: stats.deletions,
    diff: change.diff,
    kind: change.kind,
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
