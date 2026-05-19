import { z } from "zod";
import {
  asRecord,
  codexRequestIdSchema,
  stableTrafficId,
  type RecordValue
} from "./common.js";
import {
  parseCodexNotification,
  unknownEventFromValue,
  type CodexProtocolEvent
} from "./events.js";
import {
  codexRequestSchemasByMethod,
  type CodexRequestMethod,
  type CodexRequestParamsByMethod
} from "./requests.js";
import {
  codexResponseSchemasByMethod,
  type CodexResponseByMethod
} from "./responses.js";

export type {
  CodexKnownRequestMethod,
  CodexRequestMethod,
  CodexRequestParamsByMethod
} from "./requests.js";
export type { CodexResponseByMethod } from "./responses.js";

export type CodexUnknownRequest = {
  method: string;
  params: RecordValue;
  readonly __codexUnknownRequest: true;
};

export type CodexUnknownResponse = {
  method: string;
  payload: RecordValue;
  readonly __codexUnknownResponse: true;
};

export type CodexRequestParams<M extends CodexRequestMethod> =
  M extends keyof CodexRequestParamsByMethod ? CodexRequestParamsByMethod[M] : RecordValue;

export type CodexProtocolResponse<M extends CodexRequestMethod> =
  M extends keyof CodexResponseByMethod ? CodexResponseByMethod[M] : CodexUnknownResponse;

export type CodexProtocolMetadata = {
  clientRequestId?: string;
} & RecordValue;

export type CodexProtocolTrafficContext = {
  id?: string | number;
  metadata?: CodexProtocolMetadata;
  timestampMs?: number;
};

export type CodexProtocolRequestTraffic<M extends CodexRequestMethod = CodexRequestMethod> = {
  kind: "request";
  id: string;
  method: M;
  params: CodexRequestParams<M>;
  metadata?: CodexProtocolMetadata;
  timestampMs?: number;
};

export type CodexProtocolResponseTraffic<M extends CodexRequestMethod = CodexRequestMethod> = {
  kind: "response";
  id: string;
  method: M;
  response: CodexProtocolResponse<M>;
  metadata?: CodexProtocolMetadata;
  timestampMs?: number;
};

export type CodexProtocolErrorResponseTraffic<M extends CodexRequestMethod = CodexRequestMethod> = {
  kind: "responseError";
  id: string;
  method: M;
  error: RecordValue;
  metadata?: CodexProtocolMetadata;
  timestampMs?: number;
};

export type CodexProtocolEventTraffic = {
  kind: "event";
  event: CodexProtocolEvent;
  timestampMs?: number;
};

export type CodexProtocolServerRequestTraffic = {
  kind: "serverRequest";
  id: string;
  method: string;
  params: RecordValue;
  metadata?: CodexProtocolMetadata;
  timestampMs?: number;
};

export type CodexProtocolDiagnosticTraffic = {
  kind: "diagnostic";
  text: string;
  timestampMs?: number;
};

type CodexProtocolTrafficShape =
  | CodexProtocolRequestTraffic
  | CodexProtocolResponseTraffic
  | CodexProtocolErrorResponseTraffic
  | CodexProtocolEventTraffic
  | CodexProtocolServerRequestTraffic
  | CodexProtocolDiagnosticTraffic;

