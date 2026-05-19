import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { CodexTransport } from "../core/transport/CodexTransport.js";
import type { CodexTransportRequestOptions } from "../core/transport/CodexTransport.js";
import {
  createCodexWireParserMiddleware,
  parseCodexProtocolRequestTraffic,
  parseCodexProtocolErrorResponseTraffic,
  type CodexProtocolMetadata,
  type CodexProtocolResponse,
  type CodexProtocolTraffic,
  type CodexRequestMethod,
  type CodexRequestParams,
  type CodexWireParserMiddleware
} from "../protocol/stream/index.js";
import { resolveCodexBinary } from "./codexBinary.js";

type PendingRequest = {
  method: CodexRequestMethod;
  params: unknown;
  metadata?: CodexProtocolMetadata;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  silent?: boolean;
  startedAt: number;
  timeout: ReturnType<typeof setTimeout>;
};

const requestTimeoutMs = 10_000;

export type AppServerClientOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  trace?: (entry: AppServerTraceEntry) => void;
};

export type AppServerTraceEntry =
  | {
      direction: "stdin";
      message: unknown;
      time: number;
    }
  | {
      direction: "stdout";
      line: string;
      message?: unknown;
      time: number;
    }
  | {
      direction: "stderr";
      line: string;
      time: number;
    };

export class AppServerClient implements CodexTransport {
  private child: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private stdoutBuffer = "";
  private closePromise: Promise<void>;
  private trafficListeners = new Set<(traffic: CodexProtocolTraffic) => void>();
  private diagnosticListeners = new Set<(text: string) => void>();
  private readonly parserMiddleware: CodexWireParserMiddleware = createCodexWireParserMiddleware();
  private readonly trace?: (entry: AppServerTraceEntry) => void;

  exitCode: number | null = null;
  signal: NodeJS.Signals | null = null;

