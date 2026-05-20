import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { CoderSelection } from "@coder/types";
import type { CoderSelectionState } from "@coder/types";
import type { RootState } from "../../../store/configureStore";

const initialState: CoderSelectionState = {
  current: { kind: "none" },
  nextDraftId: 0
};

const selectionSlice = createSlice({
  name: "selection",
  initialState,
  reducers: {
    hydrateSelection: (state, action: PayloadAction<CoderSelection | undefined>) => {
      if (action.payload) {
        state.current = action.payload;
      }
    },
    newDraftSelected: (state, action: PayloadAction<{ projectId: string }>) => {
      const nextDraftId = state.nextDraftId + 1;
      state.nextDraftId = nextDraftId;
      state.current = {
        kind: "draft",
        draftId: `draft-${nextDraftId}`,
        projectId: action.payload.projectId
      };
    },
    threadSelected: (state, action: PayloadAction<{ projectId: string; threadId: string }>) => {
      state.current = {
        kind: "thread",
        projectId: action.payload.projectId,
        threadId: action.payload.threadId
      };
    },
    selectionCleared: (state) => {
      state.current = { kind: "none" };
    }
  }
});

export const {
  hydrateSelection,
  newDraftSelected,
  selectionCleared,
  threadSelected
} = selectionSlice.actions;
export const selectionReducer = selectionSlice.reducer;
export const selectSelection = (state: RootState) => state.selection.current;
