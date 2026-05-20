import { isAbsolute, resolve } from "node:path";
import {
  codexAssetRef,
  parseDataUrl,
  type CodexAssetRegistry
} from "./assets/CodexAssetRegistry.js";
import type { CodexAssetRef } from "./assets/types.js";
import type {
  CodexParsedFsReadFileResponse,
  CodexParsedThread,
  CodexParsedThreadItem,
  CodexParsedThreadReadResponse,
  CodexParsedTurn,
  CodexParsedUserInput,
  CodexProtocolEvent,
  CodexProtocolResponse,
  CodexProtocolTraffic,
  CodexRequestMethod,
  CodexRequestParams
} from "@taylordb/codex/protocol";
import { parseRolloutJsonlThreadTurns } from "@taylordb/codex/protocol";
import type {
  CodexMiddlewareContext,
  CodexProtocolMiddleware
} from "./types.js";

export type AssetReplacementMiddlewareOptions = {
  assets: CodexAssetRegistry;
  onDiagnostic?: (text: string) => void;
};

export type AssetReplacementContext = CodexMiddlewareContext & {
  assets: CodexAssetRegistry;
};

export function createAssetReplacementMiddleware(
  options: AssetReplacementMiddlewareOptions
): CodexProtocolMiddleware {
  const contextFor = (context: CodexMiddlewareContext): AssetReplacementContext => ({
    ...context,
    assets: options.assets,
    diagnostic: context.diagnostic ?? options.onDiagnostic
  });

  return {
    name: "asset-replacement",
    request: (request, context) => ({
      ...request,
      params: replaceRequestAssets(request.method, request.params, contextFor(context))
    }),
    response: (request, response, context) =>
      replaceResponseAssets(request.method, request.params, response, contextFor(context)),
    traffic: (traffic, context) => traffic.kind === "event"
      ? replaceTrafficAssets(traffic, contextFor(context))
      : traffic
  };
}

export async function replaceResponseAssets<M extends CodexRequestMethod>(
  method: M,
  params: CodexRequestParams<M>,
  response: CodexProtocolResponse<M>,
  context: AssetReplacementContext
): Promise<CodexProtocolResponse<M>> {
  if (method === "fs/readFile") {
    return normalizeFsReadFileResponse(
      response as CodexParsedFsReadFileResponse,
      context,
      (params as CodexRequestParams<"fs/readFile">).path
    ) as CodexProtocolResponse<M>;
  }

  if (method === "thread/read") {
    const hydrated = await hydrateThreadReadResponse(response as CodexParsedThreadReadResponse, context);
    return {
      thread: normalizeThread(hydrated.thread, { ...context, cwd: hydrated.thread.cwd ?? context.cwd })
    } as CodexProtocolResponse<M>;
  }

  if (method === "thread/start" || method === "thread/resume") {
    const maybeThreadResponse = response as { thread?: CodexParsedThread };
    return maybeThreadResponse.thread
      ? { ...maybeThreadResponse, thread: normalizeThread(maybeThreadResponse.thread, { ...context, cwd: maybeThreadResponse.thread.cwd ?? context.cwd }) } as CodexProtocolResponse<M>
      : response;
  }

  if (method === "thread/list") {
    const list = response as { data?: CodexParsedThread[] };
    return {
      ...list,
      data: list.data?.map((thread) => normalizeThread(thread, { ...context, cwd: thread.cwd ?? context.cwd }))
    } as CodexProtocolResponse<M>;
  }

  if (method === "turn/start") {
    const turnResponse = response as { turn?: CodexParsedTurn };
    return turnResponse.turn
      ? { ...turnResponse, turn: normalizeTurn(turnResponse.turn, context) } as CodexProtocolResponse<M>
      : response;
  }

  return response;
}

export async function replaceTrafficAssets(
  traffic: CodexProtocolTraffic,
  context: AssetReplacementContext
): Promise<CodexProtocolTraffic> {
  switch (traffic.kind) {
    case "request":
      return {
        ...traffic,
        params: replaceRequestAssets(traffic.method, traffic.params, context)
      } as CodexProtocolTraffic;
    case "response":
      return {
        ...traffic,
        response: await replaceResponseAssets(
          traffic.method,
          {} as CodexRequestParams<typeof traffic.method>,
          traffic.response,
          context
        )
      } as CodexProtocolTraffic;
    case "event":
      return {
        ...traffic,
        event: replaceEventAssets(traffic.event, context)
      };
    default:
      return traffic;
  }
}

