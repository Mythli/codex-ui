import type { CodexParsedThread } from "../../../protocol/stream/index.js";
import { turnStateFromProtocolTurn } from "./itemProjectors.js";
import { createState, putTurn } from "./state.js";
import type { CodexTranscriptState } from "../model.js";

export function stateFromThread(thread: CodexParsedThread): CodexTranscriptState {
  let state = createState({
    threadId: thread.id,
    title: thread.name ?? thread.preview ?? undefined,
    cwd: thread.cwd ?? undefined
  });

  for (const turn of thread.turns ?? []) {
    state = putTurn(state, turnStateFromProtocolTurn(turn, turn.id, "threadRead", "completed"));
  }

  return state;
}
