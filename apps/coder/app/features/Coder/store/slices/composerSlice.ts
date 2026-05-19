import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { CodexThreadState } from "@taylordb/codex";
import {
  coderComposerReducer,
  createInitialCoderComposerState,
  normalizeReasoningEffort,
  type ComposerTokenUsageInput
} from "../reducers/composerState";
import type {
  CoderComposerAttachment,
  CoderComposerState,
  CoderModelItem,
  CoderPermissionMode,
  CoderReasoningEffort
} from "../../../../coderui/features/CoderCore/types";
import type { CoderRuntimeModel } from "../types";

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
    composerConfigHydrated: (state, action: PayloadAction<{ model?: string | null; reasoningEffort?: string | null }>) =>
      coderComposerReducer(state, { type: "hydrateConfig", ...action.payload }),
    composerModelsHydrated: (state, action: PayloadAction<CoderRuntimeModel[]>) =>
      coderComposerReducer(state, { type: "hydrateModels", models: modelsForRuntime(action.payload, state.models) }),
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
      next = coderComposerReducer(next, { type: "updateTokenUsage", tokenUsage: thread?.tokenUsage as ComposerTokenUsageInput | undefined });
      if (thread?.modelReroute) {
        next = coderComposerReducer(next, {
          type: "modelRerouted",
          fromModel: thread.modelReroute.fromModel,
          toModel: thread.modelReroute.toModel
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

function modelsForRuntime(
  values: CoderRuntimeModel[],
  fallback: CoderModelItem[]
): CoderModelItem[] {
  const mapped = values.map((model) => ({
    id: model.model,
    label: model.displayName,
    defaultReasoningEffort: normalizeReasoningEffort(model.defaultReasoningEffort),
    supportedReasoningEfforts: normalizeSupportedReasoningEfforts(model.supportedReasoningEfforts),
    isDefault: model.isDefault
  }));
  return mapped.length > 0 ? mapped : fallback;
}

function normalizeSupportedReasoningEfforts(
  values: CoderRuntimeModel["supportedReasoningEfforts"]
): CoderReasoningEffort[] | undefined {
  const efforts = values
    ?.map((value) => {
      if (typeof value === "string") {
        return normalizeReasoningEffort(value);
      }
      return normalizeReasoningEffort(value.reasoningEffort ?? value.effort);
    })
    .filter((value): value is CoderReasoningEffort => Boolean(value));
  return efforts && efforts.length > 0 ? efforts : undefined;
}