export function replaceRequestAssets<M extends CodexRequestMethod>(
  method: M,
  params: CodexRequestParams<M>,
  context: AssetReplacementContext
): CodexRequestParams<M> {
  if (method !== "turn/start" && method !== "turn/steer") {
    return params;
  }

  const turnParams = params as CodexRequestParams<"turn/start">;
  return {
    ...turnParams,
    input: turnParams.input.map((entry) => normalizeOutgoingUserInput(entry, context))
  } as CodexRequestParams<M>;
}

export function replaceEventAssets(
  event: CodexProtocolEvent,
  context: AssetReplacementContext
): CodexProtocolEvent {
  if (event.method === "item/started" || event.method === "item/completed") {
    return {
      ...event,
      params: {
        ...event.params,
        item: normalizeThreadItem(event.params.item as CodexParsedThreadItem, context)
      }
    } as CodexProtocolEvent;
  }

  if ((event.method === "turn/started" || event.method === "turn/completed") && event.params.turn) {
    return {
      ...event,
      params: {
        ...event.params,
        turn: normalizeTurn(event.params.turn as CodexParsedTurn, context)
      }
    } as CodexProtocolEvent;
  }

  if (event.method === "thread/started" && event.params.thread) {
    return {
      ...event,
      params: {
        ...event.params,
        thread: normalizeThread(event.params.thread as CodexParsedThread, context)
      }
    } as CodexProtocolEvent;
  }

  return event;
}

export function normalizeThread(thread: CodexParsedThread, context: AssetReplacementContext): CodexParsedThread {
  return {
    ...thread,
    turns: thread.turns.map((turn) => normalizeTurn(turn, { ...context, cwd: thread.cwd ?? context.cwd }))
  };
}

function normalizeTurn(turn: CodexParsedTurn, context: AssetReplacementContext): CodexParsedTurn {
  return {
    ...turn,
    items: turn.items.map((item) => normalizeThreadItem(item, context))
  };
}

function normalizeThreadItem(item: CodexParsedThreadItem, context: AssetReplacementContext): CodexParsedThreadItem {
  switch (item.type) {
    case "userMessage":
      return {
        ...item,
        content: item.content.map((entry) => normalizeIncomingUserInput(entry, context))
      };
    case "imageView":
      return withAsset(item, registerFileAsset(item.path, context));
    case "imageGeneration": {
      const asset = item.savedPath
        ? registerFileAsset(item.savedPath, context)
        : item.result
          ? registerImageBytes(item.result, context)
          : undefined;
      if (item.result) {
        context.diagnostic?.("Codex asset transform stripped imageGeneration.result before browser transfer");
      }
      return withAsset({ ...item, result: "" }, asset);
    }
    case "fileChange":
      return {
        ...item,
        changes: item.changes.map((change) => withAsset(change, registerFileAsset(change.path, context)))
      };
    case "agentMessage":
    case "plan":
      return {
        ...item,
        text: rewriteMarkdownAssetUrls(item.text, context)
      };
    case "reasoning":
      return {
        ...item,
        summary: item.summary.map((text) => rewriteMarkdownAssetUrls(text, context)),
        content: item.content.map((text) => rewriteMarkdownAssetUrls(text, context))
      };
    default:
      return item;
  }
}

function normalizeOutgoingUserInput(
  value: CodexParsedUserInput,
  context: AssetReplacementContext
): CodexParsedUserInput {
  if (value.type !== "image" || !value.url.startsWith("data:")) {
    return value;
  }

  const staged = context.assets.registerDataUrl(value.url, { stageFile: true, originalName: "upload" });
  if (!staged || !("path" in staged)) {
    return value;
  }
  context.diagnostic?.("Codex asset transform staged browser image upload as localImage.path");
  return {
    type: "localImage",
    path: staged.path,
    asset: codexAssetRef(staged.asset)
  };
}

function normalizeIncomingUserInput(
  value: CodexParsedUserInput,
  context: AssetReplacementContext
): CodexParsedUserInput {
  if (value.type === "image" && value.url.startsWith("data:")) {
    const registered = context.assets.registerDataUrl(value.url);
    return registered?.asset
      ? { ...value, url: registered.asset.url, asset: codexAssetRef(registered.asset) }
      : value;
  }
  if (value.type === "localImage") {
    return withAsset(value, registerFileAsset(value.path, context));
  }
  return value;
}

