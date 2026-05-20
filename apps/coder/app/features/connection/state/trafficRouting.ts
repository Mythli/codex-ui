import { CodexTrafficPacket, codexCanonicalRequestId, type CodexProtocolTraffic } from "@coder/protocol";
import type { CoderThreadsState } from "@coder/types";

export function targetThreadIdForTraffic(
  state: CoderThreadsState,
  traffic: CodexProtocolTraffic
): string | undefined {
  const packet = CodexTrafficPacket.from(traffic);
  if (packet.threadId) {
    return packet.threadId;
  }

  const metadataTarget = metadataThreadId(traffic);
  if (metadataTarget) {
    return metadataTarget;
  }

  if (packet.requestId) {
    const threadId = state.requestThreadIdsById[packet.requestId];
    if (threadId) {
      return threadId;
    }
  }

  if (packet.turnId) {
    const threadId = state.turnThreadIdsById[packet.turnId];
    if (threadId) {
      return threadId;
    }
  }

  const sessionPath = trafficSessionPath(traffic);
  if (sessionPath) {
    return state.sessionThreadIdsByPath[sessionPath];
  }

  return undefined;
}

export function requestThreadIdFromTraffic(
  state: CoderThreadsState,
  traffic: CodexProtocolTraffic
): string | undefined {
  const packet = CodexTrafficPacket.from(traffic);
  const metadataTarget = metadataThreadId(traffic);
  if (metadataTarget) {
    return metadataTarget;
  }
  if (packet.threadId) {
    return packet.threadId;
  }
  const sessionPath = trafficSessionPath(traffic);
  return sessionPath ? state.sessionThreadIdsByPath[sessionPath] : undefined;
}

export function trafficRequestId(traffic: CodexProtocolTraffic): string | undefined {
  return traffic.kind === "request" || traffic.kind === "response" || traffic.kind === "responseError" || traffic.kind === "serverRequest"
    ? codexCanonicalRequestId(traffic)
    : undefined;
}

export function trafficTurnId(traffic: CodexProtocolTraffic): string | undefined {
  return CodexTrafficPacket.from(traffic).turnId;
}

export function trafficSessionPath(traffic: CodexProtocolTraffic): string | undefined {
  if (traffic.kind === "request" && traffic.method === "fs/readFile") {
    const path = (traffic.params as { path?: unknown }).path;
    return typeof path === "string" ? path : undefined;
  }
  return undefined;
}

export function metadataThreadId(traffic: CodexProtocolTraffic): string | undefined {
  const metadata = "metadata" in traffic ? traffic.metadata : undefined;
  return stringValue(metadata?.targetThreadId) ?? stringValue(metadata?.provisionalThreadId);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
