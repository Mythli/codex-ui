import type { Namespace, Socket } from "socket.io";
import {
  AppServerClient,
  parseCodexRequestParams,
  type CodexRequestMethod,
  type CodexRequestParams,
  type CodexTransport
} from "@taylordb/codex/server";
import {
  type CodexAssetRegistry
} from "./middlewares/assets/index.js";
import {
  createAssetReplacementMiddleware,
  createLocalFileReadMiddleware,
  createTrafficMeasurementMiddleware
} from "./middlewares/index.js";
import { createCodexMiddlewareTransport } from "./createCodexMiddlewareTransport.js";
import type { CodexProtocolResponse } from "@taylordb/codex/protocol";

type SocketRequest = {
  method: string;
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
const healthCheckIntervalMs = 10_000;

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
  private readonly liveBackend: CodexBackendSupervisor;

  constructor(
    private readonly namespace: Namespace,
    private readonly options: AppCodexSocketServerOptions
  ) {
    this.sessions = options.sessions ?? new AppCodexSessionRegistry();
    this.liveBackend = new CodexBackendSupervisor({ assets: options.assets });
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
    return transport.request(method, requestParams(method, request.params));
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

type SupervisedBackend = {
  client: AppServerClient & {
    requestInternal?: AppServerClient["request"];
  };
  transport: CodexTransport;
  unsubscribeDiagnostic: () => void;
  unsubscribeTraffic: () => void;
};

class CodexBackendSupervisor implements CodexTransport {
  private backend?: SupervisedBackend;
  private healthTimer?: ReturnType<typeof setInterval>;
  private readyPromise?: Promise<CodexTransport>;
  private restarting = false;
  private shuttingDown = false;
  private readonly diagnosticListeners = new Set<(text: string) => void>();
  private readonly trafficListeners = new Set<(traffic: Parameters<CodexTransport["onTraffic"]>[0] extends (traffic: infer T) => void ? T : never) => void>();

  constructor(private readonly options: { assets: CodexAssetRegistry }) {}

  start(): void {
    void this.ensureReady("startup");
    if (!this.healthTimer) {
      this.healthTimer = setInterval(() => {
        void this.checkHealth();
      }, healthCheckIntervalMs);
      unrefTimer(this.healthTimer);
    }
  }

  async ensureReady(reason = "request"): Promise<CodexTransport> {
    if (this.backend && !this.restarting) {
      return this;
    }
    this.readyPromise ??= this.startBackend(reason).finally(() => {
      this.readyPromise = undefined;
    });
    await this.readyPromise;
    return this;
  }

  async request<M extends CodexRequestMethod>(method: M, params: CodexRequestParams<M>): Promise<CodexProtocolResponse<M>> {
    await this.ensureReady("request");
    if (!this.backend) {
      throw new Error("Codex backend is not ready.");
    }
    return this.backend.transport.request(method, params);
  }

  async notify<M extends CodexRequestMethod>(method: M, params?: CodexRequestParams<M>): Promise<void> {
    await this.ensureReady("notify");
    if (!this.backend) {
      throw new Error("Codex backend is not ready.");
    }
    await this.backend.transport.notify(method, params);
  }

  onTraffic(listener: Parameters<CodexTransport["onTraffic"]>[0]): () => void {
    this.trafficListeners.add(listener);
    return () => {
      this.trafficListeners.delete(listener);
    };
  }

  onDiagnostic(listener: (text: string) => void): () => void {
    this.diagnosticListeners.add(listener);
    return () => {
      this.diagnosticListeners.delete(listener);
    };
  }

  close(): void {
    // Socket/session close must not stop the supervised process for the whole app.
  }

  shutdown(): void {
    this.shuttingDown = true;
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = undefined;
    }
    this.disposeBackend("shutdown");
  }

  private async startBackend(reason: string): Promise<CodexTransport> {
    this.restarting = true;
    this.disposeBackend(reason);
    const startedAt = Date.now();
    logBackendEvent("codex:restart:start", { reason });

    const client = new AppServerClient() as SupervisedBackend["client"];
    const transport = createAppCodexMiddlewareTransport(client, {
      assets: this.options.assets,
      hydrateRequestResponses: false,
      onDiagnostic: (text) => this.emitDiagnostic(text)
    });
    const backend: SupervisedBackend = {
      client,
      transport,
      unsubscribeDiagnostic: transport.onDiagnostic((text) => this.emitDiagnostic(text)),
      unsubscribeTraffic: transport.onTraffic((traffic) => this.emitTraffic(traffic))
    };

    void client.waitForClose().then(() => {
      logBackendEvent("codex:closed", {
        exitCode: client.exitCode,
        signal: client.signal
      });
      if (this.backend === backend) {
        this.disposeBackend("closed");
        if (!this.shuttingDown) {
          void this.ensureReady("closed");
        }
      }
    });

    try {
      await client.initialize();
      this.backend = backend;
      this.restarting = false;
      logBackendEvent("codex:restart:ready", {
        durationMs: Date.now() - startedAt,
        reason
      });
      return this;
    } catch (error) {
      this.restarting = false;
      backend.unsubscribeDiagnostic();
      backend.unsubscribeTraffic();
      backend.transport.close();
      logBackendEvent("codex:restart:error", {
        durationMs: Date.now() - startedAt,
        error: serializeError(error),
        reason
      });
      throw error;
    }
  }

  private async checkHealth(): Promise<void> {
    if (!this.backend || this.restarting || this.shuttingDown) {
      return;
    }
    const startedAt = Date.now();
    try {
      const requestInternal = this.backend.client.requestInternal?.bind(this.backend.client)
        ?? this.backend.client.request.bind(this.backend.client);
      await requestInternal("model/list", { limit: 1, includeHidden: false });
      logBackendEvent("codex:health:ok", {
        durationMs: Date.now() - startedAt
      });
    } catch (error) {
      logBackendEvent("codex:health:failed", {
        durationMs: Date.now() - startedAt,
        error: serializeError(error)
      });
      if (!this.shuttingDown) {
        this.disposeBackend("health-failed");
        void this.ensureReady("health-failed");
      }
    }
  }

  private disposeBackend(reason: string): void {
    const backend = this.backend;
    this.backend = undefined;
    if (!backend) {
      return;
    }
    backend.unsubscribeDiagnostic();
    backend.unsubscribeTraffic();
    backend.transport.close();
    logBackendEvent("codex:disposed", { reason });
  }

  private emitTraffic(traffic: Parameters<CodexTransport["onTraffic"]>[0] extends (traffic: infer T) => void ? T : never): void {
    for (const listener of this.trafficListeners) {
      listener(traffic);
    }
  }

  private emitDiagnostic(text: string): void {
    for (const listener of this.diagnosticListeners) {
      listener(text);
    }
  }
}

function createAppCodexMiddlewareTransport(
  client: AppServerClient,
  options: {
    assets: CodexAssetRegistry;
    hydrateRequestResponses?: boolean;
    onDiagnostic?: (text: string) => void;
  }
): CodexTransport {
  return createCodexMiddlewareTransport(
    client,
    {
      hydrateRequestResponses: options.hydrateRequestResponses,
      onDiagnostic: options.onDiagnostic
    },
    createLocalFileReadMiddleware({
      transport: client,
      onDiagnostic: options.onDiagnostic
    }),
    createAssetReplacementMiddleware({
      assets: options.assets,
      onDiagnostic: options.onDiagnostic
    }),
    createTrafficMeasurementMiddleware({
      onDiagnostic: options.onDiagnostic
    })
  );
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

function unrefTimer(timer: ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>): void {
  if (typeof timer === "object" && "unref" in timer && typeof timer.unref === "function") {
    timer.unref();
  }
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
