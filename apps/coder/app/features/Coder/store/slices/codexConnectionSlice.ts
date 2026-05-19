import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { CodexProtocolTraffic } from "@taylordb/codex/protocol";
import { codexTrafficReceived } from "../actions/codexTrafficActions";
import type { CoderConnectionState } from "../types";

const MAX_DIAGNOSTICS = 50;

const initialState: CoderConnectionState = {
  status: "idle",
  initialized: false,
  diagnostics: []
};

const codexConnectionSlice = createSlice({
  name: "codexConnection",
  initialState,
  reducers: {
    codexSocketConnecting: (state) => {
      state.status = "connecting";
      state.error = undefined;
    },
    codexSocketConnected: (state) => {
      state.status = "connected";
      state.initialized = true;
      state.error = undefined;
    },
    codexSocketDisconnected: (state, action: PayloadAction<string | undefined>) => {
      state.status = "disconnected";
      state.initialized = false;
      state.error = action.payload;
    },
    codexSocketClosed: (state, action: PayloadAction<{ exitCode: number | null; signal: string | null } | undefined>) => {
      state.status = "closed";
      state.initialized = false;
      state.closed = action.payload;
    },
    codexSocketFailed: (state, action: PayloadAction<string>) => {
      state.status = "failed";
      state.initialized = false;
      state.error = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(codexTrafficReceived, (state, action: PayloadAction<CodexProtocolTraffic>) => {
      if (action.payload.kind !== "diagnostic") {
        return;
      }
      state.diagnostics = [...state.diagnostics, action.payload.text].slice(-MAX_DIAGNOSTICS);
    });
  }
});

export const {
  codexSocketClosed,
  codexSocketConnected,
  codexSocketConnecting,
  codexSocketDisconnected,
  codexSocketFailed
} = codexConnectionSlice.actions;
export const codexConnectionReducer = codexConnectionSlice.reducer;
