import {
  parseCodexProtocolRequestTraffic,
  parseCodexProtocolResponseTraffic
} from "@coder/protocol";
import type {
  CodexProtocolTraffic,
  CodexThreadIndexState,
  CodexTransport
} from "@coder/types";
import { CodexThreadIndexReducer } from "../state/threadIndexReducer";

export async function loadThreadIndexForSsr(backend: CodexTransport): Promise<CodexThreadIndexState> {
  const reducer = new CodexThreadIndexReducer();
  const request = parseCodexProtocolRequestTraffic("thread/list", {
    limit: 100,
    sortKey: "updated_at",
    sortDirection: "desc",
    sourceKinds: [],
    archived: false,
    cwd: null
  }, { id: "ssr-thread-list", timestampMs: Date.now() });
  const response = await backend.request("thread/list", request.params);
  const responseTraffic = parseCodexProtocolResponseTraffic("thread/list", response, {
    id: request.id,
    timestampMs: Date.now()
  });
  return reducer.reduce(reducer.reduce(undefined, request), responseTraffic);
}

export function reduceThreadIndexTraffic(
  initialState: CodexThreadIndexState,
  trafficItems: readonly CodexProtocolTraffic[]
): CodexThreadIndexState {
  const reducer = new CodexThreadIndexReducer();
  return trafficItems.reduce((state, traffic) => reducer.reduce(state, traffic), initialState);
}
