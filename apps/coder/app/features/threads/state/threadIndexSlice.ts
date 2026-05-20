import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { CodexThreadIndexState } from "@coder/types";
import { CodexTrafficPacket, type CodexProtocolTraffic } from "@coder/protocol";
import { codexTrafficReceived } from "../../connection/state/codexTrafficActions";
import { metadataThreadId } from "../../connection/state/trafficRouting";
import { getThreadIndexReducer, initialThreadIndexState } from "../../thread/state/threadReducerCache";

const threadIndexSlice = createSlice({
  name: "threadIndex",
  initialState: initialThreadIndexState(),
  reducers: {
    hydrateThreadIndex: (_state, action: PayloadAction<CodexThreadIndexState>) => action.payload
  },
  extraReducers: (builder) => {
    builder.addCase(codexTrafficReceived, (state, action: PayloadAction<CodexProtocolTraffic>) => {
      const packet = CodexTrafficPacket.from(action.payload);
      const targetThreadId = packet.threadId ?? metadataThreadId(action.payload);
      if (targetThreadId?.startsWith("local-thread:")) {
        return state;
      }
      return getThreadIndexReducer().reduce(state, action.payload);
    });
  }
});

export const { hydrateThreadIndex } = threadIndexSlice.actions;
export const threadIndexReducer = threadIndexSlice.reducer;
