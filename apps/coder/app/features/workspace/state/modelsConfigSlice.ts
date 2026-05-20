import { createSlice } from "@reduxjs/toolkit";
import type { CodexProtocolTraffic } from "@coder/types";
import { codexTrafficReceived } from "../../connection/state/codexTrafficActions";
import type { CoderModelsConfigState } from "@coder/types";

const initialState: CoderModelsConfigState = {
  modelsStatus: "idle",
  configStatus: "idle"
};

const modelsConfigSlice = createSlice({
  name: "modelsConfig",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(codexTrafficReceived, (state, action: { payload: CodexProtocolTraffic }) => {
      const traffic = action.payload;
      if (traffic.kind === "request" && traffic.method === "model/list") {
        state.modelsStatus = "loading";
        state.error = undefined;
      }
      if (traffic.kind === "response" && traffic.method === "model/list") {
        state.modelsStatus = "ready";
        state.error = undefined;
      }
      if (traffic.kind === "responseError" && traffic.method === "model/list") {
        state.modelsStatus = "failed";
        state.error = errorMessage(traffic.error);
      }
      if (traffic.kind === "request" && traffic.method === "config/read") {
        state.configStatus = "loading";
        state.error = undefined;
      }
      if (traffic.kind === "response" && traffic.method === "config/read") {
        state.configStatus = "ready";
        state.error = undefined;
      }
      if (traffic.kind === "responseError" && traffic.method === "config/read") {
        state.configStatus = "failed";
        state.error = errorMessage(traffic.error);
      }
    });
  }
});

export const modelsConfigReducer = modelsConfigSlice.reducer;

function errorMessage(error: unknown): string {
  return error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message
    : JSON.stringify(error);
}
