import {
  asOptionalRecord,
  asRecord,
  requestIdValue,
  stableTrafficId,
  stringValue,
  type RecordValue,
} from './common.js'
import { parseCodexNotification, unknownEventFromValue, type CodexProtocolEvent } from './events.js'
import type { CodexRequestMethod, CodexRequestParamsByMethod } from './requests.js'
import type { CodexResponseByMethod } from './responses.js'

export type {
  CodexKnownRequestMethod,
  CodexRequestMethod,
  CodexRequestParamsByMethod,
} from './requests.js'
export type { CodexResponseByMethod } from './responses.js'

export type CodexUnknownRequest = {
  method: string
  params: RecordValue
  readonly __codexUnknownRequest: true
}

export type CodexUnknownResponse = {
  method: string
  payload: RecordValue
  readonly __codexUnknownResponse: true
}

export type CodexRequestParams<M extends CodexRequestMethod> =
  M extends keyof CodexRequestParamsByMethod ? CodexRequestParamsByMethod[M] : RecordValue

export type CodexProtocolResponse<M extends CodexRequestMethod> =
  M extends keyof CodexResponseByMethod ? CodexResponseByMethod[M] : CodexUnknownResponse

export type CodexProtocolMetadata = {
  clientRequestId?: string
} & RecordValue

export type CodexProtocolTrafficContext = {
  id?: string | number
  metadata?: CodexProtocolMetadata
  timestampMs?: number
}

export type CodexProtocolRequestTraffic<M extends CodexRequestMethod = CodexRequestMethod> = {
  kind: 'request'
  id: string
  method: M
  params: CodexRequestParams<M>
  metadata?: CodexProtocolMetadata
  timestampMs?: number
}

export type CodexProtocolResponseTraffic<M extends CodexRequestMethod = CodexRequestMethod> = {
  kind: 'response'
  id: string
  method: M
  response: CodexProtocolResponse<M>
  metadata?: CodexProtocolMetadata
  timestampMs?: number
}

export type CodexProtocolErrorResponseTraffic<M extends CodexRequestMethod = CodexRequestMethod> = {
  kind: 'responseError'
  id: string
  method: M
  error: RecordValue
  metadata?: CodexProtocolMetadata
  timestampMs?: number
}

export type CodexProtocolEventTraffic = {
  kind: 'event'
  event: CodexProtocolEvent
  timestampMs?: number
}

export type CodexProtocolServerRequestTraffic = {
  kind: 'serverRequest'
  id: string
  method: string
  params: RecordValue
  metadata?: CodexProtocolMetadata
  timestampMs?: number
}

export type CodexProtocolDiagnosticTraffic = {
  kind: 'diagnostic'
  text: string
  timestampMs?: number
}

export type CodexProtocolTraffic =
  | CodexProtocolRequestTraffic
  | CodexProtocolResponseTraffic
  | CodexProtocolErrorResponseTraffic
  | CodexProtocolEventTraffic
  | CodexProtocolServerRequestTraffic
  | CodexProtocolDiagnosticTraffic

const knownResponseMethods = new Set<string>([
  'initialize',
  'initialized',
  'thread/start',
  'thread/resume',
  'thread/read',
  'thread/list',
  'thread/archive',
  'thread/compact/start',
  'turn/start',
  'turn/interrupt',
  'fs/readFile',
  'model/list',
  'config/read',
] satisfies (keyof CodexResponseByMethod)[])

export function parseCodexProtocolTraffic(value: unknown): CodexProtocolTraffic {
  const traffic = asRecord(value)
  const kind = stringValue(traffic.kind)
  switch (kind) {
    case 'request':
      return parseCodexProtocolRequestTraffic(
        requestMethodValue(traffic.method),
        traffic.params,
        protocolContextFromRecord(traffic)
      )
    case 'response':
      return parseCodexProtocolResponseTraffic(
        requestMethodValue(traffic.method),
        traffic.response,
        protocolContextFromRecord(traffic)
      )
    case 'responseError':
      return parseCodexProtocolErrorResponseTraffic(
        requestMethodValue(traffic.method),
        traffic.error,
        protocolContextFromRecord(traffic)
      )
    case 'event':
      return parseCodexProtocolEventTraffic(traffic.event, {
        timestampMs: typeof traffic.timestampMs === 'number' ? traffic.timestampMs : undefined,
      })
    case 'serverRequest':
      return parseCodexServerRequest(traffic)
    case 'diagnostic':
      return {
        kind: 'diagnostic',
        text: stringValue(traffic.text) ?? '',
        timestampMs: typeof traffic.timestampMs === 'number' ? traffic.timestampMs : undefined,
      }
    default:
      return {
        kind: 'diagnostic',
        text: `Unsupported Codex protocol traffic: ${safeStringify(value)}`,
      }
  }
}

