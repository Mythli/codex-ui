import { io, type Socket } from "socket.io-client";
import type { CodexTransport } from "../core/transport/CodexTransport.js";
import type { CodexTransportRequestOptions } from "../core/transport/CodexTransport.js";
import {
  type CodexProtocolResponse,
  type CodexProtocolTraffic,
  type CodexRequestMethod,
  type CodexRequestParams
} from "../protocol/stream/index.js";
import { CodexTransportError } from "../utils/errors.js";

type SocketIoResponse =
  | { ok: true; result: unknown }
  | { ok: false; error: unknown };

type CodexSocket = Socket<{
  traffic: (traffic: CodexProtocolTraffic) => void;
  diagnostic: (text: string) => void;
  closed: (payload?: { exitCode: number | null; signal: string | null }) => void;
}>;

export type CodexSocketIoTransportOptions = {
  path?: string;
};

export function createCodexSocketIoTransport(
  socketOrNamespace: Socket | string = "/codex",
  options: CodexSocketIoTransportOptions = {}
): CodexTransport {
  if (typeof socketOrNamespace === "string") {
    return new CodexSocketIoTransport(io(socketOrNamespace, { path: options.path ?? "/app-socket" }));
  }
  return new CodexSocketIoTransport(socketOrNamespace);
}

export class CodexSocketIoTransport implements CodexTransport {
  private initialized = false;
  private trafficListeners = new Set<(traffic: CodexProtocolTraffic) => void>();
  private diagnosticListeners = new Set<(text: string) => void>();

  constructor(private readonly socket: Socket) {
    const typedSocket = socket as CodexSocket;
    typedSocket.on("traffic", (traffic) => {
      this.emitTraffic(traffic);
    });
    typedSocket.on("diagnostic", (text) => {
      this.emitDiagnostic(text);
    });
    typedSocket.on("closed", (payload) => {
      const detail = payload ? ` (${payload.exitCode ?? "null"}, ${payload.signal ?? "null"})` : "";
      this.emitDiagnostic(`Codex socket closed${detail}`);
      this.initialized = false;
    });
    typedSocket.on("disconnect", () => {
      this.initialized = false;
    });
  }

  async request<M extends CodexRequestMethod>(
    method: M,
    params: CodexRequestParams<M>,
    options: CodexTransportRequestOptions = {}
  ): Promise<CodexProtocolResponse<M>> {
    await this.initialize();
    return this.sendRequest(method, params, options);
  }

  async notify<M extends CodexRequestMethod>(method: M, params?: CodexRequestParams<M>): Promise<void> {
    await this.initialize();
    this.socket.emit("notify", { method, params });
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
    if (this.socket.connected) {
      this.socket.emit("close");
    }
    this.socket.disconnect();
    this.initialized = false;
  }

  private async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.connect();
    await this.sendSocketInitialize();
    this.initialized = true;
  }

  private connect(): Promise<void> {
    if (this.socket.connected) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.socket.once("connect", () => resolve());
      this.socket.once("connect_error", (error) => {
        reject(new CodexTransportError("Codex Socket.IO failed to connect", error));
      });
      this.socket.connect();
    });
  }

  private sendRequest<M extends CodexRequestMethod>(
    method: M,
    params: CodexRequestParams<M>,
    options: CodexTransportRequestOptions = {}
  ): Promise<CodexProtocolResponse<M>> {
    return new Promise<CodexProtocolResponse<M>>((resolve, reject) => {
      this.socket.emit("request", { method, params, metadata: options.metadata }, (response: SocketIoResponse) => {
        if (response.ok) {
          resolve(response.result as CodexProtocolResponse<M>);
        } else {
          reject(errorFromWire(response.error));
        }
      });
    });
  }

  private sendSocketInitialize(): Promise<void> {
    const params: CodexRequestParams<"initialize"> = {
      clientInfo: { name: "codex-browser", version: "0.1.0" },
      capabilities: { experimentalApi: true }
    };
    return new Promise<void>((resolve, reject) => {
      this.socket.emit("request", { method: "initialize", params }, (response: SocketIoResponse) => {
        if (response.ok) {
          resolve();
        } else {
          reject(errorFromWire(response.error));
        }
      });
    });
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

function errorFromWire(value: unknown): Error {
  if (value && typeof value === "object" && "message" in value && typeof value.message === "string") {
    const error = new CodexTransportError(value.message);
    if ("stack" in value && typeof value.stack === "string") {
      error.stack = value.stack;
    }
    return error;
  }
  return new CodexTransportError(String(value));
}
