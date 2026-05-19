import type {
  CodexParsedFsReadFileResponse,
  CodexProtocolResponse,
  CodexProtocolTraffic,
  CodexRequestMethod,
  CodexRequestParams
} from "@taylordb/codex/protocol";
import {
  CodexTrafficPacket,
  parseCodexProtocolErrorResponseTraffic,
  parseCodexProtocolRequestTraffic,
  parseCodexProtocolResponseTraffic
} from "@taylordb/codex/protocol";
import type { CodexTransport } from "@taylordb/codex/server";
import type {
  CodexMiddlewareContext,
  CodexMiddlewareHandledResponse,
  CodexMiddlewareRequest,
  CodexMiddlewareRequestResult,
  CodexProtocolMiddleware,
  MiddlewarePipelineInput,
  MiddlewarePipelineOutput
} from "./middlewares/types.js";
import {
  readCodexFileWithDiagnostics,
  requestCwd,
  responseCwd
} from "./middlewares/local-file-read-middleware.js";

export type CodexMiddlewareTransportOptions = {
  cwd?: string;
  hydrateRequestResponses?: boolean;
  onDiagnostic?: (text: string) => void;
};

export function createCodexMiddlewareTransport<const T extends readonly CodexProtocolMiddleware[]>(
  transport: CodexTransport,
  options: CodexMiddlewareTransportOptions,
  ...middleware: T
): CodexTransport & {
  readonly middleware: T;
  readonly __middlewareInput?: MiddlewarePipelineInput<T>;
  readonly __middlewareOutput?: MiddlewarePipelineOutput<T>;
} {
  return new CodexMiddlewareTransport(transport, options, middleware) as unknown as CodexTransport & {
    readonly middleware: T;
    readonly __middlewareInput?: MiddlewarePipelineInput<T>;
    readonly __middlewareOutput?: MiddlewarePipelineOutput<T>;
  };
}

class CodexMiddlewareTransport implements CodexTransport {
  private readonly cwdByThreadId = new Map<string, string>();
  private readonly trafficListeners = new Set<(traffic: CodexProtocolTraffic) => void>();
  private readonly requestParamsById = new Map<string, CodexMiddlewareRequest>();

  constructor(
    private readonly transport: CodexTransport,
    private readonly options: CodexMiddlewareTransportOptions,
    readonly middleware: readonly CodexProtocolMiddleware[]
  ) {}

  async request<M extends CodexRequestMethod>(method: M, params: CodexRequestParams<M>): Promise<CodexProtocolResponse<M>> {
    const cwd = requestCwd(params) ?? this.options.cwd;
    const context = this.context(cwd);
    const middlewareResult = await this.applyRequestMiddleware({ method, params }, context);

    if (isHandledResponse(middlewareResult)) {
      this.rememberCwd(middlewareResult.request.params);
      return this.emitHandledResponse(middlewareResult, context);
    }

    const nextRequest = middlewareResult ?? { method, params };
    this.rememberCwd(nextRequest.params);
    const response = await this.transport.request(nextRequest.method, nextRequest.params);
    return this.applyResponseMiddleware(
      nextRequest,
      response,
      this.context(responseCwd(response) ?? cwd)
    ) as Promise<CodexProtocolResponse<M>>;
  }

  async notify<M extends CodexRequestMethod>(method: M, params?: CodexRequestParams<M>): Promise<void> {
    const initialRequest = params ? { method, params } : undefined;
    const nextRequest = initialRequest
      ? await this.applyRequestMiddleware(initialRequest, this.context(requestCwd(initialRequest.params) ?? this.options.cwd))
      : initialRequest;
    if (isHandledResponse(nextRequest)) {
      await this.emitHandledResponse(nextRequest, this.context(requestCwd(nextRequest.request.params) ?? this.options.cwd));
      return;
    }
    if (nextRequest) {
      this.rememberCwd(nextRequest.params);
      await this.transport.notify(nextRequest.method, nextRequest.params);
      return;
    }
    await this.transport.notify(method, params);
  }

  onTraffic(listener: (traffic: CodexProtocolTraffic) => void): () => void {
    this.trafficListeners.add(listener);
    const unsubscribe = this.transport.onTraffic((traffic) => {
      const packet = CodexTrafficPacket.from(traffic);
      const cwd = packet.cwd ?? (packet.threadId ? this.cwdByThreadId.get(packet.threadId) : undefined) ?? this.options.cwd;
      this.rememberTrafficCwd(packet);
      void this.applyTrafficMiddleware(traffic, this.context(cwd)).then(listener);
    });
    return () => {
      this.trafficListeners.delete(listener);
      unsubscribe();
    };
  }

  onDiagnostic(listener: (text: string) => void): () => void {
    return this.transport.onDiagnostic(listener);
  }

  close(): void {
    this.transport.close();
  }

  async initialize(): Promise<void> {
    const initializable = this.transport as CodexTransport & { initialize?: () => Promise<void> };
    await initializable.initialize?.();
  }

  assertFullyConsumed(): void {
    const replay = this.transport as CodexTransport & { assertFullyConsumed?: () => void };
    replay.assertFullyConsumed?.();
  }

