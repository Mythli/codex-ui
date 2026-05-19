import type { Namespace, Socket } from "socket.io";
import {
  AppServerClient,
  parseCodexRequestParams,
  type CodexProtocolMetadata,
  type CodexRequestMethod,
  type CodexRequestParams,
  type CodexTransport
} from "@taylordb/codex/server";
import {
  type CodexAssetRegistry
} from "./middlewares/assets/index.js";
import {
  createAppCodexMiddlewareTransport,
  getSharedCodexBackend
} from "./codex-backend.js";

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

const slowRequestMs = 500;
// AppServerClient times out at 10s and emits protocol responseError traffic.
// Keep the socket ACK timeout higher so reducers can clear active requests first.
const socketRequestTimeoutMs = 12_000;
const slowNotifyMs = 1_000;
const largeOutgoingPacketBytes = 1_000_000;

export type AppCodexSocketServerOptions = {
  assets: CodexAssetRegistry;
  sessions?: AppCodexSessionRegistry;
};

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
    session.backend?.close();
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
    });
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
      session.backend?.close();
    }
    this.sessions.clear();
  }
}

export function attachAppCodexNamespace(
  namespace: Namespace,
  options: AppCodexSocketServerOptions
): AppCodexSocketServer {
  const server = new AppCodexSocketServer(namespace, options);
  server.attach();
  return server;
}

export class AppCodexSocketServer {
  readonly sessions: AppCodexSessionRegistry;
  private readonly liveBackend: CodexTransport & {
    ensureReady(reason?: string): Promise<CodexTransport>;
    shutdown(): void;
    start(): void;
  };

  constructor(
    private readonly namespace: Namespace,
    private readonly options: AppCodexSocketServerOptions
  ) {
    this.sessions = options.sessions ?? new AppCodexSessionRegistry();
    this.liveBackend = getSharedCodexBackend(options.assets);
  }

  attach(): void {
    this.liveBackend.start();
    this.namespace.on("connection", (socket) => this.attachSocket(socket));
  }

  close(): void {
    this.sessions.closeAll();
    this.liveBackend.shutdown();
    this.namespace.emit("closed", { exitCode: null, signal: null });
  }

  private attachSocket(socket: Socket): void {
    const session = this.sessions.getOrCreateForSocket(socket);

    socket.on("request", (request: SocketRequest, ack: RequestAck) => {
      const startedAt = Date.now();
      void withTimeout(
        this.handleRequest(session, request),
        socketRequestTimeoutMs,
        () => new Error(`Codex socket request timed out after ${socketRequestTimeoutMs}ms: ${request.method}`),
        (outcome) => {
          logBackendEvent("socket:request:late", {
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
          });
          logSlowRequest({
            event: "socket:request:slow",
            sessionId: session.id,
            socketId: socket.id,
            method: request.method,
            params: request.params,
            startedAt
          });
          ack({ ok: true, result });
        })
        .catch((error: unknown) => {
          const serialized = serializeError(error);
          logBackendEvent("socket:request:error", {
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
        logBackendEvent("socket:notify:error", {
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
          thresholdMs: slowNotifyMs
        });
      });
    });

    socket.on("close", () => {
      session.backend?.close();
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
      ? this.createLiveBackend(session, codexBin)
      : this.liveBackend.ensureReady());
  }

  private async createLiveBackend(session: AppCodexSessionRecord, codexBin?: string): Promise<CodexTransport> {
    const client = new AppServerClient(codexBin);
    const transport = createAppCodexMiddlewareTransport(client, {
      assets: this.options.assets,
      hydrateRequestResponses: false,
      onDiagnostic: (text) => {
        this.sessions.emit(session.id, "diagnostic", text);
      }
    });

    const initializePromise = client.initialize();
    void client.waitForClose().then(() => {
      logBackendEvent("backend:closed", {
        sessionId: session.id,
        exitCode: client.exitCode,
        signal: client.signal
      });
      this.sessions.emit(session.id, "closed", { exitCode: client.exitCode, signal: client.signal });
      this.sessions.clearBackend(session.id, transport);
    });

    await initializePromise;
    return transport;
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

function logBackendEvent(event: string, payload: unknown): void {
  console.info(`[codex backend] ${event}`, safeStringify(payload));
}

function logSlowRequest(input: {
  event: string;
  sessionId: string;
  socketId: string;
  method: string;
  params?: unknown;
  startedAt: number;
  thresholdMs?: number;
}): void {
  const durationMs = Date.now() - input.startedAt;
  if (durationMs < (input.thresholdMs ?? slowRequestMs)) {
    return;
  }
  logBackendEvent(input.event, {
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
}): void {
  const sizeBytes = jsonSizeBytes(input.payload);
  if (sizeBytes < largeOutgoingPacketBytes) {
    return;
  }
  logBackendEvent(input.event, {
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
