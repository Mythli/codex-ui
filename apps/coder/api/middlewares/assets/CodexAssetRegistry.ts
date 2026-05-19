import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, extname, isAbsolute, join, resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { CodexAssetMetadata, CodexAssetRef } from "./types.js";

export type CodexAssetRecord =
  | {
      kind: "file";
      token: string;
      path: string;
      mimeType: string;
      originalPath?: string;
      sizeBytes?: number;
    }
  | {
      kind: "bytes";
      token: string;
      bytes: Uint8Array;
      mimeType: string;
      originalPath?: string;
      sizeBytes: number;
    };

export type CodexAssetRegistryOptions = {
  cacheDir?: string;
  routeBase?: string;
};

export type CodexAssetRegistry = ReturnType<typeof createCodexAssetRegistry>;

export function createCodexAssetRegistry(options: CodexAssetRegistryOptions = {}) {
  const routeBase = options.routeBase ?? "/codex-assets";
  const cacheDir = options.cacheDir ?? defaultCacheDir();
  const records = new Map<string, CodexAssetRecord>();

  function urlForToken(token: string) {
    return `${routeBase.replace(/\/+$/, "")}/${encodeURIComponent(token)}`;
  }

  function metadata(record: CodexAssetRecord): CodexAssetMetadata {
    return {
      token: record.token,
      url: urlForToken(record.token),
      kind: record.kind,
      mimeType: record.mimeType,
      originalPath: record.originalPath,
      sizeBytes: record.sizeBytes
    };
  }

  function registerFile(path: string, input: { cwd?: string; mimeType?: string; originalPath?: string } = {}): CodexAssetMetadata {
    const absolutePath = canonicalPath(path, input.cwd);
    const stat = existsSync(absolutePath) ? statSync(absolutePath) : undefined;
    const token = `file-${sha256(absolutePath)}`;
    const record: CodexAssetRecord = {
      kind: "file",
      token,
      path: absolutePath,
      mimeType: input.mimeType ?? contentType(absolutePath),
      originalPath: input.originalPath ?? path,
      sizeBytes: stat?.size
    };
    records.set(token, record);
    return metadata(record);
  }

  function registerBytes(bytes: Uint8Array, input: { mimeType?: string; originalPath?: string } = {}): CodexAssetMetadata {
    const mimeType = input.mimeType ?? "application/octet-stream";
    const token = `bytes-${sha256(bytes)}${extensionForMime(mimeType)}`;
    const existing = records.get(token);
    if (existing) {
      return metadata(existing);
    }
    const record: CodexAssetRecord = {
      kind: "bytes",
      token,
      bytes,
      mimeType,
      originalPath: input.originalPath,
      sizeBytes: bytes.byteLength
    };
    records.set(token, record);
    return metadata(record);
  }

  function stageBytesAsFile(bytes: Uint8Array, input: { mimeType?: string; originalName?: string } = {}) {
    const mimeType = input.mimeType ?? "application/octet-stream";
    const extension = extensionForMime(mimeType) || extname(input.originalName ?? "") || ".bin";
    const hash = sha256(bytes);
    const directory = join(cacheDir, "files");
    mkdirSync(directory, { recursive: true });
    const path = join(directory, `sha256-${hash}${extension}`);
    if (!existsSync(path)) {
      writeFileSync(path, bytes);
    }
    return {
      path,
      asset: registerFile(path, {
        mimeType,
        originalPath: input.originalName ? basename(input.originalName) : path
      })
    };
  }

  function registerDataUrl(dataUrl: string, input: { stageFile?: boolean; originalName?: string } = {}) {
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) {
      return undefined;
    }
    return input.stageFile
      ? stageBytesAsFile(parsed.bytes, { mimeType: parsed.mimeType, originalName: input.originalName })
      : { asset: registerBytes(parsed.bytes, { mimeType: parsed.mimeType, originalPath: input.originalName }) };
  }

  return {
    cacheDir,
    routeBase,
    get: (token: string) => records.get(token),
    metadata,
    registerBytes,
    registerDataUrl,
    registerFile,
    size: () => records.size,
    stageBytesAsFile,
    urlForToken
  };
}

export function createCodexAssetHttpHandler(registry: CodexAssetRegistry) {
  return (request: IncomingMessage, response: ServerResponse) => {
    const token = decodeURIComponent((request.url ?? "").replace(/^\/+/, "").split(/[?#]/, 1)[0] ?? "");
    if (!token) {
      response.statusCode = 400;
      response.end("Missing asset token");
      return;
    }

    const record = registry.get(token);
    if (!record) {
      response.statusCode = 404;
      response.end("Asset not found");
      return;
    }

    response.setHeader("Cache-Control", "private, max-age=300");
    response.setHeader("Content-Type", record.mimeType);
    if (record.sizeBytes !== undefined) {
      response.setHeader("Content-Length", String(record.sizeBytes));
    }

    if (record.kind === "bytes") {
      response.end(Buffer.from(record.bytes));
      return;
    }

    if (!existsSync(record.path)) {
      response.statusCode = 404;
      response.end("File not found");
      return;
    }
    createReadStream(record.path).pipe(response);
  };
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

function canonicalPath(path: string, cwd?: string) {
  return cwd && !isAbsolute(path) ? resolve(cwd, path) : resolve(path);
}

function defaultCacheDir() {
  return join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "codex-api-assets");
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

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
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