  private context(cwd?: string): CodexMiddlewareContext {
    return {
      cwd,
      diagnostic: this.options.onDiagnostic,
      readFile: (path) => this.options.hydrateRequestResponses === false
        ? Promise.resolve(undefined)
        : readCodexFileWithDiagnostics({
          method: "fs/readFile",
          params: { path },
          transport: this.transport,
          diagnostic: this.options.onDiagnostic
        }) as Promise<CodexParsedFsReadFileResponse>
    };
  }

  private async applyRequestMiddleware<M extends CodexRequestMethod>(
    request: CodexMiddlewareRequest<M>,
    context: CodexMiddlewareContext
  ): Promise<CodexMiddlewareRequest<M> | CodexMiddlewareHandledResponse<M> | undefined> {
    let next: CodexMiddlewareRequest<M> | undefined = request;
    for (const middleware of this.middleware) {
      if (!next) {
        return undefined;
      }
      const result = await middleware.request?.(next, context) as CodexMiddlewareRequestResult<M>;
      if (isHandledResponse(result)) {
        return result;
      }
      next = result ?? next;
    }
    return next;
  }

  private async applyResponseMiddleware<M extends CodexRequestMethod>(
    request: CodexMiddlewareRequest<M>,
    response: CodexProtocolResponse<M>,
    context: CodexMiddlewareContext
  ): Promise<CodexProtocolResponse<M>> {
    let next = response;
    for (const middleware of this.middleware) {
      const result = await middleware.response?.(request, next, context) as CodexProtocolResponse<M> | undefined;
      next = result ?? next;
    }
    return next;
  }

  private async applyTrafficMiddleware(
    traffic: CodexProtocolTraffic,
    context: CodexMiddlewareContext
  ): Promise<CodexProtocolTraffic> {
    if (traffic.kind === "request") {
      const result = await this.applyRequestMiddleware({
        method: traffic.method,
        params: traffic.params
      }, context);
      if (isHandledResponse(result)) {
        return traffic;
      }
      const request = result ?? { method: traffic.method, params: traffic.params };
      this.rememberCwd(request.params);
      this.requestParamsById.set(traffic.id, request);
      return this.applyWholeTrafficMiddleware({ ...traffic, params: request.params } as CodexProtocolTraffic, context);
    }

    if (traffic.kind === "response") {
      const request = this.requestParamsById.get(traffic.id);
      this.requestParamsById.delete(traffic.id);
      const response = request?.method === traffic.method
        ? await this.applyResponseMiddleware(request, traffic.response, context)
        : traffic.response;
      return this.applyWholeTrafficMiddleware({ ...traffic, response } as CodexProtocolTraffic, context);
    }

    if (traffic.kind === "responseError") {
      this.requestParamsById.delete(traffic.id);
    }

    return this.applyWholeTrafficMiddleware(traffic, context);
  }

  private async applyWholeTrafficMiddleware(
    traffic: CodexProtocolTraffic,
    context: CodexMiddlewareContext
  ): Promise<CodexProtocolTraffic> {
    let next = traffic;
    for (const middleware of this.middleware) {
      next = await middleware.traffic?.(next, context) ?? next;
    }
    return next;
  }

  private async emitHandledResponse<M extends CodexRequestMethod>(
    handled: CodexMiddlewareHandledResponse<M>,
    context: CodexMiddlewareContext
  ): Promise<CodexProtocolResponse<M>> {
    const requestTraffic = parseCodexProtocolRequestTraffic(handled.request.method, handled.request.params, {
      timestampMs: Date.now()
    });
    await this.emitLocalTraffic(requestTraffic, context);
    try {
      const response = await this.applyResponseMiddleware(handled.request, handled.response, context);
      await this.emitLocalTraffic(parseCodexProtocolResponseTraffic(handled.request.method, response, {
        id: requestTraffic.id,
        timestampMs: Date.now()
      }), context);
      return response;
    } catch (error) {
      await this.emitLocalTraffic(parseCodexProtocolErrorResponseTraffic(handled.request.method, serializeError(error), {
        id: requestTraffic.id,
        timestampMs: Date.now()
      }), context);
      throw error;
    }
  }

  private async emitLocalTraffic(
    traffic: CodexProtocolTraffic,
    context: CodexMiddlewareContext
  ): Promise<void> {
    const transformed = await this.applyWholeTrafficMiddleware(traffic, context);
    for (const listener of this.trafficListeners) {
      listener(transformed);
    }
  }

  private rememberCwd(params: object): void {
    if (!("threadId" in params) || typeof params.threadId !== "string" || !("cwd" in params) || typeof params.cwd !== "string") {
      return;
    }
    this.cwdByThreadId.set(params.threadId, params.cwd);
  }

  private rememberTrafficCwd(packet: CodexTrafficPacket): void {
    if (packet.threadId && packet.cwd) {
      this.cwdByThreadId.set(packet.threadId, packet.cwd);
    }
  }
}

function isHandledResponse<M extends CodexRequestMethod>(
  value: CodexMiddlewareRequest<M> | CodexMiddlewareHandledResponse<M> | undefined
): value is CodexMiddlewareHandledResponse<M> {
  return Boolean(value && "type" in value && value.type === "handled");
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }
  return { message: String(error) };
}
