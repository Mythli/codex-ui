import type { Namespace, Socket } from "socket.io";
import {
  parseCodexRequestParams,
  type CodexProtocolMetadata,
  type CodexRequestMethod,
  type CodexRequestParams
} from "../protocol/index.js";
import type { CodexTransport } from "../types/index.js";
import {
  type CoderApiLogger,
  type CreateCodexBackendTransport,
  type LiveCodexBackendProvider
} from "./backendProvider.js";

type SocketRequest = {
  method: string;
  metadata?: CodexProtocolMetadata;
  params?: unknown;
  codexBin?: string;
};

type SocketIoResponse =
  | { ok: true; result: unknown }
  | { ok: false; error: unknown };

type RequestAck = (response: SocketIoResponse) => void;

export type AppCodexSessionContext = {
  id: string;
  auth: Record<string, unknown>;
};

export type AppCodexBackendResolver = (
  context: AppCodexSessionContext
) => CodexTransport | undefined | Promise<CodexTransport | undefined>;

type AppCodexSessionRecord = AppCodexSessionContext & {
  backend?: CodexTransport;
  sockets: Set<Socket>;
  unsubscribeDiagnostic?: () => void;
  unsubscribeTraffic?: () => void;
};

export class AppCodexSessionRegistry {
  private readonly sessions = new Map<string, AppCodexSessionRecord>();
  private backendResolver?: AppCodexBackendResolver;

  constructor(private readonly options: {
    largeOutgoingPacketBytes?: number;
    logger?: CoderApiLogger;
    shouldCloseBackend?: (backend: CodexTransport) => boolean;
  } = {}) {}

  useBackendResolver(resolver: AppCodexBackendResolver): void {
    this.backendResolver = resolver;
  }

  getOrCreate(id: string, auth: Record<string, unknown> = {}): AppCodexSessionRecord {
    const existing = this.sessions.get(id);
    if (existing) {
      existing.auth = { ...existing.auth, ...auth };
      return existing;
    }

    const session: AppCodexSessionRecord = {
      id,
      auth,
      sockets: new Set()
    };
    this.sessions.set(id, session);
    return session;
  }

  getOrCreateForSocket(socket: Socket): AppCodexSessionRecord {
    const auth = socketAuth(socket);
    const id = typeof auth.appSessionId === "string" && auth.appSessionId.trim()
      ? auth.appSessionId
      : socket.id;
    const session = this.getOrCreate(id, auth);
    session.sockets.add(socket);
    socket.once("disconnect", () => {
      session.sockets.delete(socket);
    });
    return session;
  }

  async ensureBackend(
    session: AppCodexSessionRecord,
    createFallback: () => Promise<CodexTransport>
  ): Promise<CodexTransport> {
    if (session.backend) {
      return session.backend;
    }

    const resolved = await this.backendResolver?.({ id: session.id, auth: session.auth });
    const backend = resolved ?? await createFallback();
    this.setBackend(session.id, backend);
    return backend;
  }

  setBackend(sessionId: string, backend: CodexTransport): AppCodexSessionRecord {
    const session = this.getOrCreate(sessionId);
    if (session.backend === backend) {
      return session;
    }

    session.unsubscribeTraffic?.();
    session.unsubscribeDiagnostic?.();
    this.closeBackend(session.backend);
    session.backend = backend;
    session.unsubscribeTraffic = backend.onTraffic((traffic) => {
      this.emit(session.id, "traffic", traffic);
    });
    session.unsubscribeDiagnostic = backend.onDiagnostic((text) => {
      this.emit(session.id, "diagnostic", text);
    });
    return session;
  }

  emit(sessionId: string, event: string, payload: unknown): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    if (session.sockets.size === 0) {
      return;
    }
    logLargeOutgoingPacket({
      event: "socket:emit:large",
      sessionId,
      socketEvent: event,
      payload
    }, this.options, this.options.logger);
    for (const socket of session.sockets) {
      socket.emit(event, payload);
    }
  }

  clearBackend(sessionId: string, backend: CodexTransport): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.backend !== backend) {
      return;
    }
    session.unsubscribeTraffic?.();
    session.unsubscribeDiagnostic?.();
    session.backend = undefined;
    session.unsubscribeTraffic = undefined;
    session.unsubscribeDiagnostic = undefined;
  }

  closeAll(): void {
    for (const session of this.sessions.values()) {
      session.unsubscribeTraffic?.();
      session.unsubscribeDiagnostic?.();
      this.closeBackend(session.backend);
    }
    this.sessions.clear();
  }

  private closeBackend(backend: CodexTransport | undefined): void {
    if (!backend) {
      return;
    }
    if (this.options.shouldCloseBackend?.(backend) === false) {
      return;
    }
    backend.close();
  }
}