export function parseCodexProtocolRequestTraffic<M extends CodexRequestMethod>(
  method: M,
  params: unknown,
  context: CodexProtocolTrafficContext = {}
): CodexProtocolRequestTraffic<M> {
  return {
    kind: 'request',
    id: String(context.id ?? stableTrafficId('request', method, params)),
    method,
    params: parseCodexRequestParams(method, params),
    metadata: context.metadata,
    timestampMs: context.timestampMs,
  }
}

export function parseCodexProtocolResponseTraffic<M extends CodexRequestMethod>(
  method: M,
  value: unknown,
  context: CodexProtocolTrafficContext = {}
): CodexProtocolResponseTraffic<M> {
  return {
    kind: 'response',
    id: String(context.id ?? stableTrafficId('response', method, value)),
    method,
    response: parseCodexResponse(method, value),
    metadata: context.metadata,
    timestampMs: context.timestampMs,
  }
}

export function parseCodexProtocolErrorResponseTraffic<M extends CodexRequestMethod>(
  method: M,
  value: unknown,
  context: CodexProtocolTrafficContext = {}
): CodexProtocolErrorResponseTraffic<M> {
  return {
    kind: 'responseError',
    id: String(context.id ?? stableTrafficId('responseError', method, value)),
    method,
    error: asRecord(value),
    metadata: context.metadata,
    timestampMs: context.timestampMs,
  }
}

export function parseCodexProtocolEventTraffic(
  value: unknown,
  context: { timestampMs?: number } = {}
): CodexProtocolEventTraffic {
  return {
    kind: 'event',
    event: parseCodexNotification(value) ?? unknownEventFromValue(value),
    timestampMs: context.timestampMs,
  }
}

export function parseCodexRequestParams<M extends CodexRequestMethod>(
  method: M,
  value: unknown
): CodexRequestParams<M> {
  if (method === 'initialized' || method === 'unknown') {
    return asRecord(value ?? {}) as CodexRequestParams<M>
  }
  return (value ?? {}) as CodexRequestParams<M>
}

export function parseCodexResponse<M extends CodexRequestMethod>(
  method: M,
  value: unknown
): CodexProtocolResponse<M> {
  if (!knownResponseMethods.has(method)) {
    return {
      method,
      payload: asRecord(value),
      __codexUnknownResponse: true,
    } as CodexProtocolResponse<M>
  }
  return (value ?? {}) as CodexProtocolResponse<M>
}

export function parseCodexServerRequest(value: unknown): CodexProtocolServerRequestTraffic {
  const request = asRecord(value)
  return {
    kind: 'serverRequest',
    id:
      requestIdValue(request.id) ??
      stableTrafficId('serverRequest', stringValue(request.method) ?? 'unknown', value),
    method: stringValue(request.method) ?? 'unknown',
    params: asRecord(request.params),
    metadata: parseCodexProtocolMetadata(request.metadata),
    timestampMs: typeof request.timestampMs === 'number' ? request.timestampMs : undefined,
  }
}

export function codexCanonicalRequestId(
  traffic: Pick<
    | CodexProtocolRequestTraffic
    | CodexProtocolResponseTraffic
    | CodexProtocolErrorResponseTraffic
    | CodexProtocolServerRequestTraffic,
    'id' | 'metadata'
  >
): string {
  return typeof traffic.metadata?.clientRequestId === 'string' &&
    traffic.metadata.clientRequestId.length > 0
    ? traffic.metadata.clientRequestId
    : traffic.id
}

function protocolContextFromRecord(value: RecordValue): CodexProtocolTrafficContext {
  return {
    id: requestIdValue(value.id),
    metadata: parseCodexProtocolMetadata(value.metadata),
    timestampMs: typeof value.timestampMs === 'number' ? value.timestampMs : undefined,
  }
}

function requestMethodValue(value: unknown): CodexRequestMethod {
  return (stringValue(value) ?? 'unknown') as CodexRequestMethod
}

function parseCodexProtocolMetadata(value: unknown): CodexProtocolMetadata | undefined {
  const metadata = asOptionalRecord(value)
  return metadata && Object.keys(metadata).length > 0
    ? (metadata as CodexProtocolMetadata)
    : undefined
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
