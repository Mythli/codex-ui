import { readFileSync } from "node:fs";
import { TraceReplayTransport } from "../core/transport/TraceReplayTransport.js";

export class TraceReplayFileTransport extends TraceReplayTransport {
  constructor(tracePath: string) {
    super(readFileSync(tracePath, "utf8"));
  }
}

export function createTraceReplayTransportFromFile(tracePath: string): TraceReplayFileTransport {
  return new TraceReplayFileTransport(tracePath);
}