export function attachAppCodexNamespace(
  namespace: Namespace,
  options: {
    createBackendTransport: CreateCodexBackendTransport;
    largeOutgoingPacketBytes: number;
    liveBackend: LiveCodexBackendProvider;
    logger: CoderApiLogger;
    requestTimeoutMs: number;
    sessions: AppCodexSessionRegistry;
    slowNotifyMs: number;
    slowRequestMs: number;
  }
): AppCodexSocketServer {
  const server = new AppCodexSocketServer(namespace, options);
  server.attach();
  return server;
}

export class AppCodexSocketServer {
  readonly sessions: AppCodexSessionRegistry;
  private readonly largeOutgoingPacketBytes: number;
  private readonly logger: CoderApiLogger;
  private readonly requestTimeoutMs: number;
  private readonly slowNotifyMs: number;
  private readonly slowRequestMs: number;

  constructor(
    private readonly namespace: Namespace,
    private readonly options: Parameters<typeof attachAppCodexNamespace>[1]
  ) {
    this.sessions = options.sessions;
    this.largeOutgoingPacketBytes = options.largeOutgoingPacketBytes;
    this.logger = options.logger;
    this.requestTimeoutMs = options.requestTimeoutMs;
    this.slowNotifyMs = options.slowNotifyMs;
    this.slowRequestMs = options.slowRequestMs;
  }

  attach(): void {
    this.namespace.on("connection", (socket) => this.attachSocket(socket));
  }

  close(): void {
    this.sessions.closeAll();
    this.options.liveBackend.close();
    this.namespace.emit("closed", { exitCode: null, signal: null });
  }

  private attachSocket(socket: Socket): void {
    const session = this.sessions.getOrCreateForSocket(socket);

    socket.on("request", (request: SocketRequest, ack: RequestAck) => {
      const startedAt = Date.now();
      void withTimeout(
        this.handleRequest(session, request),
        this.requestTimeoutMs,
        () => new Error(`Codex socket request timed out after ${this.requestTimeoutMs}ms: ${request.method}`),
        (outcome) => {
          this.log("socket:request:late", {
            sessionId: session.id,
            socketId: socket.id,
            method: request.method,
            params: request.params,
            durationMs: Date.now() - startedAt,
            lateResponse: true,
            outcome
          });
        }
      )
        .then((result) => {
          logLargeOutgoingPacket({
            event: "socket:ack:large",
            sessionId: session.id,
            socketId: socket.id,
            method: request.method,
            params: request.params,
            payload: result
          }, { largeOutgoingPacketBytes: this.largeOutgoingPacketBytes }, this.logger);
          logSlowRequest({
            event: "socket:request:slow",
            sessionId: session.id,
            socketId: socket.id,
            method: request.method,
            params: request.params,
            startedAt,
            thresholdMs: this.slowRequestMs
          }, this.logger);
          ack({ ok: true, result });
        })
        .catch((error: unknown) => {
          const serialized = serializeError(error);
          this.log("socket:request:error", {
            sessionId: session.id,
            socketId: socket.id,
            method: request.method,
            params: request.params,
            durationMs: Date.now() - startedAt,
            error: serialized
          });
          ack({ ok: false, error: serialized });
        });
    });

    socket.on("notify", (request: SocketRequest) => {
      const startedAt = Date.now();
      void this.handleNotify(session, request).catch((error: unknown) => {
        const message = String(error instanceof Error ? error.message : error);
        this.log("socket:notify:error", {
          sessionId: session.id,
          socketId: socket.id,
          method: request.method,
          params: request.params,
          durationMs: Date.now() - startedAt,
          error: serializeError(error)
        });
        socket.emit("diagnostic", message);
      }).then(() => {
        logSlowRequest({
          event: "socket:notify:slow",
          sessionId: session.id,
          socketId: socket.id,
          method: request.method,
          params: request.params,
          startedAt,
          thresholdMs: this.slowNotifyMs
        }, this.logger);
      });
    });

    socket.on("close", () => {
      const backend = session.backend;
      if (backend && backend !== this.options.liveBackend) {
        backend.close();
        this.sessions.clearBackend(session.id, backend);
      }
    });
  }

