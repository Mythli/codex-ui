import {
  parseCodexProtocolRequestTraffic,
  parseCodexProtocolResponseTraffic
} from "@coder/protocol";
import type {
  CodexProtocolTraffic,
  CodexThreadState,
  CodexTransport
} from "@coder/types";
import { CodexThreadReducer } from "../state/threadReducer";

export type SsrThreadHydration = {
  indexTraffic: CodexProtocolTraffic[];
  thread: CodexThreadState;
};

export async function loadInitialThreadForSsr(
  backend: CodexTransport,
  input: {
    threadId: string;
    sessionPath?: string;
  }
): Promise<SsrThreadHydration> {
  const reducer = new CodexThreadReducer({
    threadId: input.threadId,
    sessionPath: input.sessionPath
  });
  let state = reducer.initialState();
  const indexTraffic: CodexProtocolTraffic[] = [];
  const readRequest = parseCodexProtocolRequestTraffic("thread/read", {
    threadId: input.threadId,
    includeTurns: false
  }, { id: `ssr-thread-read-${input.threadId}`, timestampMs: Date.now() });
  state = reducer.reduce(state, readRequest);
  const readResponse = await backend.request("thread/read", readRequest.params);
  const readResponseTraffic = parseCodexProtocolResponseTraffic("thread/read", readResponse, {
    id: readRequest.id,
    timestampMs: Date.now()
  });
  indexTraffic.push(readResponseTraffic);
  state = reducer.reduce(state, readResponseTraffic);

  const sessionPath = readResponse.thread.path;
  if (sessionPath) {
    const fileRequest = parseCodexProtocolRequestTraffic("fs/readFile", {
      path: sessionPath
    }, { id: `ssr-fs-read-${input.threadId}`, timestampMs: Date.now() });
    state = reducer.reduce(state, fileRequest);
    const fileResponse = await backend.request("fs/readFile", fileRequest.params);
    const fileResponseTraffic = parseCodexProtocolResponseTraffic("fs/readFile", fileResponse, {
      id: fileRequest.id,
      timestampMs: Date.now()
    });
    state = reducer.reduce(state, fileResponseTraffic);
  }

  return {
    indexTraffic,
    thread: state
  };
}
