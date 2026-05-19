import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { CoderFixtureState } from "../types";

const fixtureSlice = createSlice({
  name: "fixture",
  initialState: { status: "idle" } as CoderFixtureState,
  reducers: {
    fixtureStatusChanged: (_state, action: PayloadAction<CoderFixtureState>) => action.payload
  }
});

export const { fixtureStatusChanged } = fixtureSlice.actions;
export const fixtureReducer = fixtureSlice.reducer;
