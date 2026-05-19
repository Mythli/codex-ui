import {
  combineReducers,
  configureStore,
  createListenerMiddleware,
  type ThunkAction,
  type UnknownAction
} from "@reduxjs/toolkit";
import { CodexTrafficPacket } from "@taylordb/codex/protocol";
import { codexTrafficReceived } from "./actions/codexTrafficActions";
import { chatListMetaReducer, threadRunningCleared, threadUnreadCleared, threadUnreadMarked } from "./slices/chatListMetaSlice";
import { codexConnectionReducer } from "./slices/codexConnectionSlice";
import { composerReducer } from "./slices/composerSlice";
import { fixtureReducer } from "./slices/fixtureSlice";
import { modelsConfigReducer } from "./slices/modelsConfigSlice";
import { threadsReducer } from "./slices/threadsSlice";
import { selectionReducer, threadSelected } from "./slices/selectionSlice";
import { threadIndexReducer } from "./slices/threadIndexSlice";

const listenerMiddleware = createListenerMiddleware();

export const rootReducer = combineReducers({
  codexConnection: codexConnectionReducer,
  threadIndex: threadIndexReducer,
  threads: threadsReducer,
  selection: selectionReducer,
  composer: composerReducer,
  chatListMeta: chatListMetaReducer,
  modelsConfig: modelsConfigReducer,
  fixture: fixtureReducer
});

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

export const coderStore = createCoderStore();

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
    const selectedThreadId = state.selection.current.kind === "thread"
      ? state.selection.current.threadId
      : undefined;
    if (selectedThreadId === threadId) {
      listenerApi.dispatch(threadUnreadCleared(threadId));
      if (method === "turn/completed") {
        listenerApi.dispatch(threadRunningCleared(threadId));
      }
      return;
    }
    if (method === "turn/completed" || method === "thread/status/changed") {
      listenerApi.dispatch(threadUnreadMarked(threadId));
    }
    if (method === "turn/completed") {
      listenerApi.dispatch(threadRunningCleared(threadId));
    }
  }
});
