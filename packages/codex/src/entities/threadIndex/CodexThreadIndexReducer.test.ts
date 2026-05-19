import { describe, expect, it } from "vitest";
import { parseCodexProtocolEventTraffic } from "../../protocol/stream/index.js";
import { CodexThreadIndexReducer } from "./CodexThreadIndexReducer.js";

describe("CodexThreadIndexReducer", () => {
  it("clears running activity when turn completion only carries a turn id", () => {
    const reducer = new CodexThreadIndexReducer();
    let state = reducer.initialState();

    state = reducer.reduce(state, parseCodexProtocolEventTraffic({
      method: "turn/started",
      params: {
        threadId: "thread-a",
        turnId: "turn-a"
      }
    }, { timestampMs: 1_000 }));

    expect(state.threadsById["thread-a"]?.activity).toBe("running");

    state = reducer.reduce(state, parseCodexProtocolEventTraffic({
      method: "turn/completed",
      params: {
        turnId: "turn-a"
      }
    }, { timestampMs: 2_000 }));

    expect(state.threadsById["thread-a"]?.activity).toBe("none");
  });
});
