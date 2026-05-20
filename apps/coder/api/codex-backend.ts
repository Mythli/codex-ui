import { Agent } from "node:http";
import { createConnection } from "node:net";
import { CodexSocketIoTransport } from "@taylordb/codex/browser";
import {
  AppServerClient,
  type AppServerClientOptions,
  type CodexProtocolResponse,
  type CodexProtocolTraffic,
  type CodexRequestMethod,
  type CodexRequestParams,
  type CodexTransport,
  type CodexTransportRequestOptions
} from "@taylordb/codex/server";
import { io } from "socket.io-client";
import {
  createLocalFileReadMiddleware,
  createMarkdownRewriteMiddleware,
  createTrafficMeasurementMiddleware,
  type MarkdownRewriteHandler
} from "./middlewares/index.js";
import { createCodexMiddlewareTransport } from "./createCodexMiddlewareTransport.js";
import {
  type CodexAssetRegistry
} from "./middlewares/assets/index.js";

export type CoderApiLogger = {
  info: (event: string, payload: unknown) => void;
};

export type CodexBackendTransport = CodexTransport & {
  exitCode?: number | null;
  signal?: NodeJS.Signals | null;
  waitForClose?: () => Promise<void>;
};

export type CreateCodexBackendTransportInput = {
  codexBin?: string;
  onDiagnostic?: (text: string) => void;
};

export type CreateCodexBackendTransport = (
  input?: CreateCodexBackendTransportInput
) => CodexBackendTransport | Promise<CodexBackendTransport>;

export type LiveCodexBackendProviderOptions = {
  createTransport: CreateCodexBackendTransport;
  logger?: CoderApiLogger;
};

type LiveBackendRecord = {
  transport: CodexBackendTransport;
  unsubscribeDiagnostic: () => void;
  unsubscribeTraffic: () => void;
};

export class LiveCodexBackendProvider implements CodexTransport {
  private backend?: LiveBackendRecord;
  private readyPromise?: Promise<CodexBackendTransport>;
  private readonly diagnosticListeners = new Set<(text: string) => void>();
  private readonly trafficListeners = new Set<(traffic: CodexProtocolTraffic) => void>();

  constructor(private readonly options: LiveCodexBackendProviderOptions) {}

  async ensureReady(reason = "request"): Promise<CodexBackendTransport> {
    if (this.backend) {
      return this.backend.transport;
    }
    this.readyPromise ??= this.createBackend(reason).finally(() => {
      this.readyPromise = undefined;
    });
    return this.readyPromise;
  }

  async request<M extends CodexRequestMethod>(
    method: M,
    params: CodexRequestParams<M>,
    options: CodexTransportRequestOptions = {}
  ): Promise<CodexProtocolResponse<M>> {
    const transport = await this.ensureReady("request");
    return transport.request(method, params, options);
  }

  async notify<M extends CodexRequestMethod>(method: M, params?: CodexRequestParams<M>): Promise<void> {
    const transport = await this.ensureReady("notify");
    await transport.notify(method, params);
  }

  onTraffic(listener: (traffic: CodexProtocolTraffic) => void): () => void {
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
    this.disposeBackend("close");
  }

  private async createBackend(reason: string): Promise<CodexBackendTransport> {
    const startedAt = Date.now();
    this.log("codex:start", { reason });
    const transport = await this.options.createTransport({
      onDiagnostic: (text) => this.emitDiagnostic(text)
    });
    const record: LiveBackendRecord = {
      transport,
      unsubscribeDiagnostic: transport.onDiagnostic((text) => this.emitDiagnostic(text)),
      unsubscribeTraffic: transport.onTraffic((traffic) => this.emitTraffic(traffic))
    };
    this.backend = record;
    this.observeClose(record);
    this.log("codex:ready", {
      durationMs: Date.now() - startedAt,
      reason
    });
    return transport;
  }

  private observeClose(record: LiveBackendRecord): void {
    if (!record.transport.waitForClose) {
      return;
    }
    void record.transport.waitForClose().then(() => {
      if (this.backend !== record) {
        return;
      }
      this.log("codex:closed", {
        exitCode: record.transport.exitCode ?? null,
        signal: record.transport.signal ?? null
      });
      this.disposeBackend("closed", { closeTransport: false });
    });
  }

  private disposeBackend(reason: string, options: { closeTransport?: boolean } = {}): void {
    const backend = this.backend;
    this.backend = undefined;
    if (!backend) {
      return;
    }
    backend.unsubscribeDiagnostic();
    backend.unsubscribeTraffic();
    if (options.closeTransport !== false) {
      backend.transport.close();
    }
    this.log("codex:disposed", { reason });
  }