const codexProtocolRequestTrafficInputSchema = z.object({
  kind: z.literal("request"),
  id: codexRequestIdSchema,
  method: z.string(),
  params: z.unknown(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  timestampMs: z.number().optional()
}).passthrough();

const codexProtocolResponseTrafficInputSchema = z.object({
  kind: z.literal("response"),
  id: codexRequestIdSchema,
  method: z.string(),
  response: z.unknown(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  timestampMs: z.number().optional()
}).passthrough();

const codexProtocolErrorResponseTrafficInputSchema = z.object({
  kind: z.literal("responseError"),
  id: codexRequestIdSchema,
  method: z.string(),
  error: z.unknown(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  timestampMs: z.number().optional()
}).passthrough();

const codexProtocolEventTrafficInputSchema = z.object({
  kind: z.literal("event"),
  event: z.unknown(),
  timestampMs: z.number().optional()
}).passthrough();

const codexProtocolServerRequestTrafficInputSchema = z.object({
  kind: z.literal("serverRequest"),
  id: codexRequestIdSchema,
  method: z.string(),
  params: z.unknown().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  timestampMs: z.number().optional()
}).passthrough();

const codexProtocolDiagnosticTrafficInputSchema = z.object({
  kind: z.literal("diagnostic"),
  text: z.string(),
  timestampMs: z.number().optional()
}).passthrough();

export const codexProtocolRequestTrafficSchema = codexProtocolRequestTrafficInputSchema
  .transform((traffic) => parseCodexProtocolRequestTraffic(traffic.method, traffic.params, {
    id: traffic.id,
    metadata: parseCodexProtocolMetadata(traffic.metadata),
    timestampMs: traffic.timestampMs
  })) as z.ZodType<CodexProtocolRequestTraffic>;

export const codexProtocolResponseTrafficSchema = codexProtocolResponseTrafficInputSchema
  .transform((traffic) => parseCodexProtocolResponseTraffic(traffic.method, traffic.response, {
    id: traffic.id,
    metadata: parseCodexProtocolMetadata(traffic.metadata),
    timestampMs: traffic.timestampMs
  })) as z.ZodType<CodexProtocolResponseTraffic>;

export const codexProtocolErrorResponseTrafficSchema = codexProtocolErrorResponseTrafficInputSchema
  .transform((traffic) => parseCodexProtocolErrorResponseTraffic(traffic.method, traffic.error, {
    id: traffic.id,
    metadata: parseCodexProtocolMetadata(traffic.metadata),
    timestampMs: traffic.timestampMs
  })) as z.ZodType<CodexProtocolErrorResponseTraffic>;

export const codexProtocolEventTrafficSchema = codexProtocolEventTrafficInputSchema
  .transform((traffic) => ({
    kind: "event" as const,
    event: parseCodexNotification(traffic.event) ?? unknownEventFromValue(traffic.event),
    timestampMs: traffic.timestampMs
  })) as z.ZodType<CodexProtocolEventTraffic>;

export const codexProtocolServerRequestTrafficSchema = codexProtocolServerRequestTrafficInputSchema
  .transform((traffic) => parseCodexServerRequest(traffic)) as z.ZodType<CodexProtocolServerRequestTraffic>;

export const codexProtocolDiagnosticTrafficSchema = codexProtocolDiagnosticTrafficInputSchema
  .transform((traffic) => ({
    kind: "diagnostic" as const,
    text: traffic.text,
    timestampMs: traffic.timestampMs
  })) as z.ZodType<CodexProtocolDiagnosticTraffic>;

const codexProtocolTrafficInputSchema = z.discriminatedUnion("kind", [
  codexProtocolRequestTrafficInputSchema,
  codexProtocolResponseTrafficInputSchema,
  codexProtocolErrorResponseTrafficInputSchema,
  codexProtocolEventTrafficInputSchema,
  codexProtocolServerRequestTrafficInputSchema,
  codexProtocolDiagnosticTrafficInputSchema
]);

export const codexProtocolTrafficSchema = codexProtocolTrafficInputSchema.transform((traffic) => {
  switch (traffic.kind) {
    case "request":
      return codexProtocolRequestTrafficSchema.parse(traffic);
    case "response":
      return codexProtocolResponseTrafficSchema.parse(traffic);
    case "responseError":
      return codexProtocolErrorResponseTrafficSchema.parse(traffic);
    case "event":
      return codexProtocolEventTrafficSchema.parse(traffic);
    case "serverRequest":
      return codexProtocolServerRequestTrafficSchema.parse(traffic);
    case "diagnostic":
      return codexProtocolDiagnosticTrafficSchema.parse(traffic);
  }
}) as z.ZodType<CodexProtocolTrafficShape>;

export type CodexProtocolTraffic = z.infer<typeof codexProtocolTrafficSchema>;

export function parseCodexProtocolTraffic(value: unknown): CodexProtocolTraffic {
  return codexProtocolTrafficSchema.parse(value);
}

export function parseCodexProtocolRequestTraffic<M extends CodexRequestMethod>(
  method: M,
  params: unknown,
  context: CodexProtocolTrafficContext = {}
): CodexProtocolRequestTraffic<M> {
  return {
    kind: "request",
    id: String(context.id ?? stableTrafficId("request", method, params)),
    method,
    params: parseCodexRequestParams(method, params),
    metadata: context.metadata,
    timestampMs: context.timestampMs
  };
}

export function parseCodexProtocolResponseTraffic<M extends CodexRequestMethod>(
  method: M,
  value: unknown,
  context: CodexProtocolTrafficContext = {}
): CodexProtocolResponseTraffic<M> {
  return {
    kind: "response",
    id: String(context.id ?? stableTrafficId("response", method, value)),
    method,
    response: parseCodexResponse(method, value),
    metadata: context.metadata,
    timestampMs: context.timestampMs
  };
}

export function parseCodexProtocolErrorResponseTraffic<M extends CodexRequestMethod>(
  method: M,
  value: unknown,
  context: CodexProtocolTrafficContext = {}
): CodexProtocolErrorResponseTraffic<M> {
  return {
    kind: "responseError",
    id: String(context.id ?? stableTrafficId("responseError", method, value)),
    method,
    error: asRecord(value),
    metadata: context.metadata,
    timestampMs: context.timestampMs
  };
}

export function parseCodexProtocolEventTraffic(value: unknown, context: { timestampMs?: number } = {}): CodexProtocolEventTraffic {
  return {
    kind: "event",
    event: parseCodexNotification(value) ?? unknownEventFromValue(value),
    timestampMs: context.timestampMs
  };
}

export function parseCodexRequestParams<M extends CodexRequestMethod>(method: M, value: unknown): CodexRequestParams<M> {
  const schema = codexRequestSchemasByMethod[method as keyof typeof codexRequestSchemasByMethod];
  if (!schema) {
    return asRecord(value) as CodexRequestParams<M>;
  }
  return schema.parse(value ?? {}) as CodexRequestParams<M>;
}

export function parseCodexResponse<M extends CodexRequestMethod>(method: M, value: unknown): CodexProtocolResponse<M> {
  const schema = codexResponseSchemasByMethod[method as keyof typeof codexResponseSchemasByMethod];
  if (!schema) {
    return {
      method,
      payload: asRecord(value),
      __codexUnknownResponse: true
    } as CodexProtocolResponse<M>;
  }
  return schema.parse(value ?? {}) as CodexProtocolResponse<M>;
}

export function parseCodexServerRequest(value: unknown): CodexProtocolServerRequestTraffic {
  const parsed = z.object({
    id: codexRequestIdSchema,
    method: z.string(),
    params: z.unknown().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    timestampMs: z.number().optional()
  }).passthrough().safeParse(value);
  if (!parsed.success) {
    return {
      kind: "serverRequest",
      id: stableTrafficId("serverRequest", "unknown", value),
      method: "unknown",
      params: asRecord(value)
    };
  }
  return {
    kind: "serverRequest",
    id: parsed.data.id,
    method: parsed.data.method,
    params: asRecord(parsed.data.params),
    metadata: parseCodexProtocolMetadata(parsed.data.metadata),
    timestampMs: parsed.data.timestampMs
  };
}

export function codexCanonicalRequestId(
  traffic: Pick<
    CodexProtocolRequestTraffic | CodexProtocolResponseTraffic | CodexProtocolErrorResponseTraffic | CodexProtocolServerRequestTraffic,
    "id" | "metadata"
  >
): string {
  return typeof traffic.metadata?.clientRequestId === "string" && traffic.metadata.clientRequestId.length > 0
    ? traffic.metadata.clientRequestId
    : traffic.id;
}

function parseCodexProtocolMetadata(value: unknown): CodexProtocolMetadata | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const metadata = asRecord(value);
  return Object.keys(metadata).length > 0 ? metadata as CodexProtocolMetadata : undefined;
}
