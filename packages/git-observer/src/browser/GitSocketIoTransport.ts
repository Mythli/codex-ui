import { io, type Socket } from "socket.io-client";
import type { GitSocketIoResponse, GitStreamEvent, GitTransport } from "../protocol.js";
import { gitErrorFromWire } from "../protocol.js";

export type GitSocketIoTransportOptions = {
  path?: string;
};

type GitSocket = Socket<{
  event: (event: GitStreamEvent) => void;
  diagnostic: (text: string) => void;
  closed: () => void;
}>;

export function createGitSocketIoTransport(
  socketOrNamespace: Socket | string = "/git",
  options: GitSocketIoTransportOptions = {}
): GitTransport {
  if (typeof socketOrNamespace === "string") {
    return new GitSocketIoTransport(io(socketOrNamespace, { path: options.path ?? "/app-socket" }));
  }
  return new GitSocketIoTransport(socketOrNamespace);
}

export class GitSocketIoTransport implements GitTransport {
  private eventListeners = new Set<(event: GitStreamEvent) => void>();
  private diagnosticListeners = new Set<(text: string) => void>();

  constructor(private readonly socket: Socket) {
    const typedSocket = socket as GitSocket;
    typedSocket.on("event", (event) => {
      for (const listener of this.eventListeners) {
        listener(event);
      }
    });
    typedSocket.on("diagnostic", (text) => {
      for (const listener of this.diagnosticListeners) {
        listener(text);
      }
    });
    typedSocket.on("closed", () => {
      for (const listener of this.diagnosticListeners) {
        listener("Git observer socket closed");
      }
    });
  }

  request<T = unknown>(method: string, params?: unknown): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.socket.emit("request", { method, params }, (response: GitSocketIoResponse) => {
        if (response.ok) {
          resolve(response.result as T);
        } else {
          reject(gitErrorFromWire(response.error));
        }
      });
    });
  }

  notify(method: string, params?: unknown): void {
    this.socket.emit("notify", { method, params });
  }

  onEvent(listener: (event: GitStreamEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  onDiagnostic(listener: (text: string) => void): () => void {
    this.diagnosticListeners.add(listener);
    return () => this.diagnosticListeners.delete(listener);
  }

  close(): void {
    this.socket.disconnect();
  }
}
