import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { extname, isAbsolute, join, resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import type { CodexAssetMetadata, CodexAssetRef } from "../types/assets.js";

export type CodexAssetHelperOptions = {
  baseUrl?: string;
  cacheDir?: string;
  routeBase?: string;
};

export type CodexAssetHelper = ReturnType<typeof createAssetHelper>;

export function createAssetHelper(options: CodexAssetHelperOptions = {}) {
  const routeBase = normalizeRouteBase(options.routeBase ?? options.baseUrl ?? "/codex-assets");
  const cacheDir = options.cacheDir ?? defaultCacheDir();

  function assetUrl(token: string) {
    return `${routeBase}/${token.split("/").map(encodeURIComponent).join("/")}`;
  }

  function fileAsset(path: string, input: { cwd?: string; mimeType?: string; originalPath?: string } = {}): CodexAssetMetadata {
    const absolutePath = canonicalPath(path, input.cwd);
    const stat = existsSync(absolutePath) ? statSync(absolutePath) : undefined;
    const token = `file/${base64UrlEncode(absolutePath)}`;
    return {
      token,
      url: assetUrl(token),
      kind: "file",
      mimeType: input.mimeType ?? contentType(absolutePath),
      originalPath: input.originalPath ?? path,
      sizeBytes: stat?.size
    };
  }

  function urlForFileTarget(
    target: string,
    input: { cwd?: string; mimeType?: string; originalPath?: string } = {}
  ): CodexAssetMetadata | undefined {
    if (!isLocalFileReference(target, { cwd: input.cwd, routeBase })) {
      return undefined;
    }
    const path = localPathFromTarget(target);
    return fileAsset(path, { ...input, originalPath: input.originalPath ?? target });
  }

  function urlForBytes(bytes: Uint8Array, input: { mimeType?: string; originalPath?: string; originalName?: string } = {}) {
    const mimeType = input.mimeType ?? "application/octet-stream";
    const extension = extensionForMime(mimeType) || extname(input.originalName ?? input.originalPath ?? "") || ".bin";
    const hash = sha256(bytes);
    const filename = `sha256-${hash}${extension}`;
    mkdirSync(cacheDir, { recursive: true });
    const path = join(cacheDir, filename);
    if (!existsSync(path)) {
      writeFileSync(path, bytes);
    }
    const stat = statSync(path);
    const token = `cache/${filename}`;
    const asset: CodexAssetMetadata = {
      token,
      url: assetUrl(token),
      kind: "bytes",
      mimeType,
      originalPath: input.originalPath ?? input.originalName,
      sizeBytes: stat.size
    };
    return { path, asset };
  }

  function urlForDataUrl(dataUrl: string, input: { originalName?: string } = {}) {
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) {
      return undefined;
    }
    return urlForBytes(parsed.bytes, {
      mimeType: parsed.mimeType,
      originalName: input.originalName,
      originalPath: input.originalName
    });
  }

  function serve(request: IncomingMessage, response: ServerResponse) {
    serveCodexAssetRequest(request, response, cacheDir);
  }

  return {
    cacheDir,
    routeBase,
    registerBytes: (bytes: Uint8Array, input: { mimeType?: string; originalPath?: string } = {}) =>
      urlForBytes(bytes, input).asset,
    registerDataUrl: (dataUrl: string, input: { originalName?: string } = {}) =>
      urlForDataUrl(dataUrl, input),
    registerFile: fileAsset,
    stageBytesAsFile: (bytes: Uint8Array, input: { mimeType?: string; originalName?: string } = {}) =>
      urlForBytes(bytes, input),
    urlForBytes,
    urlForDataUrl,
    urlForFileTarget,
    urlForPath: fileAsset,
    urlForToken: assetUrl,
    serve
  };
}

export function createAssetHttpHandler(helper: CodexAssetHelper) {
  return helper.serve;
}

export function codexAssetRef(asset: CodexAssetMetadata): CodexAssetRef {
  return {
    url: asset.url,
    kind: asset.kind,
    mimeType: asset.mimeType,
    originalPath: asset.originalPath,
    sizeBytes: asset.sizeBytes
  };
}

export function parseDataUrl(value: string): { bytes: Uint8Array; mimeType: string } | undefined {
  const match = value.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) {
    return undefined;
  }
  const mimeType = match[1] || "application/octet-stream";
  const encoded = match[3] ?? "";
  const bytes = match[2]
    ? Buffer.from(encoded, "base64")
    : Buffer.from(decodeURIComponent(encoded), "utf8");
  return { bytes, mimeType };
}

