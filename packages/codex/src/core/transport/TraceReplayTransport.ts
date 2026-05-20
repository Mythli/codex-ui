import type { CodexTransport } from "./CodexTransport.js";
import type { CodexTransportRequestOptions } from "./CodexTransport.js";
import {
  parseCodexProtocolEventTraffic,
  parseCodexProtocolRequestTraffic,
  parseCodexWireObject,
  type CodexProtocolResponse,
  type CodexProtocolTraffic,
  type CodexRequestMethod,
  type CodexRequestParams
} from "../../protocol/stream/index.js";

export type TraceTransportEntry = {
  kind: "transport";
  direction: "stdin" | "stdout" | "stderr";
  line?: string;
  message?: TraceTransportMessage;
};

export type TraceTransportMessage = {
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: unknown;
};

export type TraceReplaySource = string | readonly TraceTransportEntry[];

export function parseTraceTransportEntries(traceText: string): TraceTransportEntry[] {
  return traceText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TraceTransportEntry)
    .filter((entry) => entry.kind === "transport");
}

export class TraceReplayTransport implements CodexTransport {
  private readonly entries: TraceTransportEntry[];
  private cursor = 0;
  private readonly trafficListeners = new Set<(traffic: CodexProtocolTraffic) => void>();
  private readonly diagnosticListeners = new Set<(text: string) => void>();

  constructor(source: TraceReplaySource) {
    this.entries = typeof source === "string"
      ? parseTraceTransportEntries(source)
      : source.filter((entry) => entry.kind === "transport").map((entry) => ({ ...entry }));
  }

  async initialize(): Promise<void> {
    await this.request("initialize", {
      clientInfo: { name: "codex-api", title: "Codex API", version: "0.1.0" },
      capabilities: { experimentalApi: true, requestAttestation: false }
    });
    this.notify("initialized");
  }

  request<M extends CodexRequestMethod>(
    method: M,
    params: CodexRequestParams<M>,
    options: CodexTransportRequestOptions = {}
  ): Promise<CodexProtocolResponse<M>> {
    const stdin = this.nextEntry("stdin");
    if (stdin.message?.method !== method) {
      throw new Error(`Trace expected request ${stdin.message?.method ?? "(missing)"}, got ${method}`);
    }
    const requestId = stdin.message.id;
    if (typeof requestId !== "number") {
      throw new Error(`Trace request ${method} is missing numeric id`);
    }
    const requestTraffic = parseCodexProtocolRequestTraffic(method, params, {
      id: requestId,
      metadata: options.metadata
    });
    this.emitTraffic(requestTraffic);

    for (;;) {
      const entry = this.nextEntry();
      if (entry.direction === "stderr") {
        this.emitDiagnostic(entry.line ?? "");
        continue;
      }
      const message = entry.message;
      if (!message) {
        continue;
      }
      if (message.id === requestId) {
        if (message.error) {
          throw new Error(String(message.error));
        }
        const responseTraffic = parseCodexWireObject(message, { responseMethod: method, id: requestId });
        if (responseTraffic.kind !== "response") {
          throw new Error(`Trace response ${method} did not parse as a response`);
        }
        this.emitTraffic(options.metadata ? { ...responseTraffic, metadata: options.metadata } : responseTraffic);
        this.drainNotificationsUntilNextInput();
        return Promise.resolve(responseTraffic.response as CodexProtocolResponse<M>);
      }
      if (typeof message.id === "number" && typeof message.method === "string") {
        continue;
      }
      if (entry.direction === "stdin" && typeof message.id === "number" && "result" in message) {
        continue;
      }
      this.emitParsedMessage(message);
    }
  }

  notify(method: string, params?: unknown): void {
    const stdin = this.nextEntry("stdin");
    if (stdin.message?.method !== method) {
      throw new Error(`Trace expected notify ${stdin.message?.method ?? "(missing)"}, got ${method}`);
    }
    this.emitTraffic(parseCodexProtocolRequestTraffic(method as CodexRequestMethod, params ?? {}, { id: `notify-${this.cursor}` }));
  }

  onTraffic(listener: (traffic: CodexProtocolTraffic) => void): () => void {
    this.trafficListeners.add(listener);
    return () => this.trafficListeners.delete(listener);
  }

  onDiagnostic(listener: (text: string) => void): () => void {
    this.diagnosticListeners.add(listener);
    return () => this.diagnosticListeners.delete(listener);
  }

  close(): void {}

  assertFullyConsumed(): void {
    const remaining = this.entries.slice(this.cursor).filter((entry) => entry.direction !== "stderr");
    if (remaining.length > 0) {
      throw new Error(`Trace replay left ${remaining.length} transport entries unconsumed`);
    }
  }

  private nextEntry(direction?: TraceTransportEntry["direction"]): TraceTransportEntry {
    while (this.cursor < this.entries.length) {
      const entry = this.entries[this.cursor]!;
      this.cursor += 1;
      if (!direction || entry.direction === direction) {
        return entry;
      }
      if (entry.direction === "stderr") {
        this.emitDiagnostic(entry.line ?? "");
      } else if (entry.direction === "stdout" && entry.message && !("id" in entry.message)) {
        this.emitParsedMessage(entry.message);
      }
    }
    throw new Error(`Trace replay exhausted while waiting for ${direction ?? "entry"}`);
  }

  private drainNotificationsUntilNextInput(): void {
    while (this.cursor < this.entries.length) {
      const entry = this.entries[this.cursor]!;
      if (entry.direction === "stdin") {
        return;
      }
      this.cursor += 1;
      if (entry.direction === "stderr") {
        this.emitDiagnostic(entry.line ?? "");
      } else if (entry.direction === "stdout" && entry.message && !("id" in entry.message)) {
        this.emitParsedMessage(entry.message);
      }
    }
  }

  private emitTraffic(traffic: CodexProtocolTraffic): void {
    for (const listener of this.trafficListeners) {
      listener(traffic);
    }
  }

  private emitParsedMessage(message: unknown): void {
    if (message && typeof message === "object" && "kind" in message) {
      const kind = (message as { kind?: unknown }).kind;
      if (kind === "notification" && "notification" in message) {
        this.emitTraffic(parseCodexProtocolEventTraffic((message as { notification: unknown }).notification));
        return;
      }
      if (kind === "diagnostic" && "text" in message && typeof (message as { text?: unknown }).text === "string") {
        this.emitDiagnostic((message as { text: string }).text);
        return;
      }
    }
    const parsed = parseCodexWireObject(message);
    if (parsed.kind === "diagnostic") {
      this.emitDiagnostic(parsed.text);
    } else {
      this.emitTraffic(parsed);
    }
  }

  private emitDiagnostic(text: string): void {
    if (!text) {
      return;
    }
    this.emitTraffic({ kind: "diagnostic", text });
    for (const listener of this.diagnosticListeners) {
      listener(text);
    }
  }
}
