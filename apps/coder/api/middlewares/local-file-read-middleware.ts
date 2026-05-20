import { readFile } from "node:fs/promises";
import type {
  CodexParsedFsReadFileResponse,
  CodexProtocolResponse,
  CodexRequestMethod,
  CodexRequestParams
} from "@taylordb/codex/protocol";
import type {
  CodexProtocolMiddleware
} from "./types.js";
import type { CodexTransport } from "@taylordb/codex/server";

export type LocalFileReadMiddlewareOptions = {
  transport: CodexTransport;
  onDiagnostic?: (text: string) => void;
};

export function createLocalFileReadMiddleware(
  options: LocalFileReadMiddlewareOptions
): CodexProtocolMiddleware {
  return {
    name: "local-file-read",
    async request(request, context) {
      if (request.method !== "fs/readFile") {
        return request;
      }
      const path = fileReadPath(request.params);
      if (!shouldReadLocally(path)) {
        return request;
      }
      const response = await readCodexFileWithDiagnostics({
        method: request.method,
        params: request.params,
        transport: options.transport,
        diagnostic: context.diagnostic ?? options.onDiagnostic
      });
      return {
        type: "handled",
        request,
        response
      };
    }
  };
}

export async function readCodexFileWithDiagnostics<M extends CodexRequestMethod>(input: {
  method: M;
  params: CodexRequestParams<M>;
  transport: CodexTransport;
  diagnostic?: (text: string) => void;
}): Promise<CodexProtocolResponse<M>> {
  if (input.method !== "fs/readFile") {
    return input.transport.request(input.method, input.params);
  }

  const path = fileReadPath(input.params);
  const local = shouldReadLocally(path);
  const startedAt = Date.now();
  input.diagnostic?.(`[codex backend] fs/readFile ${local ? "local" : "app-server"} started${path ? ` ${path}` : ""}`);
  try {
    const response = local
      ? { dataText: await readFile(path, "utf8") } as CodexProtocolResponse<M>
      : await input.transport.request(input.method, input.params);
    input.diagnostic?.(`[codex backend] fs/readFile ${local ? "local" : "app-server"} completed in ${Date.now() - startedAt}ms${path ? ` ${path}` : ""}`);
    return response;
  } catch (error) {
    input.diagnostic?.(`[codex backend] fs/readFile ${local ? "local" : "app-server"} failed in ${Date.now() - startedAt}ms${path ? ` ${path}` : ""}: ${errorMessage(error)}`);
    throw error;
  }
}

export function fileReadPath(params: unknown): string | undefined {
  return isRecord(params) && typeof params.path === "string" ? params.path : undefined;
}

export function shouldReadLocally(path: string | undefined): path is string {
  return Boolean(path?.endsWith(".jsonl"));
}

export function responseCwd(response: unknown): string | undefined {
  const thread = isRecord(response) && response.thread && typeof response.thread === "object"
    ? response.thread
    : undefined;
  return thread && "cwd" in thread && typeof thread.cwd === "string" ? thread.cwd : undefined;
}

export function requestCwd(params: unknown): string | undefined {
  return isRecord(params) && typeof params.cwd === "string" ? params.cwd : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export type { CodexParsedFsReadFileResponse };
