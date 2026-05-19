import type { Namespace, Socket } from "socket.io";
import type { CodexTransport } from "../core/transport/CodexTransport.js";
import { parseCodexRequestParams, type CodexRequestMethod, type CodexRequestParams } from "../protocol/stream/index.js";
import { AppServerClient } from "./AppServerClient.js";

type SocketRequest = {
  method: string;
  params?: unknown;
  codexBin?: string;
};

type SocketIoResponse =
  | { ok: true; result: unknown }
  | { ok: false; error: unknown };

type RequestAck = (response: SocketIoResponse) => void;

export type CodexSocketIoServerOptions = {};

export function attachCodexNamespace(namespace: Namespace, options: CodexSocketIoServerOptions = {}): CodexSocketIoServer {
  const server = new CodexSocketIoServer(namespace, options);
  server.attach();
  return server;
}

export class CodexSocketIoServer {
  private client?: AppServerClient;
  private transport?: CodexTransport;
  private initializePromise?: Promise<void>;

  constructor(
    private readonly namespace: Namespace,
    private readonly options: CodexSocketIoServerOptions = {}
  ) {}

  attach(): void {
    this.namespace.on("connection", (socket) => this.attachSocket(socket));
  }

  close(): void {
    this.client?.close();
    this.client = undefined;
    this.transport = undefined;
    this.initializePromise = undefined;
    this.namespace.emit("closed", { exitCode: null, signal: null });
  }

  private attachSocket(socket: Socket): void {
    socket.on("request", (request: SocketRequest, ack: RequestAck) => {
      void this.handleRequest(request)
        .then((result) => ack({ ok: true, result }))
        .catch((error: unknown) => ack({ ok: false, error: serializeError(error) }));
    });

    socket.on("notify", (request: SocketRequest) => {
      void this.handleNotify(request).catch((error: unknown) => {
        socket.emit("diagnostic", String(error instanceof Error ? error.message : error));
      });
    });

    socket.on("close", () => this.close());
  }

  private async handleRequest(request: SocketRequest): Promise<unknown> {
    if (request.method === "initialize") {
      await this.ensureClient(request.codexBin);
      return { initialized: true };
    }

    const transport = await this.ensureClient();
    const method = request.method as CodexRequestMethod;
    return transport.request(method, requestParams(method, request.params));
  }

  private async handleNotify(request: SocketRequest): Promise<void> {
    const transport = await this.ensureClient();
    await transport.notify(request.method as CodexRequestMethod, request.params as CodexRequestParams<CodexRequestMethod> | undefined);
  }

  private async ensureClient(codexBin?: string): Promise<CodexTransport> {
    if (this.client && this.transport) {
      await this.initializePromise;
      return this.transport;
    }

    const client = new AppServerClient(codexBin);
    this.client = client;
    const transport = client;
    this.transport = transport;
    transport.onTraffic((traffic) => {
      this.namespace.emit("traffic", traffic);
    });
    transport.onDiagnostic((text) => this.namespace.emit("diagnostic", text));
    this.initializePromise = client.initialize();

    void client.waitForClose().then(() => {
      this.namespace.emit("closed", { exitCode: client.exitCode, signal: client.signal });
      if (this.client === client) {
        this.client = undefined;
        this.transport = undefined;
        this.initializePromise = undefined;
      }
    });

    await this.initializePromise;
    return transport;
  }
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return error;
}

function requestParams<M extends CodexRequestMethod>(method: M, params: unknown): CodexRequestParams<M> {
  return parseCodexRequestParams(method, params ?? {});
}