  private async handleRequest(session: AppCodexSessionRecord, request: SocketRequest): Promise<unknown> {
    if (request.method === "initialize") {
      await this.ensureBackend(session, request.codexBin);
      return { initialized: true };
    }

    const transport = await this.ensureBackend(session, request.codexBin);
    const method = request.method as CodexRequestMethod;
    return transport.request(method, requestParams(method, request.params), { metadata: request.metadata });
  }

  private async handleNotify(session: AppCodexSessionRecord, request: SocketRequest): Promise<void> {
    const transport = await this.ensureBackend(session);
    await transport.notify(
      request.method as CodexRequestMethod,
      request.params as CodexRequestParams<CodexRequestMethod> | undefined
    );
  }

  private ensureBackend(session: AppCodexSessionRecord, codexBin?: string): Promise<CodexTransport> {
    return this.sessions.ensureBackend(session, () => codexBin
      ? this.createBackendForSession(session, codexBin)
      : this.options.liveBackend.ensureReady());
  }

  private async createBackendForSession(session: AppCodexSessionRecord, codexBin?: string): Promise<CodexTransport> {
    const transport = await this.options.createBackendTransport({
      codexBin,
      onDiagnostic: (text) => {
        this.sessions.emit(session.id, "diagnostic", text);
      }
    });

    if (transport.waitForClose) {
      void transport.waitForClose().then(() => {
        this.log("backend:closed", {
          sessionId: session.id,
          exitCode: transport.exitCode ?? null,
          signal: transport.signal ?? null
        });
        this.sessions.emit(session.id, "closed", { exitCode: transport.exitCode ?? null, signal: transport.signal ?? null });
        this.sessions.clearBackend(session.id, transport);
      });
    }
    return transport;
  }

  private log(event: string, payload: unknown): void {
    this.logger.info(event, payload);
  }
}

function socketAuth(socket: Socket): Record<string, unknown> {
  const auth = socket.handshake.auth && typeof socket.handshake.auth === "object"
    ? socket.handshake.auth as Record<string, unknown>
    : {};
  return {
    ...socket.handshake.query,
    ...auth
  };
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return error;
}

function logSlowRequest(input: {
  event: string;
  sessionId: string;
  socketId: string;
  method: string;
  params?: unknown;
  startedAt: number;
  thresholdMs: number;
}, logger: CoderApiLogger): void {
  const durationMs = Date.now() - input.startedAt;
  if (durationMs < input.thresholdMs) {
    return;
  }
  logger.info(input.event, {
    sessionId: input.sessionId,
    socketId: input.socketId,
    method: input.method,
    params: input.params,
    durationMs
  });
}

function logLargeOutgoingPacket(input: {
  event: string;
  sessionId: string;
  socketId?: string;
  socketEvent?: string;
  method?: string;
  params?: unknown;
  payload: unknown;
}, options: { largeOutgoingPacketBytes?: number } = {}, logger?: CoderApiLogger): void {
  if (!logger) {
    return;
  }
  const sizeBytes = jsonSizeBytes(input.payload);
  if (sizeBytes < (options.largeOutgoingPacketBytes ?? Number.POSITIVE_INFINITY)) {
    return;
  }
  logger.info(input.event, {
    sessionId: input.sessionId,
    socketId: input.socketId,
    socketEvent: input.socketEvent,
    method: input.method,
    params: input.params,
    sizeBytes,
    payload: summarizeOutgoingPayload(input.payload)
  });
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  createError: () => Error,
  onLate?: (outcome: "resolved" | "rejected") => void
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      timedOut = true;
      reject(createError());
    }, timeoutMs);
  });
  promise.then(
    () => {
      if (timedOut) {
        onLate?.("resolved");
      }
    },
    () => {
      if (timedOut) {
        onLate?.("rejected");
      }
    }
  );
  return Promise.race([promise, timeoutPromise])
    .finally(() => {
      if (timeout) {
        clearTimeout(timeout);
      }
    });
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function jsonSizeBytes(value: unknown): number {
  return Buffer.byteLength(safeStringify(value), "utf8");
}

function summarizeOutgoingPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return { type: typeof value };
  }

  const record = value as Record<string, unknown>;
  const summary: Record<string, unknown> = {
    kind: record.kind,
    method: record.method,
    id: record.id,
    keys: Object.keys(record)
  };
  const params = record.params;
  if (params && typeof params === "object" && "path" in params && typeof params.path === "string") {
    summary.path = params.path;
  }
  const response = record.response;
  if (response && typeof response === "object") {
    summary.responseKeys = Object.keys(response);
  }
  return summary;
}

function requestParams<M extends CodexRequestMethod>(method: M, params: unknown): CodexRequestParams<M> {
  return parseCodexRequestParams(method, params ?? {});
}