  constructor(codexBin = resolveCodexBinary(), options: AppServerClientOptions = {}) {
    this.trace = options.trace;
    this.child = spawn(codexBin, ["app-server", "--listen", "stdio://"], {
      cwd: options.cwd ?? process.cwd(),
      env: options.env ?? process.env,
      stdio: ["pipe", "pipe", "pipe"]
    });

    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => this.readStdout(chunk));
    this.child.stderr.on("data", (chunk: string) => this.readStderr(chunk));
    this.child.once("error", (error) => this.rejectAll(error));
    this.closePromise = new Promise((resolve) => {
      this.child.once("close", (code, signal) => {
        this.exitCode = code;
        this.signal = signal;
        this.rejectAll(new Error("Codex app-server closed before responding"));
        resolve();
      });
    });
  }

  async initialize(): Promise<void> {
    await this.request("initialize", {
      clientInfo: { name: "codex-api", version: "0.1.0" },
      capabilities: { experimentalApi: true }
    });
    this.notify("initialized");
  }

  request<M extends CodexRequestMethod>(
    method: M,
    params: CodexRequestParams<M>,
    options: CodexTransportRequestOptions = {}
  ): Promise<CodexProtocolResponse<M>> {
    return this.requestWithOptions(method, params, options);
  }

  requestInternal<M extends CodexRequestMethod>(
    method: M,
    params: CodexRequestParams<M>,
    options: CodexTransportRequestOptions = {}
  ): Promise<CodexProtocolResponse<M>> {
    return this.requestWithOptions(method, params, { ...options, silent: true });
  }

  private requestWithOptions<M extends CodexRequestMethod>(
    method: M,
    params: CodexRequestParams<M>,
    options: CodexTransportRequestOptions & { silent?: boolean } = {}
  ): Promise<CodexProtocolResponse<M>> {
    const id = this.nextId++;
    const startedAt = Date.now();
    const traffic = this.parserMiddleware.observeRequest(method, params, {
      id,
      metadata: options.metadata,
      timestampMs: startedAt
    });

    return new Promise<CodexProtocolResponse<M>>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.failRequest(id, new Error(`Codex app-server request timed out after ${requestTimeoutMs}ms: ${method}`));
      }, requestTimeoutMs);
      unrefTimer(timeout);
      this.pending.set(id, {
        method,
        metadata: options.metadata,
        params: traffic.params,
        resolve: (value) => resolve(value as CodexProtocolResponse<M>),
        reject,
        silent: options.silent,
        startedAt,
        timeout
      });
      if (!options.silent) {
        this.emitTraffic(traffic);
      }
      this.write({ id, method, params: traffic.params });
    });
  }

  notify<M extends CodexRequestMethod>(method: M, params?: CodexRequestParams<M>): void {
    const traffic = parseCodexProtocolRequestTraffic(method, params ?? {}, { id: `notify-${Date.now()}`, timestampMs: Date.now() });
    this.emitTraffic(traffic);
    this.write(params === undefined ? { method } : { method, params: traffic.params });
  }

  onTraffic(listener: (traffic: CodexProtocolTraffic) => void): () => void {
    this.trafficListeners.add(listener);
    return () => this.trafficListeners.delete(listener);
  }

  onDiagnostic(listener: (text: string) => void): () => void {
    this.diagnosticListeners.add(listener);
    return () => this.diagnosticListeners.delete(listener);
  }

  close(): void {
    if (!this.child.killed) {
      this.child.kill("SIGTERM");
    }
  }

  waitForClose(): Promise<void> {
    return this.closePromise;
  }

  private write(message: unknown): void {
    this.trace?.({ direction: "stdin", message, time: Date.now() });
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private readStdout(chunk: string): void {
    this.stdoutBuffer += chunk;

    for (;;) {
      const newlineIndex = this.stdoutBuffer.indexOf("\n");
      if (newlineIndex === -1) {
        break;
      }

      const line = this.stdoutBuffer.slice(0, newlineIndex);
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);
      this.handleMessage(line);
    }
  }

  private readStderr(chunk: string): void {
    for (const line of chunk.split("\n")) {
      if (line.trim()) {
        this.trace?.({ direction: "stderr", line, time: Date.now() });
        this.emitDiagnostic(line);
      }
    }
  }

  private handleMessage(line: string): void {
    if (!line.trim()) {
      return;
    }

    const parsed = this.parserMiddleware.parseWireLine(line);
    const responseId = parsed.kind === "response" || parsed.kind === "responseError" ? Number(parsed.id) : undefined;
    const pending = responseId === undefined || Number.isNaN(responseId) ? undefined : this.pending.get(responseId);
    this.trace?.({ direction: "stdout", line, message: parsed, time: Date.now() });

    if (parsed.kind === "diagnostic") {
      if (parsed.text) {
        this.emitDiagnostic(parsed.text);
      }
      return;
    }

    if ((parsed.kind === "response" || parsed.kind === "responseError") && pending && responseId !== undefined) {
      this.pending.delete(responseId);
      clearTimeout(pending.timeout);
      if (!pending.silent) {
        this.emitTraffic(withResponseMetadata(parsed, pending));
      }
      if (parsed.kind === "responseError") {
        pending.reject(parsed.error);
      } else {
        pending.resolve(parsed.response);
      }
      return;
    }

    if (parsed.kind === "response" || parsed.kind === "responseError") {
      this.emitDiagnostic(`[codex app-server] request:late ${JSON.stringify({
        requestId: parsed.id,
        method: parsed.method,
        kind: parsed.kind,
        lateResponse: true
      })}`);
      return;
    }

    if (parsed.kind === "serverRequest") {
      this.emitTraffic(parsed);
      this.write({ id: Number(parsed.id), result: defaultServerRequestResponse(parsed.method) });
      return;
    }

    this.emitTraffic(parsed);
  }

  private rejectAll(error: unknown): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timeout);
      if (!pending.silent) {
        this.emitTraffic(errorTraffic(id, pending.method, error, pending.metadata));
      }
      pending.reject(error);
    }
    this.pending.clear();
  }

  private failRequest(id: number, error: unknown): void {
    const pending = this.pending.get(id);
    if (!pending) {
      return;
    }

    this.pending.delete(id);
    clearTimeout(pending.timeout);
    this.emitDiagnostic(`[codex app-server] request:error ${JSON.stringify({
      requestId: id,
      method: pending.method,
      params: pending.params,
      durationMs: Date.now() - pending.startedAt,
      lateResponse: false,
      error: serializeDiagnosticError(error)
    })}`);
    if (!pending.silent) {
      this.emitTraffic(errorTraffic(id, pending.method, error, pending.metadata));
    }
    pending.reject(error);
  }

  private emitTraffic(traffic: CodexProtocolTraffic): void {
    for (const listener of this.trafficListeners) {
      listener(traffic);
    }
  }

  private emitDiagnostic(text: string): void {
    this.emitTraffic({ kind: "diagnostic", text, timestampMs: Date.now() });
    for (const listener of this.diagnosticListeners) {
      listener(text);
    }
  }
}

function serializeDiagnosticError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

function defaultServerRequestResponse(method: string): unknown {
  if (method.includes("requestApproval") || method.includes("permissions")) {
    return { decision: "denied" };
  }
  if (method.includes("requestUserInput")) {
    return { answers: {} };
  }
  if (method.includes("elicitation")) {
    return { action: "cancel" };
  }
  return {};
}

function withResponseMetadata(
  traffic: CodexProtocolTraffic,
  pending: PendingRequest
): CodexProtocolTraffic {
  if (!pending.metadata || (traffic.kind !== "response" && traffic.kind !== "responseError")) {
    return traffic;
  }
  return { ...traffic, metadata: pending.metadata } as CodexProtocolTraffic;
}

function errorTraffic(
  id: number,
  method: CodexRequestMethod,
  error: unknown,
  metadata?: CodexProtocolMetadata
): Extract<CodexProtocolTraffic, { kind: "responseError" }> {
  return parseCodexProtocolErrorResponseTraffic(method, serializeError(error), {
    id,
    metadata,
    timestampMs: Date.now()
  });
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }
  return { message: String(error) };
}

function unrefTimer(timeout: ReturnType<typeof setTimeout>): void {
  if (typeof timeout === "object" && "unref" in timeout && typeof timeout.unref === "function") {
    timeout.unref();
  }
}
