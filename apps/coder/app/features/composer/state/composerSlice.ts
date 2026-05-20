import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { CodexThreadState } from "@taylordb/codex";
import type {
  CodexAppServerConfig,
  CodexAppServerModel
} from "@taylordb/codex/protocol";
import {
  coderComposerReducer,
  createInitialCoderComposerState
} from "./composerState";
import type {
  CoderComposerAttachment,
  CoderComposerState,
  CoderPermissionMode,
  CoderReasoningEffort
} from "../types";

const composerSlice = createSlice({
  name: "composer",
  initialState: createInitialCoderComposerState(),
  reducers: {
    attachmentsAdded: (state, action: PayloadAction<CoderComposerAttachment[]>) =>
      coderComposerReducer(state, { type: "addAttachments", attachments: action.payload }),
    attachmentRemoved: (state, action: PayloadAction<string>) =>
      coderComposerReducer(state, { type: "removeAttachment", attachmentId: action.payload }),
    attachmentsCleared: (state) =>
      coderComposerReducer(state, { type: "clearAttachments" }),
    composerConfigHydrated: (state, action: PayloadAction<Pick<CodexAppServerConfig, "model" | "model_reasoning_effort">>) =>
      coderComposerReducer(state, {
        type: "hydrateConfig",
        model: action.payload.model,
        reasoningEffort: action.payload.model_reasoning_effort
      }),
    composerModelsHydrated: (state, action: PayloadAction<CodexAppServerModel[]>) =>
      coderComposerReducer(state, { type: "hydrateModels", models: action.payload }),
    composerPromptCleared: (state) =>
      coderComposerReducer(state, { type: "clearPrompt" }),
    composerPromptSet: (state, action: PayloadAction<string>) =>
      coderComposerReducer(state, { type: "setPrompt", prompt: action.payload }),
    composerThreadHydrated: (state, action: PayloadAction<CodexThreadState | undefined>) => {
      const thread = action.payload;
      let next = coderComposerReducer(state, {
        type: "hydrateSession",
        session: {
          threadId: thread?.threadId,
          model: thread?.session?.model,
          reasoningEffort: thread?.session?.reasoningEffort
        }
      });
      next = coderComposerReducer(next, { type: "updateTokenUsage", tokenUsage: thread?.tokenUsage });
      if (thread?.modelReroute) {
        next = coderComposerReducer(next, {
          type: "modelRerouted",
          reroute: thread.modelReroute
        });
      }
      return next;
    },
    permissionModeSelected: (state, action: PayloadAction<CoderPermissionMode>) =>
      coderComposerReducer(state, { type: "selectPermissionMode", permissionMode: action.payload }),
    reasoningEffortSelected: (state, action: PayloadAction<CoderReasoningEffort>) =>
      coderComposerReducer(state, { type: "selectReasoningEffort", reasoningEffort: action.payload }),
    modelSelected: (state, action: PayloadAction<string>) =>
      coderComposerReducer(state, { type: "selectModel", model: action.payload })
  }
});

export const {
  attachmentRemoved,
  attachmentsAdded,
  attachmentsCleared,
  composerConfigHydrated,
  composerModelsHydrated,
  composerPromptCleared,
  composerPromptSet,
  composerThreadHydrated,
  modelSelected,
  permissionModeSelected,
  reasoningEffortSelected
} = composerSlice.actions;
export const composerReducer = composerSlice.reducer;
export type { CoderComposerState };
