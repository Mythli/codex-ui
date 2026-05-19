import type {
  CodexProtocolEventTraffic,
  CodexProtocolErrorResponseTraffic,
  CodexProtocolRequestTraffic,
  CodexProtocolResponseTraffic,
  CodexProtocolTraffic,
  CodexRequestMethod
} from "./traffic.js";
import type { CodexProtocolEvent } from "./events.js";

type RecordValue = Record<string, unknown>;

export type CodexTrafficPacketMetadata = {
  method?: string;
  threadId?: string;
  turnId?: string;
  requestId?: string;
  cwd?: string;
  timestampMs?: number;
};

type CodexTrafficPacketMetadataStrategy<K extends CodexProtocolTraffic["kind"]> = (
  traffic: Extract<CodexProtocolTraffic, { kind: K }>
) => CodexTrafficPacketMetadata;

type AnyCodexTrafficPacketMetadataStrategy = (traffic: CodexProtocolTraffic) => CodexTrafficPacketMetadata;

const codexTrafficPacketMetadataStrategies: {
  [K in CodexProtocolTraffic["kind"]]: AnyCodexTrafficPacketMetadataStrategy;
} = {
  request: forTrafficKind("request", requestPacketMetadata),
  response: forTrafficKind("response", responsePacketMetadata),
  responseError: forTrafficKind("responseError", responseErrorPacketMetadata),
  event: forTrafficKind("event", eventPacketMetadata),
  serverRequest: forTrafficKind("serverRequest", serverRequestPacketMetadata),
  diagnostic: forTrafficKind("diagnostic", (traffic) => ({ timestampMs: traffic.timestampMs }))
};

export class CodexTrafficPacket {
  static from(traffic: CodexProtocolTraffic): CodexTrafficPacket {
    return new CodexTrafficPacket(traffic);
  }

  readonly kind: CodexProtocolTraffic["kind"];
  readonly method?: string;
  readonly threadId?: string;
  readonly turnId?: string;
  readonly requestId?: string;
  readonly cwd?: string;
  readonly timestampMs?: number;

  private constructor(readonly traffic: CodexProtocolTraffic) {
    const metadata = codexTrafficPacketMetadataStrategies[traffic.kind](traffic);
    this.kind = traffic.kind;
    this.method = metadata.method;
    this.threadId = metadata.threadId;
    this.turnId = metadata.turnId;
    this.requestId = metadata.requestId;
    this.cwd = metadata.cwd;
    this.timestampMs = metadata.timestampMs;
  }

  isForThread(threadId: string): boolean {
    return this.threadId === undefined || this.threadId === threadId;
  }

  isRequest<M extends CodexRequestMethod>(method: M): this is CodexTrafficPacket & {
    traffic: CodexProtocolRequestTraffic<M>;
  } {
    return this.traffic.kind === "request" && this.traffic.method === method;
  }

  isResponse<M extends CodexRequestMethod>(method: M): this is CodexTrafficPacket & {
    traffic: CodexProtocolResponseTraffic<M>;
  } {
    return this.traffic.kind === "response" && this.traffic.method === method;
  }

  isErrorResponse<M extends CodexRequestMethod>(method: M): this is CodexTrafficPacket & {
    traffic: CodexProtocolErrorResponseTraffic<M>;
  } {
    return this.traffic.kind === "responseError" && this.traffic.method === method;
  }

  isEvent<M extends CodexProtocolEvent["method"]>(method: M): this is CodexTrafficPacket & {
    traffic: CodexProtocolEventTraffic & { event: Extract<CodexProtocolEvent, { method: M }> };
  } {
    return this.traffic.kind === "event" && this.traffic.event.method === method;
  }
}

function forTrafficKind<K extends CodexProtocolTraffic["kind"]>(
  kind: K,
  strategy: CodexTrafficPacketMetadataStrategy<K>
): AnyCodexTrafficPacketMetadataStrategy {
  return (traffic) => traffic.kind === kind
    ? strategy(traffic as Extract<CodexProtocolTraffic, { kind: K }>)
    : {};
}

function requestPacketMetadata(
  traffic: Extract<CodexProtocolTraffic, { kind: "request" }>
): CodexTrafficPacketMetadata {
  const params = asRecord(traffic.params);
  return {
    method: traffic.method,
    requestId: traffic.id,
    threadId: stringValue(params.threadId),
    turnId: stringValue(params.turnId),
    cwd: stringValue(params.cwd),
    timestampMs: traffic.timestampMs
  };
}

function responsePacketMetadata(
  traffic: Extract<CodexProtocolTraffic, { kind: "response" }>
): CodexTrafficPacketMetadata {
  const response = asRecord(traffic.response);
  const thread = asRecord(response.thread);
  const turn = asRecord(response.turn);
  return {
    method: traffic.method,
    requestId: traffic.id,
    threadId: stringValue(thread.id) ?? stringValue(turn.threadId),
    turnId: stringValue(turn.id),
    cwd: stringValue(thread.cwd),
    timestampMs: traffic.timestampMs
  };
}

function responseErrorPacketMetadata(
  traffic: Extract<CodexProtocolTraffic, { kind: "responseError" }>
): CodexTrafficPacketMetadata {
  return {
    method: traffic.method,
    requestId: traffic.id,
    timestampMs: traffic.timestampMs
  };
}

function eventPacketMetadata(
  traffic: Extract<CodexProtocolTraffic, { kind: "event" }>
): CodexTrafficPacketMetadata {
  const params = asRecord(traffic.event.params);
  const thread = asRecord(params.thread);
  const turn = asRecord(params.turn);
  return {
    method: traffic.event.method,
    threadId: stringValue(params.threadId) ?? stringValue(thread.id) ?? stringValue(turn.threadId),
    turnId: stringValue(params.turnId) ?? stringValue(turn.id),
    cwd: stringValue(thread.cwd),
    timestampMs: traffic.timestampMs
  };
}

function serverRequestPacketMetadata(
  traffic: Extract<CodexProtocolTraffic, { kind: "serverRequest" }>
): CodexTrafficPacketMetadata {
  const params = asRecord(traffic.params);
  return {
    method: traffic.method,
    requestId: traffic.id,
    threadId: stringValue(params.threadId),
    turnId: stringValue(params.turnId),
    cwd: stringValue(params.cwd),
    timestampMs: traffic.timestampMs
  };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asRecord(value: unknown): RecordValue {
  return typeof value === "object" && value !== null ? value as RecordValue : {};
}