async function hydrateThreadReadResponse(
  response: CodexParsedThreadReadResponse,
  context: AssetReplacementContext
): Promise<CodexParsedThreadReadResponse> {
  if (!response.thread.path || !context.readFile) {
    return response;
  }

  const fsRead = await context.readFile(response.thread.path).catch(() => undefined);
  const jsonl = fsRead?.dataText ?? decodeBase64(fsRead?.dataBase64);
  if (!jsonl) {
    return response;
  }

  const turnsById = parseRolloutJsonlThreadTurns(jsonl);
  if (turnsById.size === 0) {
    return response;
  }

  const existingTurnIds = new Set(response.thread.turns.map((turn) => turn.id));
  const hydratedOnlyTurns = [...turnsById.values()].filter((turn) => !existingTurnIds.has(turn.id));
  return {
    thread: {
      ...response.thread,
      turns: [
        ...response.thread.turns.map((turn) => {
          const hydratedTurn = turnsById.get(turn.id);
          return hydratedTurn ? { ...turn, items: mergeThreadItems(turn.items, hydratedTurn.items) } : turn;
        }),
        ...hydratedOnlyTurns
      ]
    }
  } as CodexParsedThreadReadResponse;
}

function mergeThreadItems(existing: readonly CodexParsedThreadItem[], hydrated: readonly CodexParsedThreadItem[]): CodexParsedThreadItem[] {
  const result: CodexParsedThreadItem[] = [];
  const used = new Set<number>();

  for (const [index, item] of existing.entries()) {
    if (item.type === "userMessage" && !hydrated.some((incoming) => threadItemsMatch(item, incoming))) {
      used.add(index);
      result.push(item);
    }
  }

  for (const incoming of hydrated) {
    const existingIndex = existing.findIndex((item, index) => !used.has(index) && threadItemsMatch(item, incoming));
    if (existingIndex === -1) {
      result.push(incoming);
      continue;
    }
    used.add(existingIndex);
    result.push(mergeThreadItemDetails(existing[existingIndex]!, incoming));
  }

  for (const [index, item] of existing.entries()) {
    if (!used.has(index)) {
      result.push(item);
    }
  }
  return result;
}

function mergeThreadItemDetails(existing: CodexParsedThreadItem, incoming: CodexParsedThreadItem): CodexParsedThreadItem {
  if (existing.type === "fileChange" && incoming.type === "fileChange") {
    return {
      ...existing,
      ...incoming,
      changes: incoming.changes.length > 0 ? incoming.changes : existing.changes
    };
  }

  if (existing.type === "commandExecution" && incoming.type === "commandExecution") {
    return {
      ...existing,
      ...incoming,
      commandActions: incoming.commandActions.length > 0 ? incoming.commandActions : existing.commandActions,
      aggregatedOutput: incoming.aggregatedOutput ?? existing.aggregatedOutput,
      exitCode: incoming.exitCode ?? existing.exitCode,
      durationMs: incoming.durationMs ?? existing.durationMs
    };
  }

  return { ...existing, ...incoming } as CodexParsedThreadItem;
}

function threadItemsMatch(a: CodexParsedThreadItem, b: CodexParsedThreadItem): boolean {
  if (a.id === b.id) {
    return true;
  }
  if (a.type !== "userMessage" || b.type !== "userMessage") {
    return false;
  }
  return userMessageText(a.content) === userMessageText(b.content);
}

function userMessageText(content: readonly CodexParsedUserInput[]): string {
  return content.flatMap((entry) => entry.type === "text" ? [entry.text] : []).join("\n");
}

function normalizeFsReadFileResponse(
  response: CodexParsedFsReadFileResponse,
  context?: AssetReplacementContext,
  path?: string
): CodexParsedFsReadFileResponse {
  const dataText = response.dataText ?? decodeBase64(response.dataBase64);
  if (!dataText) {
    return response.dataBase64 ? { ...response, dataBase64: undefined } : response;
  }

  const normalizedText = context && path?.endsWith(".jsonl")
    ? normalizeRolloutJsonlAssets(dataText, context)
    : dataText;
  return {
    ...response,
    dataBase64: undefined,
    dataText: normalizedText
  };
}

function normalizeRolloutJsonlAssets(
  jsonl: string,
  context: AssetReplacementContext
): string {
  return jsonl.split("\n").map((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return line;
    }

    try {
      return JSON.stringify(normalizeRolloutAssetValue(JSON.parse(trimmed), context));
    } catch {
      return line;
    }
  }).join("\n");
}

