import {
  createSlice,
  current
} from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { CodexThreadState } from "@coder/types";
import { CodexTrafficPacket, type CodexProtocolTraffic } from "@coder/protocol";
import { codexTrafficReceived } from "../../connection/state/codexTrafficActions";
import {
  requestThreadIdFromTraffic,
  targetThreadIdForTraffic,
  trafficRequestId,
  trafficTurnId
} from "../../connection/state/trafficRouting";
import { newDraftSelected, threadSelected } from "@app/features/threads/state/threadSelectionSlice";
import { forgetThreadReducer, getThreadReducer } from "./threadReducerCache";
import type { CoderThreadsState } from "@coder/types";

const initialState: CoderThreadsState = {
  byId: {},
  requestThreadIdsById: {},
  turnThreadIdsById: {},
  sessionThreadIdsByPath: {},
  cacheMetadataByThreadId: {}
};

const threadsSlice = createSlice({
  name: "threads",
  initialState,
  reducers: {
    createProvisionalThread: (state, action: PayloadAction<{ cwd: string; threadId: string }>) => {
      const reducer = getThreadReducer(action.payload.threadId);
      state.activeThreadId = action.payload.threadId;
      state.byId[action.payload.threadId] = {
        ...reducer.initialState(),
        cwd: action.payload.cwd,
        isProvisionalThread: true,
        status: "loading"
      };
    },
    promoteProvisionalThread: (state, action: PayloadAction<{
      provisionalThreadId: string;
      threadId: string;
    }>) => {
      const provisional = state.byId[action.payload.provisionalThreadId];
      if (!provisional) {
        activateThreadInState(state, action.payload.threadId);
        return;
      }
      const existing = state.byId[action.payload.threadId];
      state.byId[action.payload.threadId] = {
        ...provisional,
        session: existing?.session ?? provisional.session,
        sessionPath: existing?.sessionPath ?? provisional.sessionPath,
        threadId: action.payload.threadId,
        title: existing?.title ?? provisional.title,
        transcript: provisional.transcript
          ? { ...provisional.transcript, threadId: action.payload.threadId }
          : undefined,
        isProvisionalThread: undefined
      };
      delete state.byId[action.payload.provisionalThreadId];
      if (state.activeThreadId === action.payload.provisionalThreadId) {
        state.activeThreadId = action.payload.threadId;
      }
      state.requestThreadIdsById = replaceMappedThreadId(
        state.requestThreadIdsById,
        action.payload.provisionalThreadId,
        action.payload.threadId
      );
      state.turnThreadIdsById = replaceMappedThreadId(
        state.turnThreadIdsById,
        action.payload.provisionalThreadId,
        action.payload.threadId
      );
      const provisionalMetadata = state.cacheMetadataByThreadId[action.payload.provisionalThreadId];
      if (provisionalMetadata && !state.cacheMetadataByThreadId[action.payload.threadId]) {
        state.cacheMetadataByThreadId[action.payload.threadId] = provisionalMetadata;
      }
      delete state.cacheMetadataByThreadId[action.payload.provisionalThreadId];
    },
    hydrateThread: (state, action: PayloadAction<{
      indexedUpdatedAt?: string;
      loadedAtMs?: number;
      thread: CodexThreadState;
    }>) => {
      const thread = action.payload.thread;
      state.byId[thread.threadId] = thread;
      state.activeThreadId = thread.threadId;
      if (thread.sessionPath) {
        state.sessionThreadIdsByPath[thread.sessionPath] = thread.threadId;
      }
      if (thread.activeTurnId) {
        state.turnThreadIdsById[thread.activeTurnId] = thread.threadId;
      }
      state.cacheMetadataByThreadId[thread.threadId] = {
        loadedAtMs: action.payload.loadedAtMs ?? Date.now(),
        loadedIndexUpdatedAt: action.payload.indexedUpdatedAt,
        loadedSessionPath: thread.sessionPath
      };
    },
    markThreadHydrated: (state, action: PayloadAction<{
      indexedUpdatedAt?: string;
      sessionPath?: string;
      threadId: string;
    }>) => {
      state.cacheMetadataByThreadId[action.payload.threadId] = {
        loadedAtMs: Date.now(),
        loadedIndexUpdatedAt: action.payload.indexedUpdatedAt,
        loadedSessionPath: action.payload.sessionPath
      };
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(threadSelected, (state, action) => {
        activateThreadInState(state, action.payload.threadId);
      })
      .addCase(newDraftSelected, (state) => {
        state.activeThreadId = undefined;
      })
      .addCase(codexTrafficReceived, (state, action: PayloadAction<CodexProtocolTraffic>) =>
        reduceThreadsTraffic(current(state), action.payload));
  }
});

export const {
  createProvisionalThread,
  hydrateThread,
  markThreadHydrated,
  promoteProvisionalThread
} = threadsSlice.actions;
export const threadsReducer = threadsSlice.reducer;

function activateThreadInState(state: CoderThreadsState, threadId: string): void {
  state.activeThreadId = threadId;
  if (!state.byId[threadId]) {
    const reducer = getThreadReducer(threadId);
    state.byId[threadId] = reducer.initialState();
  }
}

function reduceThreadsTraffic(
  state: CoderThreadsState,
  traffic: CodexProtocolTraffic
): CoderThreadsState {
  const packet = CodexTrafficPacket.from(traffic);
  if (packet.kind === "diagnostic" || packet.kind === "serverRequest") {
    return state;
  }

  if (packet.isEvent("thread/archived") && packet.threadId) {
    return removeThread(state, packet.threadId);
  }

  const requestId = trafficRequestId(traffic);
  const requestTarget = requestThreadIdFromTraffic(state, traffic);
  let nextState = requestId && requestTarget
    ? rememberRequestThread(state, requestId, requestTarget)
    : state;

  const targetThreadId = targetThreadIdForTraffic(nextState, traffic);
  if (!targetThreadId) {
    return nextState;
  }

  nextState = reduceThread(nextState, targetThreadId, traffic);
  const nextThread = nextState.byId[targetThreadId];
  if (!nextThread) {
    return nextState;
  }

  const turnId = trafficTurnId(traffic) ?? nextThread.activeTurnId;
  if (turnId && nextState.turnThreadIdsById[turnId] !== targetThreadId) {
    nextState = {
      ...nextState,
      turnThreadIdsById: {
        ...nextState.turnThreadIdsById,
        [turnId]: targetThreadId
      }
    };
  }

  if (nextThread.sessionPath && nextState.sessionThreadIdsByPath[nextThread.sessionPath] !== targetThreadId) {
    nextState = {
      ...nextState,
      sessionThreadIdsByPath: {
        ...nextState.sessionThreadIdsByPath,
        [nextThread.sessionPath]: targetThreadId
      }
    };
  }

  if (isCompletedThreadLoad(nextThread, traffic)) {
    nextState = {
      ...nextState,
      cacheMetadataByThreadId: {
        ...nextState.cacheMetadataByThreadId,
        [targetThreadId]: {
          loadedAtMs: Date.now(),
          loadedSessionPath: nextThread.sessionPath
        }
      }
    };
  }

  if (isLiveThreadSessionReady(traffic)) {
    nextState = {
      ...nextState,
      cacheMetadataByThreadId: {
        ...nextState.cacheMetadataByThreadId,
        [targetThreadId]: {
          loadedAtMs: Date.now(),
          loadedSessionPath: nextThread.sessionPath
        }
      }
    };
  }

  return nextState;
}

function reduceThread(
  state: CoderThreadsState,
  threadId: string,
  traffic: CodexProtocolTraffic
): CoderThreadsState {
  const previous = state.byId[threadId] ?? getThreadReducer(threadId).initialState();
  const reducer = getThreadReducer(threadId, previous.sessionPath);
  const next = reducer.reduce(previous, traffic);
  if (next === previous && state.byId[threadId]) {
    return state;
  }
  return {
    ...state,
    byId: {
      ...state.byId,
      [threadId]: next
    }
  };
}

function rememberRequestThread(
  state: CoderThreadsState,
  requestId: string,
  threadId: string
): CoderThreadsState {
  if (state.requestThreadIdsById[requestId] === threadId) {
    return state;
  }
  return {
    ...state,
    requestThreadIdsById: {
      ...state.requestThreadIdsById,
      [requestId]: threadId
    }
  };
}

function removeThread(state: CoderThreadsState, threadId: string): CoderThreadsState {
  if (!state.byId[threadId]) {
    return state;
  }
  const { [threadId]: _removedThread, ...byId } = state.byId;
  const { [threadId]: _removedMetadata, ...cacheMetadataByThreadId } = state.cacheMetadataByThreadId;
  forgetThreadReducer(threadId);
  return {
    ...state,
    activeThreadId: state.activeThreadId === threadId ? undefined : state.activeThreadId,
    byId,
    cacheMetadataByThreadId,
    requestThreadIdsById: filterMapValues(state.requestThreadIdsById, threadId),
    sessionThreadIdsByPath: filterMapValues(state.sessionThreadIdsByPath, threadId),
    turnThreadIdsById: filterMapValues(state.turnThreadIdsById, threadId)
  };
}

function filterMapValues(input: Record<string, string>, removedValue: string): Record<string, string> {
  let changed = false;
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === removedValue) {
      changed = true;
      continue;
    }
    next[key] = value;
  }
  return changed ? next : input;
}

function replaceMappedThreadId(input: Record<string, string>, fromThreadId: string, toThreadId: string): Record<string, string> {
  let changed = false;
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    next[key] = value === fromThreadId ? toThreadId : value;
    changed ||= next[key] !== value;
  }
  return changed ? next : input;
}

function isCompletedThreadLoad(state: CodexThreadState, traffic: CodexProtocolTraffic): boolean {
  if (state.status !== "ready" || state.activeRequestIds.length > 0) {
    return false;
  }
  if (traffic.kind === "response" && traffic.method === "fs/readFile") {
    return true;
  }
  if (traffic.kind === "response" && traffic.method === "thread/read") {
    return !state.sessionPath;
  }
  return false;
}

function isLiveThreadSessionReady(traffic: CodexProtocolTraffic): boolean {
  return traffic.kind === "response" &&
    (traffic.method === "thread/start" || traffic.method === "thread/resume");
}
