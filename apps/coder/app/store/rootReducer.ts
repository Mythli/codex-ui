import { combineReducers } from "@reduxjs/toolkit";
import { composerReducer } from "../features/composer/state/composerSlice";
import { codexConnectionReducer } from "@app/features/connection/state/codexConnectionSlice";
import { chatListMetaReducer } from "../features/threads/state/threadListMetaSlice";
import { threadIndexReducer } from "../features/threads/state/threadIndexSlice";
import { threadsReducer } from "../features/thread/state/loadedThreadsSlice";
import { selectionReducer } from "../features/threads/state/threadSelectionSlice";
import { modelsConfigReducer } from "../features/workspace/state/modelsConfigSlice";

export const rootReducer = combineReducers({
  codexConnection: codexConnectionReducer,
  threadIndex: threadIndexReducer,
  threads: threadsReducer,
  selection: selectionReducer,
  composer: composerReducer,
  chatListMeta: chatListMetaReducer,
  modelsConfig: modelsConfigReducer
});