function normalizeRolloutAssetValue(
  value: unknown,
  context: AssetReplacementContext
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeRolloutAssetValue(item, context));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const next = Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [
      key,
      normalizeRolloutAssetValue(entryValue, context)
    ])
  ) as Record<string, unknown>;

  if (typeof next.image_url === "string" && next.image_url.startsWith("data:")) {
    const asset = registerDataUrlAsset(next.image_url, context);
    if (asset) {
      next.image_url = asset.url;
      next.asset = asset;
    }
  }

  if (typeof next.url === "string" && next.url.startsWith("data:")) {
    const asset = registerDataUrlAsset(next.url, context);
    if (asset) {
      next.url = asset.url;
      next.asset = asset;
    }
  }

  if (next.type === "imageGeneration" && typeof next.result === "string" && next.result) {
    const asset = registerImageBytes(next.result, context);
    if (asset) {
      next.result = "";
      next.asset = asset;
    }
  }

  if (next.type === "localImage" && typeof next.path === "string") {
    const asset = registerFileAsset(next.path, context);
    if (asset) {
      next.asset = asset;
    }
  }

  if (next.type === "imageView" && typeof next.path === "string") {
    const asset = registerFileAsset(next.path, context);
    if (asset) {
      next.asset = asset;
    }
  }

  if (next.type === "imageGeneration" && typeof next.savedPath === "string" && next.savedPath) {
    const asset = registerFileAsset(next.savedPath, context);
    if (asset) {
      next.asset = asset;
    }
  }

  if ((next.type === "agentMessage" || next.type === "plan") && typeof next.text === "string") {
    next.text = rewriteMarkdownAssetUrls(next.text, context);
  }

  if (next.type === "reasoning") {
    if (Array.isArray(next.summary)) {
      next.summary = next.summary.map((entry) => typeof entry === "string" ? rewriteMarkdownAssetUrls(entry, context) : entry);
    }
    if (Array.isArray(next.content)) {
      next.content = next.content.map((entry) => typeof entry === "string" ? rewriteMarkdownAssetUrls(entry, context) : entry);
    }
  }

  return next;
}

function registerDataUrlAsset(
  dataUrl: string,
  context: AssetReplacementContext
): CodexAssetRef | undefined {
  const registered = context.assets.registerDataUrl(dataUrl);
  return registered?.asset ? codexAssetRef(registered.asset) : undefined;
}

function registerImageBytes(value: string, context: AssetReplacementContext): CodexAssetRef | undefined {
  const parsed = value.startsWith("data:")
    ? parseDataUrl(value)
    : { bytes: Buffer.from(value, "base64"), mimeType: "image/png" };
  return parsed ? codexAssetRef(context.assets.registerBytes(parsed.bytes, { mimeType: parsed.mimeType })) : undefined;
}

function registerFileAsset(value: string, context: AssetReplacementContext): CodexAssetRef | undefined {
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
    return undefined;
  }
  try {
    return codexAssetRef(context.assets.registerFile(value, { cwd: context.cwd }));
  } catch {
    return undefined;
  }
}

function withAsset<T extends object>(value: T, asset: CodexAssetRef | undefined): T & { asset?: CodexAssetRef } {
  return asset ? { ...value, asset } : value;
}

function rewriteMarkdownAssetUrls(text: string, context: AssetReplacementContext) {
  return text.replace(/(!?\[[^\]]*]\()([^)]+)(\))/g, (match, prefix: string, target: string, suffix: string) => {
    const rawTarget = target.trim();
    if (!isLocalFileReference(rawTarget) && !rawTarget.startsWith("data:")) {
      return match;
    }
    if (rawTarget.startsWith("data:")) {
      const registered = context.assets.registerDataUrl(rawTarget);
      return registered?.asset ? `${prefix}${registered.asset.url}${suffix}` : match;
    }
    const asset = registerFileAsset(stripFileProtocol(stripFragment(rawTarget)), context);
    return asset ? `${prefix}${asset.url}${suffix}` : match;
  });
}

function isLocalFileReference(value: string): boolean {
  return value.startsWith("/")
    || value.startsWith("./")
    || value.startsWith("../")
    || value.startsWith("file:")
    || /^[A-Za-z]:[\\/]/.test(value)
    || /(^|\/)[^/\s]+\.[A-Za-z0-9]{1,8}(:\d+)?(#.*)?$/.test(value);
}

function stripFragment(value: string) {
  return value.split("#", 1)[0]!.replace(/:\d+$/, "");
}

function stripFileProtocol(value: string) {
  return value.startsWith("file://") ? value.slice("file://".length) : value;
}

function decodeBase64(value: string | undefined): string | undefined {
  return value ? Buffer.from(value, "base64").toString("utf8") : undefined;
}

function absolutePath(path: string, cwd?: string) {
  return cwd && !isAbsolute(path) ? resolve(cwd, path) : path;
}

void absolutePath;
