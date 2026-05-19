import type {
  CodexRuntimeState,
  CodexThreadIndexState,
  CodexUIRuntime
} from "@taylordb/codex";
import { CodexThreadIndexReducer } from "@taylordb/codex";
import { create } from "zustand";
import { selectCurrentProjectId, selectIsRunning } from "./coderSelectors";
import {
  coderComposerReducer,
  createInitialCoderComposerState,
  type ComposerSessionInput,
  type ComposerTokenUsageInput,
  normalizeReasoningEffort,
  permissionModeToRequestOverrides
} from "./composerState";
import type {
  CoderComposerAttachment,
  CoderComposerState,
  CoderModelItem,
  CoderPermissionMode,
  CoderReasoningEffort,
  CoderRuntimeModel,
  CoderSelection
} from "../types";

export type CoderStoreState = {
  composer: CoderComposerState;
  defaultCwd?: string;
  hydratingThreadIds: string[];
  nextDraftId: number;
  runtime?: CodexUIRuntime;
  runtimeState: CodexRuntimeState;
  selection: CoderSelection;
  threadIndex: CodexThreadIndexState;
  unreadThreadIds: string[];
};

type CoderStoreActions = {
  addAttachments(attachments: CoderComposerAttachment[]): void;
  beginThreadHydration(threadId: string): void;
  bindRuntime(runtime: CodexUIRuntime, input?: { defaultCwd?: string }): void;
  clearRuntime(runtime: CodexUIRuntime): void;
  commitDraft(draftId: string, threadId: string, projectId: string): void;
  endThreadHydration(threadId: string): void;
  hydrateConfig(input: { model?: string | null; reasoningEffort?: string | null }): void;
  hydrateModels(models: CoderRuntimeModel[]): void;
  hydrateSession(session: ComposerSessionInput): void;
  modelRerouted(input: { fromModel: string; toModel: string }): void;
  newChat(projectId?: string): void;
  removeAttachment(attachmentId: string): void;
  selectChat(chatId: string, projectId: string): void;
  setPrompt(prompt: string): void;
  setRuntimeState(state: CodexRuntimeState): void;
  setSelectedModel(model: string): void;
  setSelectedPermissionMode(permissionMode: CoderPermissionMode): void;
  setSelectedReasoningEffort(reasoningEffort: CoderReasoningEffort): void;
  setThreadIndex(threadIndex: CodexThreadIndexState): void;
  submitPrompt(): Promise<{ createdThreadId?: string } | undefined>;
  updateTokenUsage(tokenUsage?: ComposerTokenUsageInput): void;
};

export type CoderStore = CoderStoreState & CoderStoreActions;

const emptyRuntimeState: CodexRuntimeState = {
  status: "empty",
  activeRequestIds: [],
  renderBlocks: []
};

const emptyThreadIndex = new CodexThreadIndexReducer().initialState();

