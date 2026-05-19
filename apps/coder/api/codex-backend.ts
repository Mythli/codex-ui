import {
  AppServerClient,
  type CodexProtocolResponse,
  type CodexProtocolTraffic,
  type CodexRequestMethod,
  type CodexRequestParams,
  type CodexTransport,
  type CodexTransportRequestOptions
} from "@taylordb/codex/server";
import {
  createAssetReplacementMiddleware,
  createLocalFileReadMiddleware,
  createTrafficMeasurementMiddleware
} from "./middlewares/index.js";
import { createCodexMiddlewareTransport } from "./createCodexMiddlewareTransport.js";
import {
  createCodexAssetRegistry,
  type CodexAssetRegistry
} from "./middlewares/assets/index.js";

const healthCheckIntervalMs = 10_000;

export const sharedCodexAssets = createCodexAssetRegistry();

let sharedBackend: CodexBackendSupervisor | undefined;

export function getSharedCodexBackend(
  assets: CodexAssetRegistry = sharedCodexAssets
): CodexBackendSupervisor {
  sharedBackend ??= new CodexBackendSupervisor({ assets });
  sharedBackend.start();
  return sharedBackend;
}

type SupervisedBackend = {
  client: AppServerClient & {
    requestInternal?: AppServerClient["request"];
  };
  transport: CodexTransport;
  unsubscribeDiagnostic: () => void;
  unsubscribeTraffic: () => void;
};

export class CodexBackendSupervisor implements CodexTransport {
  private backend?: SupervisedBackend;
  private healthTimer?: ReturnType<typeof setInterval>;
  private readyPromise?: Promise<CodexTransport>;
  private restarting = false;
  private shuttingDown = false;
  private readonly diagnosticListeners = new Set<(text: string) => void>();
  private readonly trafficListeners = new Set<(traffic: CodexProtocolTraffic) => void>();

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

  async request<M extends CodexRequestMethod>(
    method: M,
    params: CodexRequestParams<M>,
    options: CodexTransportRequestOptions = {}
  ): Promise<CodexProtocolResponse<M>> {
    await this.ensureReady("request");
    if (!this.backend) {
      throw new Error("Codex backend is not ready.");
    }
    return this.backend.transport.request(method, params, options);
  }

  async notify<M extends CodexRequestMethod>(method: M, params?: CodexRequestParams<M>): Promise<void> {
    await this.ensureReady("notify");
    if (!this.backend) {
      throw new Error("Codex backend is not ready.");
    }
    await this.backend.transport.notify(method, params);
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
}

export function createAppCodexMiddlewareTransport(
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

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return error;
}

function logBackendEvent(event: string, payload: unknown): void {
  console.info(`[codex backend] ${event}`, safeStringify(payload));
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function unrefTimer(timer: ReturnType<typeof setInterval>): void {
  const unref = (timer as ReturnType<typeof setInterval> & { unref?: () => void }).unref;
  unref?.call(timer);
}
