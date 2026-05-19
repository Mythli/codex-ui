import type { Namespace, Server, Socket } from "socket.io";
import type {
  AppCodexSessionContext,
  AppCodexSessionRegistry
} from "../codex-socket.js";
import { FixtureCodexBackend } from "./FixtureCodexBackend.js";
import {
  findFixturePlaybackDefinition,
  fixtureIdFromSearch,
  fixturePlaybackOptions
} from "./fixtures.js";
import type { FixturePlaybackMode, FixturePlaybackStatus } from "./types.js";

type ControlRequest = {
  method: string;
  params?: Record<string, unknown>;
};

type ControlResponse =
  | { ok: true; result: unknown }
  | { ok: false; error: { message: string } };

type ControlAck = (response: ControlResponse) => void;

export type FixturePlaybackHandle = {
  close(): void;
};

export function attachFixturePlayback(input: {
  io: Server;
  sessions: AppCodexSessionRegistry;
}): FixturePlaybackHandle {
  const namespace = input.io.of("/fixture-control");
  const server = new FixturePlaybackControlServer(namespace, input.sessions);
  server.attach();
  input.sessions.useBackendResolver((context) => server.backendFromSessionContext(context));
  return {
    close: () => namespace.removeAllListeners()
  };
}

class FixturePlaybackControlServer {
  private readonly backendsBySessionId = new Map<string, FixtureCodexBackend>();
  private readonly controlSocketsBySessionId = new Map<string, Set<Socket>>();

  constructor(
    private readonly namespace: Namespace,
    private readonly sessions: AppCodexSessionRegistry
  ) {}

  attach(): void {
    this.namespace.on("connection", (socket) => this.attachSocket(socket));
  }

  backendFromSessionContext(context: AppCodexSessionContext): FixtureCodexBackend | undefined {
    const existing = this.backendsBySessionId.get(context.id);
    if (existing) {
      return existing;
    }

    const fixtureId = fixtureIdFromSearch(context.auth.locationSearch);
    return this.selectBackend(context.id, fixtureId)?.backend;
  }

  private attachSocket(socket: Socket): void {
    const sessionId = appSessionId(socket);
    const controls = this.controlSocketsBySessionId.get(sessionId) ?? new Set<Socket>();
    controls.add(socket);
    this.controlSocketsBySessionId.set(sessionId, controls);
    socket.once("disconnect", () => controls.delete(socket));

    socket.on("request", (request: ControlRequest, ack: ControlAck) => {
      void this.handleRequest(sessionId, request)
        .then((result) => ack({ ok: true, result }))
        .catch((error: unknown) => ack({
          ok: false,
          error: { message: error instanceof Error ? error.message : String(error) }
        }));
    });
  }

  private async handleRequest(sessionId: string, request: ControlRequest): Promise<unknown> {
    switch (request.method) {
      case "list":
        return fixturePlaybackOptions();
      case "status":
        return this.backendOrSelectFromParams(sessionId, request.params).status();
      case "select":
        return this.selectBackend(sessionId, stringParam(request.params, "fixtureId"))?.status ??
          this.missingFixture(stringParam(request.params, "fixtureId"));
      case "play":
        return this.backendOrSelectFromParams(sessionId, request.params).play(playbackMode(request.params));
      case "reset":
        return this.backendOrSelectFromParams(sessionId, request.params).reset();
      case "seek":
        return this.backendOrSelectFromParams(sessionId, request.params).seek(numberParam(request.params, "step") ?? 0);
      case "setDelay":
        return this.backendOrSelectFromParams(sessionId, request.params).setDelayMs(numberParam(request.params, "delayMs") ?? 80);
      default:
        throw new Error(`Unknown fixture control method: ${request.method}`);
    }
  }

  private backendOrSelectFromParams(sessionId: string, params: Record<string, unknown> | undefined): FixtureCodexBackend {
    const existing = this.backendsBySessionId.get(sessionId);
    if (existing) {
      return existing;
    }
    const selected = this.selectBackend(sessionId, stringParam(params, "fixtureId"));
    if (!selected) {
      throw new Error("No fixture playback is selected");
    }
    return selected.backend;
  }

  private selectBackend(sessionId: string, fixtureId: string | undefined): { backend: FixtureCodexBackend; status: FixturePlaybackStatus } | undefined {
    const definition = findFixturePlaybackDefinition(fixtureId);
    if (!definition) {
      return undefined;
    }
    const backend = new FixtureCodexBackend(definition, {
      onStatus: (status) => this.emitStatus(sessionId, status)
    });
    this.backendsBySessionId.set(sessionId, backend);
    this.sessions.setBackend(sessionId, backend);
    const status = backend.status();
    this.emitStatus(sessionId, status);
    return { backend, status };
  }

  private missingFixture(fixtureId: string | undefined): never {
    throw new Error(`Unknown fixture playback: ${fixtureId ?? "(missing)"}`);
  }

  private emitStatus(sessionId: string, status: FixturePlaybackStatus): void {
    const sockets = this.controlSocketsBySessionId.get(sessionId);
    if (!sockets) {
      return;
    }
    for (const socket of sockets) {
      socket.emit("status", status);
    }
  }
}

function appSessionId(socket: Socket): string {
  const auth = socket.handshake.auth;
  if (auth && typeof auth === "object" && "appSessionId" in auth && typeof auth.appSessionId === "string") {
    return auth.appSessionId;
  }
  return socket.id;
}

function stringParam(params: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = params?.[key];
  return typeof value === "string" ? value : undefined;
}

function numberParam(params: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = params?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function playbackMode(params: Record<string, unknown> | undefined): FixturePlaybackMode | undefined {
  const value = params?.mode;
  return value === "live" || value === "loaded" ? value : undefined;
}