export const useCoderStore = create<CoderStore>((set, get) => ({
  composer: createInitialCoderComposerState(),
  hydratingThreadIds: [],
  nextDraftId: 0,
  runtimeState: emptyRuntimeState,
  selection: { kind: "none" },
  threadIndex: emptyThreadIndex,
  unreadThreadIds: [],

  addAttachments: (attachments) => set((state) => ({
    composer: coderComposerReducer(state.composer, { type: "addAttachments", attachments })
  })),

  beginThreadHydration: (threadId) => set((state) => ({
    hydratingThreadIds: state.hydratingThreadIds.includes(threadId)
      ? state.hydratingThreadIds
      : [...state.hydratingThreadIds, threadId]
  })),

  bindRuntime: (runtime, input) => set({
    defaultCwd: input?.defaultCwd,
    runtime,
    runtimeState: runtime.state,
    threadIndex: runtime.threadIndex
  }),

  clearRuntime: (runtime) => set((state) => state.runtime === runtime
    ? {
      runtime: undefined,
      runtimeState: emptyRuntimeState,
      threadIndex: emptyThreadIndex,
      hydratingThreadIds: [],
      unreadThreadIds: []
    }
    : state),

  commitDraft: (draftId, threadId, projectId) => set((state) => {
    if (state.selection.kind !== "draft" || state.selection.draftId !== draftId) {
      return state;
    }
    const unreadThreadIds = state.unreadThreadIds.filter((id) => id !== threadId);
    return {
      selection: {
        kind: "thread",
        threadId,
        projectId
      },
      unreadThreadIds
    };
  }),

  hydrateConfig: (input) => set((state) => ({
    composer: coderComposerReducer(state.composer, { type: "hydrateConfig", ...input })
  })),

  endThreadHydration: (threadId) => set((state) => ({
    hydratingThreadIds: state.hydratingThreadIds.filter((id) => id !== threadId)
  })),

  hydrateModels: (models) => set((state) => ({
    composer: coderComposerReducer(state.composer, {
      type: "hydrateModels",
      models: modelsForRuntime(models, state.composer.models)
    })
  })),

  hydrateSession: (session) => set((state) => ({
    composer: coderComposerReducer(state.composer, { type: "hydrateSession", session })
  })),

  modelRerouted: (input) => set((state) => ({
    composer: coderComposerReducer(state.composer, { type: "modelRerouted", ...input })
  })),

  newChat: (projectId) => set((state) => {
    const draftId = state.nextDraftId + 1;
    return {
      nextDraftId: draftId,
      selection: {
        kind: "draft",
        draftId: `draft-${draftId}`,
        projectId: projectId ?? selectCurrentProjectId(state)
      },
      composer: coderComposerReducer(
        coderComposerReducer(state.composer, { type: "updateTokenUsage", tokenUsage: undefined }),
        { type: "clearAttachments" }
      )
    };
  }),

  removeAttachment: (attachmentId) => set((state) => ({
    composer: coderComposerReducer(state.composer, { type: "removeAttachment", attachmentId })
  })),

  selectChat: (chatId, projectId) => set((state) => {
    const unreadThreadIds = state.unreadThreadIds.filter((id) => id !== chatId);
    return {
      selection: {
        kind: "thread",
        threadId: chatId,
        projectId
      },
      unreadThreadIds
    };
  }),

  setPrompt: (prompt) => set((state) => ({
    composer: coderComposerReducer(state.composer, { type: "setPrompt", prompt })
  })),

  setRuntimeState: (runtimeState) => set((state) => ({
    runtimeState,
    composer: hydrateComposerFromRuntimeState(state.composer, runtimeState)
  })),

  setSelectedModel: (model) => set((state) => ({
    composer: coderComposerReducer(state.composer, { type: "selectModel", model })
  })),

  setSelectedPermissionMode: (permissionMode) => set((state) => ({
    composer: coderComposerReducer(state.composer, { type: "selectPermissionMode", permissionMode })
  })),

  setSelectedReasoningEffort: (reasoningEffort) => set((state) => ({
    composer: coderComposerReducer(state.composer, { type: "selectReasoningEffort", reasoningEffort })
  })),

  setThreadIndex: (threadIndex) => set((state) => {
    const selectedThreadId = state.selection.kind === "thread" ? state.selection.threadId : undefined;
    const nextUnreadThreadIds = markCompletedBackgroundThreadsUnread({
      nextThreadIndex: threadIndex,
      previousThreadIndex: state.threadIndex,
      selectedThreadId,
      unreadThreadIds: state.unreadThreadIds
    });
    return {
      threadIndex,
      unreadThreadIds: nextUnreadThreadIds
    };
  }),

  submitPrompt: async () => {
    const state = get();
    const runtime = state.runtime;
    const message = state.composer.prompt.trim();
    const attachments = state.composer.attachments;
    const isRunning = selectIsRunning(state);
    if (!runtime || (!message && attachments.length === 0)) {
      return;
    }

    set((current) => ({
      composer: coderComposerReducer(current.composer, { type: "clearPrompt" })
    }));

    const attachmentText = attachmentReferenceText(attachments);
    const input = attachments.length > 0
      ? [
        ...(message ? [{ type: "text" as const, text: message, text_elements: [] }] : []),
        ...(attachmentText ? [{ type: "text" as const, text: attachmentText, text_elements: [] }] : []),
        ...attachments.flatMap((attachment) => attachment.input ? [attachment.input] : [])
      ]
      : message;
    const permissionOverrides = permissionModeToRequestOverrides(state.composer.selectedPermissionMode);

    try {
      const selection = get().selection;
      const composer = get().composer;
      if (selection.kind === "draft") {
        const result = await runtime.actions.startThreadWithMessage({
          input,
          cwd: selection.projectId,
          model: composer.selectedModel,
          reasoningEffort: composer.selectedReasoningEffort,
          ...permissionOverrides
        });
        get().commitDraft(selection.draftId, result.threadId, selection.projectId);
        set((current) => ({
          composer: coderComposerReducer(current.composer, { type: "clearAttachments" })
        }));
        return { createdThreadId: result.threadId };
      }
      if (selection.kind !== "thread") {
        return;
      }
      if (isRunning) {
        return;
      }
      set((current) => ({
        unreadThreadIds: current.unreadThreadIds.filter((id) => id !== selection.threadId)
      }));
      await runtime.actions.sendMessageToThread({
        threadId: selection.threadId,
        input,
        model: composer.selectedModel,
        reasoningEffort: composer.selectedReasoningEffort,
        ...permissionOverrides
      });
      set((current) => ({
        composer: coderComposerReducer(current.composer, { type: "clearAttachments" })
      }));
    } catch {
      return;
    }
  },

  updateTokenUsage: (tokenUsage) => set((state) => ({
    composer: coderComposerReducer(state.composer, { type: "updateTokenUsage", tokenUsage })
  }))
}));