  private emitTraffic(traffic: CodexProtocolTraffic): void {
    for (const listener of this.trafficListeners) {
      listener(traffic);
    }
  }

  private emitDiagnostic(text: string): void {
    for (const listener of this.diagnosticListeners) {
      listener(text);
    }
  }

  private log(event: string, payload: unknown): void {
    this.options.logger?.info(event, payload);
  }
}

export type AppCodexMiddlewareTransportOptions = {
  assets: CodexAssetRegistry;
  hydrateRequestResponses?: boolean;
  markdownRewriteHandlers: readonly MarkdownRewriteHandler[];
  onDiagnostic?: (text: string) => void;
};

export function createAppCodexMiddlewareTransport(
  transport: CodexTransport,
  options: AppCodexMiddlewareTransportOptions
): CodexTransport {
  return createCodexMiddlewareTransport(
    transport,
    {
      hydrateRequestResponses: options.hydrateRequestResponses,
      onDiagnostic: options.onDiagnostic
    },
    createLocalFileReadMiddleware({
      transport,
      onDiagnostic: options.onDiagnostic
    }),
    createMarkdownRewriteMiddleware({
      assets: options.assets,
      handlers: options.markdownRewriteHandlers,
      onDiagnostic: options.onDiagnostic
    }),
    createTrafficMeasurementMiddleware({
      onDiagnostic: options.onDiagnostic
    })
  );
}

export type ManagedCodexBackendTransportOptions = {
  appServerArgs: string[];
  assets: CodexAssetRegistry;
  codexBin?: string;
  codexBinArgs: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  hydrateRequestResponses?: boolean;
  markdownRewriteHandlers: readonly MarkdownRewriteHandler[];
};

export async function createManagedCodexBackendTransport(
  options: ManagedCodexBackendTransportOptions,
  input: CreateCodexBackendTransportInput = {}
): Promise<CodexBackendTransport> {
  const client = new AppServerClient(input.codexBin ?? options.codexBin, {
    appServerArgs: options.appServerArgs,
    codexBinArgs: options.codexBinArgs,
    cwd: options.cwd,
    env: options.env
  } satisfies AppServerClientOptions);
  const transport = createAppCodexMiddlewareTransport(client, {
    assets: options.assets,
    hydrateRequestResponses: options.hydrateRequestResponses,
    markdownRewriteHandlers: options.markdownRewriteHandlers,
    onDiagnostic: input.onDiagnostic
  });
  await initializeTransport(transport);
  return withManagedLifecycle(transport, client);
}

export type SocketCodexBackendTransportOptions = {
  assets: CodexAssetRegistry;
  hydrateRequestResponses?: boolean;
  markdownRewriteHandlers: readonly MarkdownRewriteHandler[];
  socketPath: string;
  unixSocketPath?: string;
  url: string;
};

export async function createSocketCodexBackendTransport(
  options: SocketCodexBackendTransportOptions,
  input: CreateCodexBackendTransportInput = {}
): Promise<CodexBackendTransport> {
  const socketOptions: Record<string, unknown> = {
    autoConnect: false,
    forceNew: true,
    path: options.socketPath,
    reconnection: false
  };

  if (options.unixSocketPath) {
    socketOptions.agent = unixSocketAgent(options.unixSocketPath);
    socketOptions.transports = ["polling"];
  }

  const socketTransport = new CodexSocketIoTransport(io(options.url, socketOptions));
  const transport = createAppCodexMiddlewareTransport(socketTransport, {
    assets: options.assets,
    hydrateRequestResponses: options.hydrateRequestResponses,
    markdownRewriteHandlers: options.markdownRewriteHandlers,
    onDiagnostic: input.onDiagnostic
  });
  return transport;
}

function withManagedLifecycle(
  transport: CodexTransport,
  client: AppServerClient
): CodexBackendTransport {
  return Object.defineProperties(transport, {
    exitCode: {
      get: () => client.exitCode
    },
    signal: {
      get: () => client.signal
    },
    waitForClose: {
      value: () => client.waitForClose()
    }
  }) as CodexBackendTransport;
}

async function initializeTransport(transport: CodexTransport): Promise<void> {
  const initializable = transport as CodexTransport & { initialize?: () => Promise<void> };
  await initializable.initialize?.();
}

function unixSocketAgent(socketPath: string): Agent {
  const agent = new Agent({ keepAlive: true });
  agent.createConnection = () => createConnection(socketPath);
  return agent;
}
