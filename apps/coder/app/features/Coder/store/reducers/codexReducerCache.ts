import {
  CodexThreadIndexReducer,
  CodexThreadReducer,
  type CodexThreadIndexState
} from "@taylordb/codex";

const threadReducersById = new Map<string, CodexThreadReducer>();
const threadIndexReducer = new CodexThreadIndexReducer();

export function getThreadIndexReducer(): CodexThreadIndexReducer {
  return threadIndexReducer;
}

export function initialThreadIndexState(): CodexThreadIndexState {
  return threadIndexReducer.initialState();
}

export function getThreadReducer(threadId: string, sessionPath?: string): CodexThreadReducer {
  const existing = threadReducersById.get(threadId);
  if (existing) {
    return existing;
  }
  const reducer = new CodexThreadReducer({ threadId, sessionPath });
  threadReducersById.set(threadId, reducer);
  return reducer;
}

export function forgetThreadReducer(threadId: string): void {
  threadReducersById.delete(threadId);
}
