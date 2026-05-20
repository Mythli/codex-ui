import type { CodexTransport } from "./types/index.js";
import { Server as SocketIoServer, type Namespace } from "socket.io";
import type { HttpServer } from "vite";
import {
  createManagedCodexBackendTransport,
  createSocketCodexBackendTransport,
  LiveCodexBackendProvider,
  type CoderApiLogger,
  type CreateCodexBackendTransport
} from "./backend/backendProvider.js";
import { AppCodexSessionRegistry, attachAppCodexNamespace } from "./backend/socketNamespace.js";
import { createAssetHelper } from "./assets/index.js";
import {
  createCodexProtocolMiddlewareStack,
  type CodexProtocolMiddlewareStackFactory,
  rewriteMarkdownImageUrls,
  rewriteMarkdownLocalFileLinks
} from "./middlewares/index.js";
import { parseCoderApiEnv, type CoderApiEnv } from "./env.js";

export function createCoderApiDependencies(
  options: {
    env?: CoderApiEnv;
    logger?: CoderApiLogger;
    processEnv?: NodeJS.ProcessEnv;
  } = {}
) {
  const processEnv = options.processEnv ?? process.env;
  const env = options.env ?? parseCoderApiEnv(processEnv);
  const logger = options.logger ?? consoleCoderApiLogger;
  const markdownRewriteHandlers = [
    rewriteMarkdownImageUrls,
    rewriteMarkdownLocalFileLinks
  ];
  const assetHelper = createAssetHelper({
    cacheDir: env.assetCacheDir,
    routeBase: env.assetRouteBase
  });
  const createMiddlewareStack: CodexProtocolMiddlewareStackFactory = (input) => createCodexProtocolMiddlewareStack({
    ...input,
    assetHelper,
    markdownRewriteHandlers
  });
  const childProcessEnv = {
    ...processEnv,
    CODEX_HOME: env.codexHome
  };
  const createBackendTransport: CreateCodexBackendTransport = (input = {}) => {
    const useManagedTransport = env.backendTransport === "managed" || Boolean(input.codexBin);
    if (useManagedTransport) {
      return createManagedCodexBackendTransport({
        appServerArgs: env.appServerArgs,
        codexBin: env.codexBin,
        codexBinArgs: env.codexBinArgs,
        createMiddlewareStack,
        env: childProcessEnv,
        hydrateRequestResponses: false
      }, input);
    }

    if (!env.appServerUrl) {
      throw new Error("CODEX_APP_SERVER_URL is required when CODEX_BACKEND_TRANSPORT=socket");
    }
    return createSocketCodexBackendTransport({
      createMiddlewareStack,
      hydrateRequestResponses: false,
      socketPath: env.appServerSocketPath,
      unixSocketPath: env.appServerUnixSocketPath,
      url: env.appServerUrl
    }, input);
  };

  const liveBackend = new LiveCodexBackendProvider({
    createTransport: createBackendTransport,
    logger
  });
  const sessions = new AppCodexSessionRegistry({
    largeOutgoingPacketBytes: env.socketLargeOutgoingPacketBytes,
    logger,
    shouldCloseBackend: (backend: CodexTransport) => backend !== liveBackend
  });

  return {
    assetHelper,
    attachCodexNamespace: (namespace: Namespace) => attachAppCodexNamespace(namespace, {
      createBackendTransport,
      largeOutgoingPacketBytes: env.socketLargeOutgoingPacketBytes,
      liveBackend,
      logger,
      requestTimeoutMs: env.socketRequestTimeoutMs,
      sessions,
      slowNotifyMs: env.socketSlowNotifyMs,
      slowRequestMs: env.socketSlowRequestMs
    }),
    createSocketServer: (httpServer: HttpServer, path?: string) => new SocketIoServer(httpServer, {
      path: path ?? env.socketPath,
      cors: {
        origin: true
      }
    }),
    liveBackend
  };
}

const globalDependencies = globalThis as typeof globalThis & {
  __coderApiDependencies?: ReturnType<typeof createCoderApiDependencies>;
};

export function getDependencies() {
  globalDependencies.__coderApiDependencies ??= createCoderApiDependencies();
  return globalDependencies.__coderApiDependencies;
}

export const consoleCoderApiLogger: CoderApiLogger = {
  info: (event, payload) => {
    console.info(`[codex backend] ${event}`, safeStringify(payload));
  }
};

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
