import type { CodexProtocolTraffic } from "../protocol/stream/index.js";

export class CodexRuntimeTrafficLedger {
  private readonly seenRequestIds = new Set<string>();
  private readonly requestIdOrder: string[] = [];

  shouldReduce(traffic: CodexProtocolTraffic): boolean {
    if (traffic.kind === "request") {
      return this.rememberRequest(traffic.id);
    }
    if (traffic.kind === "response" || traffic.kind === "responseError") {
      this.rememberRequest(traffic.id);
    }
    return true;
  }

  private rememberRequest(requestId: string): boolean {
    if (this.seenRequestIds.has(requestId)) {
      return false;
    }
    this.seenRequestIds.add(requestId);
    this.requestIdOrder.push(requestId);
    this.prune();
    return true;
  }

  private prune(): void {
    while (this.requestIdOrder.length > 1_000) {
      const removed = this.requestIdOrder.shift();
      if (removed) {
        this.seenRequestIds.delete(removed);
      }
    }
  }
}
