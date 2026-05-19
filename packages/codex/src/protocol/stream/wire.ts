import { isRecord } from "./common.js";
import {
  parseCodexProtocolRequestTraffic,
  parseCodexProtocolTraffic,
  type CodexProtocolRequestTraffic,
  type CodexProtocolTraffic,
  type CodexRequestMethod
} from "./traffic.js";

export type CodexWireParseContext = {
  responseMethod?: CodexRequestMethod;
  responseMethodForId?: (id: string | number) => CodexRequestMethod | undefined;
  id?: string | number;
};

export type CodexWireParserMiddleware = ReturnType<typeof createCodexWireParserMiddleware>;
export type CodexWireStitcher = CodexWireParserMiddleware;

export function createCodexWireParserMiddleware() {
  const requestMethodsById = new Map<string, CodexRequestMethod>();

  function forgetResponseId(traffic: CodexProtocolTraffic): void {
    if (traffic.kind === "response" || traffic.kind === "responseError") {
      requestMethodsById.delete(traffic.id);
    }
  }

  return {
    observeRequest<M extends CodexRequestMethod>(
      method: M,
      params: unknown,
      context: { id?: string | number; timestampMs?: number } = {}
    ): CodexProtocolRequestTraffic<M> {
      const traffic = parseCodexProtocolRequestTraffic(method, params, context);
      requestMethodsById.set(traffic.id, method);
      return traffic;
    },

    parseWireLine(line: string, context: Omit<CodexWireParseContext, "responseMethodForId"> = {}): CodexProtocolTraffic {
      const traffic = parseCodexWireLine(line, {
        ...context,
        responseMethodForId: (id) => requestMethodsById.get(String(id))
      });
      forgetResponseId(traffic);
      return traffic;
    },

    parseWireObject(value: unknown, context: Omit<CodexWireParseContext, "responseMethodForId"> = {}): CodexProtocolTraffic {
      const traffic = parseCodexWireObject(value, {
        ...context,
        responseMethodForId: (id) => requestMethodsById.get(String(id))
      });
      forgetResponseId(traffic);
      return traffic;
    },

    responseMethodForId(id: string | number): CodexRequestMethod | undefined {
      return requestMethodsById.get(String(id));
    }
  };
}

export function createCodexWireStitcher(): CodexWireStitcher {
  return createCodexWireParserMiddleware();
}

export function parseCodexWireLine(line: string, context: CodexWireParseContext = {}): CodexProtocolTraffic {
  if (!line.trim()) {
    return { kind: "diagnostic", text: "" };
  }
  try {
    return parseCodexWireObject(JSON.parse(line), context);
  } catch {
    return { kind: "diagnostic", text: line };
  }
}

export function parseCodexWireObject(value: unknown, context: CodexWireParseContext = {}): CodexProtocolTraffic {
  if (!isRecord(value)) {
    return { kind: "diagnostic", text: `Codex emitted non-object JSON: ${JSON.stringify(value)}` };
  }

  if (typeof value.id === "number" && ("result" in value || "error" in value)) {
    const method = context.responseMethod ?? context.responseMethodForId?.(value.id) ?? "unknown";
    return "error" in value
      ? parseCodexProtocolTraffic({ kind: "responseError", id: value.id, method, error: value.error })
      : parseCodexProtocolTraffic({ kind: "response", id: value.id, method, response: value.result });
  }

  if (typeof value.id === "number" && typeof value.method === "string") {
    return parseCodexProtocolTraffic({
      kind: "serverRequest",
      id: value.id,
      method: value.method,
      params: value.params
    });
  }

  if (typeof value.method === "string") {
    return parseCodexProtocolTraffic({ kind: "event", event: value });
  }

  return { kind: "diagnostic", text: `Codex emitted unknown JSON: ${JSON.stringify(value)}` };
}
