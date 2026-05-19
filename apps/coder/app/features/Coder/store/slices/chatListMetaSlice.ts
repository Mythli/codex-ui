import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { CodexTrafficPacket, type CodexProtocolTraffic } from "@taylordb/codex/protocol";
import { codexTrafficReceived } from "../actions/codexTrafficActions";
import type { CoderChatListMetaState } from "../types";

const initialState: CoderChatListMetaState = {
  unreadThreadIds: [],
  runningThreadIds: [],
  hydratingThreadIds: []
};

const chatListMetaSlice = createSlice({
  name: "chatListMeta",
  initialState,
  reducers: {
    threadHydrationStarted: (state, action: PayloadAction<string>) => {
      if (!state.hydratingThreadIds.includes(action.payload)) {
        state.hydratingThreadIds.push(action.payload);
      }
    },
    threadHydrationFinished: (state, action: PayloadAction<string>) => {
      state.hydratingThreadIds = state.hydratingThreadIds.filter((id) => id !== action.payload);
    },
    threadUnreadCleared: (state, action: PayloadAction<string>) => {
      state.unreadThreadIds = state.unreadThreadIds.filter((id) => id !== action.payload);
    },
    threadUnreadMarked: (state, action: PayloadAction<string>) => {
      if (!state.unreadThreadIds.includes(action.payload)) {
        state.unreadThreadIds.push(action.payload);
      }
    },
    threadRunningCleared: (state, action: PayloadAction<string>) => {
      state.runningThreadIds = state.runningThreadIds.filter((id) => id !== action.payload);
    }
  },
  extraReducers: (builder) => {
    builder.addCase(codexTrafficReceived, (state, action: PayloadAction<CodexProtocolTraffic>) => {
      const packet = CodexTrafficPacket.from(action.payload);
      if (packet.isEvent("thread/archived") && packet.threadId) {
        state.hydratingThreadIds = state.hydratingThreadIds.filter((id) => id !== packet.threadId);
        state.runningThreadIds = state.runningThreadIds.filter((id) => id !== packet.threadId);
        state.unreadThreadIds = state.unreadThreadIds.filter((id) => id !== packet.threadId);
        return;
      }
      if ((packet.isRequest("turn/start") || packet.isEvent("turn/started")) && packet.threadId && !packet.threadId.startsWith("local-thread:")) {
        if (!state.runningThreadIds.includes(packet.threadId)) {
          state.runningThreadIds.push(packet.threadId);
        }
      }
    });
  }
});

export const {
  threadHydrationFinished,
  threadHydrationStarted,
  threadRunningCleared,
  threadUnreadCleared,
  threadUnreadMarked
} = chatListMetaSlice.actions;
export const chatListMetaReducer = chatListMetaSlice.reducer;
