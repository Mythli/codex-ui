import { combineReducers } from "@reduxjs/toolkit";
import { composerReducer } from "../features/composer/state/composerSlice";
import { codexConnectionReducer } from "../features/connection/state/codexConnectionSlice";
import { chatListMetaReducer } from "../features/conversation/state/chatListMetaSlice";
import { threadIndexReducer } from "../features/conversation/state/threadIndexSlice";
import { threadsReducer } from "../features/conversation/state/threadsSlice";
import { fixtureReducer } from "../features/fixturePlayback/fixtureSlice";
import { selectionReducer } from "../features/navigation/state/selectionSlice";
import { modelsConfigReducer } from "../features/workspace/state/modelsConfigSlice";

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