function attachmentReferenceText(attachments: readonly CoderComposerAttachment[]): string {
  const fileAttachments = attachments.filter((attachment) => attachment.kind === "file");
  if (fileAttachments.length === 0) {
    return "";
  }
  return fileAttachments.map((attachment) => {
    const mimeType = attachment.mimeType || "application/octet-stream";
    return `Attached file: ${attachment.name} (${mimeType}, ${formatAttachmentSize(attachment.size)}) at ${attachment.path}. Inspect it if relevant.`;
  }).join("\n");
}

function formatAttachmentSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "unknown size";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  for (const unit of units) {
    if (value < 1024 || unit === units.at(-1)) {
      return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
    }
    value /= 1024;
  }
  return `${bytes} B`;
}

function markCompletedBackgroundThreadsUnread({
  nextThreadIndex,
  previousThreadIndex,
  selectedThreadId,
  unreadThreadIds
}: {
  nextThreadIndex: CodexThreadIndexState;
  previousThreadIndex: CodexThreadIndexState;
  selectedThreadId?: string;
  unreadThreadIds: readonly string[];
}): string[] {
  const nextUnread = new Set(unreadThreadIds);
  for (const [threadId, nextThread] of Object.entries(nextThreadIndex.threadsById)) {
    if (threadId === selectedThreadId) {
      nextUnread.delete(threadId);
      continue;
    }
    const previousThread = previousThreadIndex.threadsById[threadId];
    if (previousThread?.activity === "running" && nextThread.activity !== "running") {
      nextUnread.add(threadId);
    }
  }
  return [...nextUnread];
}

function hydrateComposerFromRuntimeState(
  composer: CoderComposerState,
  runtimeState: CodexRuntimeState
): CoderComposerState {
  let next = coderComposerReducer(composer, {
    type: "hydrateSession",
    session: {
      threadId: runtimeState.threadId,
      model: runtimeState.session?.model,
      reasoningEffort: runtimeState.session?.reasoningEffort
    }
  });
  next = coderComposerReducer(next, { type: "updateTokenUsage", tokenUsage: runtimeState.tokenUsage });
  if (runtimeState.modelReroute) {
    next = coderComposerReducer(next, {
      type: "modelRerouted",
      fromModel: runtimeState.modelReroute.fromModel,
      toModel: runtimeState.modelReroute.toModel
    });
  }
  return next;
}

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