export function contentType(path: string) {
  const extension = extname(path).toLowerCase();
  if (extension === ".avif") return "image/avif";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".gif") return "image/gif";
  if (extension === ".webp") return "image/webp";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".png") return "image/png";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".html" || extension === ".htm") return "text/html; charset=utf-8";
  if (extension === ".json" || extension === ".jsonl") return "application/json; charset=utf-8";
  if (textExtensions.has(extension)) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

function serveCodexAssetRequest(request: IncomingMessage, response: ServerResponse, cacheDir: string) {
  const token = decodeRequestToken(request.url);
  if (!token) {
    response.statusCode = 400;
    response.end("Missing asset token");
    return;
  }

  const asset = assetFileForToken(token, cacheDir);
  if (!asset) {
    response.statusCode = 404;
    response.end("Asset not found");
    return;
  }

  if (!existsSync(asset.path)) {
    response.statusCode = 404;
    response.end("File not found");
    return;
  }

  const stat = statSync(asset.path);
  response.setHeader("Cache-Control", "private, max-age=300");
  response.setHeader("Content-Type", contentType(asset.path));
  response.setHeader("Content-Length", String(stat.size));
  createReadStream(asset.path).pipe(response);
}

function assetFileForToken(token: string, cacheDir: string): { path: string } | undefined {
  if (token.startsWith("file/")) {
    const encoded = token.slice("file/".length);
    const path = base64UrlDecode(encoded);
    return isAbsolute(path) ? { path } : undefined;
  }

  if (token.startsWith("cache/")) {
    const filename = token.slice("cache/".length);
    if (!/^sha256-[a-f0-9]{64}(?:\.[A-Za-z0-9]+)?$/.test(filename)) {
      return undefined;
    }
    return { path: join(cacheDir, filename) };
  }

  return undefined;
}

function decodeRequestToken(url: string | undefined): string {
  const pathname = (url ?? "").split(/[?#]/, 1)[0] ?? "";
  return pathname
    .replace(/^\/+/, "")
    .split("/")
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    })
    .join("/");
}

function isLocalFileReference(value: string, context: { cwd?: string; routeBase: string }): boolean {
  if (value.startsWith(`${context.routeBase}/`)) {
    return false;
  }
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
    return false;
  }
  if (value.startsWith("mailto:") || value.startsWith("#")) {
    return false;
  }
  return value.startsWith("/") ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.startsWith("file:") ||
    /^[A-Za-z]:[\\/]/.test(value) ||
    Boolean(context.cwd && /(^|\/)[^/\s]+\.[A-Za-z0-9]{1,8}(:\d+)?([?#].*)?$/.test(value));
}

function localPathFromTarget(value: string): string {
  const filePath = value.startsWith("file:")
    ? fileUrlToPath(value)
    : value;
  return stripLineSuffix(stripQueryAndFragment(filePath));
}

function fileUrlToPath(value: string): string {
  try {
    return fileURLToPath(value);
  } catch {
    return value.replace(/^file:\/+/, value.startsWith("file:///") ? "/" : "");
  }
}

function stripQueryAndFragment(value: string): string {
  return value.split(/[?#]/, 1)[0] ?? value;
}

function stripLineSuffix(value: string): string {
  return value.replace(/:\d+(?::\d+)?$/, "");
}

function canonicalPath(path: string, cwd?: string) {
  return cwd && !isAbsolute(path) ? resolve(cwd, path) : resolve(path);
}

function defaultCacheDir() {
  return join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "codex-api-assets");
}

function normalizeRouteBase(routeBase: string) {
  return `/${routeBase.replace(/^\/+|\/+$/g, "")}`;
}

function extensionForMime(mimeType: string) {
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/gif") return ".gif";
  if (mimeType === "image/avif") return ".avif";
  if (mimeType === "image/svg+xml") return ".svg";
  if (mimeType === "application/pdf") return ".pdf";
  if (mimeType === "application/zip") return ".zip";
  if (mimeType === "text/csv") return ".csv";
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return ".docx";
  if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return ".xlsx";
  if (mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return ".pptx";
  return "";
}

function sha256(value: Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return "";
  }
}

const textExtensions = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".md",
  ".mjs",
  ".mts",
  ".tsx",
  ".ts",
  ".txt",
  ".yml",
  ".yaml"
]);
