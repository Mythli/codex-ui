import type {
  CodexParsedFsReadFileResponse,
  CodexProtocolResponse,
  CodexProtocolTraffic,
  CodexRequestMethod,
  CodexRequestParams
} from "@taylordb/codex/protocol";

export type CodexMiddlewareContext = {
  cwd?: string;
  diagnostic?: (text: string) => void;
  readFile: (path: string) => Promise<CodexParsedFsReadFileResponse | undefined>;
};

export type CodexMiddlewareRequest<M extends CodexRequestMethod = CodexRequestMethod> = {
  method: M;
  params: CodexRequestParams<M>;
};

export type CodexMiddlewareHandledResponse<M extends CodexRequestMethod = CodexRequestMethod> = {
  type: "handled";
  request: CodexMiddlewareRequest<M>;
  response: CodexProtocolResponse<M>;
};

export type CodexMiddlewareRequestResult<M extends CodexRequestMethod = CodexRequestMethod> =
  | CodexMiddlewareRequest<M>
  | CodexMiddlewareHandledResponse<M>
  | undefined;

export type CodexProtocolMiddleware<
  InputTraffic extends CodexProtocolTraffic = CodexProtocolTraffic,
  OutputTraffic extends CodexProtocolTraffic = InputTraffic
> = {
  name: string;
  request?<M extends CodexRequestMethod>(
    request: CodexMiddlewareRequest<M>,
    context: CodexMiddlewareContext
  ): CodexMiddlewareRequestResult<M> | Promise<CodexMiddlewareRequestResult<M>>;
  response?<M extends CodexRequestMethod>(
    request: CodexMiddlewareRequest<M>,
    response: CodexProtocolResponse<M>,
    context: CodexMiddlewareContext
  ): CodexProtocolResponse<M> | Promise<CodexProtocolResponse<M>>;
  traffic?(
    traffic: InputTraffic,
    context: CodexMiddlewareContext
  ): OutputTraffic | Promise<OutputTraffic>;
};

export type MiddlewarePipelineInput<T extends readonly CodexProtocolMiddleware[]> =
  T extends readonly [CodexProtocolMiddleware<infer Input, CodexProtocolTraffic>, ...readonly CodexProtocolMiddleware[]]
    ? Input
    : CodexProtocolTraffic;

export type MiddlewarePipelineOutput<T extends readonly CodexProtocolMiddleware[]> =
  T extends readonly []
    ? CodexProtocolTraffic
    : T extends readonly [CodexProtocolMiddleware<CodexProtocolTraffic, infer Output>]
      ? Output
      : T extends readonly [CodexProtocolMiddleware<CodexProtocolTraffic, CodexProtocolTraffic>, ...infer Rest]
        ? Rest extends readonly CodexProtocolMiddleware[]
          ? MiddlewarePipelineOutput<Rest>
          : CodexProtocolTraffic
        : CodexProtocolTraffic;
