import {
  configureStore,
  createListenerMiddleware,
  type ThunkAction,
  type UnknownAction
} from "@reduxjs/toolkit";
import { CodexTrafficPacket } from "@coder/protocol";
import { codexTrafficReceived } from "@app/features/connection/state/codexTrafficActions";
import { threadUnreadCleared, threadUnreadMarked } from "../features/threads/state/threadListMetaSlice";
import { threadSelected } from "../features/threads/state/threadSelectionSlice";
import { rootReducer } from "./rootReducer";

const listenerMiddleware = createListenerMiddleware();

export function createCoderStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        immutableCheck: false,
        serializableCheck: false
      }).prepend(listenerMiddleware.middleware),
    preloadedState: preloadedState as RootState | undefined
  });
}

export type RootState = ReturnType<typeof rootReducer>;
export type AppStore = ReturnType<typeof createCoderStore>;
export type AppDispatch = AppStore["dispatch"];
export type AppThunk<ReturnType = void> = ThunkAction<ReturnType, RootState, unknown, UnknownAction>;

listenerMiddleware.startListening({
  actionCreator: threadSelected,
  effect: (action, listenerApi) => {
    listenerApi.dispatch(threadUnreadCleared(action.payload.threadId));
  }
});

listenerMiddleware.startListening({
  actionCreator: codexTrafficReceived,
  effect: (action, listenerApi) => {
    if (action.payload.kind !== "event") {
      return;
    }
    const packet = CodexTrafficPacket.from(action.payload);
    const state = listenerApi.getState() as RootState;
    const threadId = packet.threadId ??
      (packet.turnId ? state.threads.turnThreadIdsById[packet.turnId] : undefined) ??
      (packet.turnId ? state.threadIndex.threadIdsByTurnId[packet.turnId] : undefined);
    if (!threadId || threadId.startsWith("local-thread:")) {
      return;
    }
    const method = action.payload.event.method === "unknown"
      ? action.payload.event.eventMethod
      : action.payload.event.method;
    const params = action.payload.event.params as Record<string, unknown>;
    const selectedThreadId = state.selection.current.kind === "thread"
      ? state.selection.current.threadId
      : undefined;
    if (selectedThreadId === threadId) {
      listenerApi.dispatch(threadUnreadCleared(threadId));
      return;
    }
    if (method === "turn/completed" || (method === "thread/status/changed" && !isActiveThreadStatus(params.status))) {
      listenerApi.dispatch(threadUnreadMarked(threadId));
    }
  }
});

function isActiveThreadStatus(status: unknown): boolean {
  return Boolean(status && typeof status === "object" && "type" in status && status.type === "active");
}
