import type {
  CoderComposerAttachment,
  CoderComposerState,
  CoderContextUsage,
  CoderModelItem,
  CoderPermissionMode,
  CoderReasoningEffort
} from "../types";

export const coderReasoningEfforts: CoderReasoningEffort[] = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh"
];

export const fallbackComposerModel: CoderModelItem = {
  id: "gpt-5.5",
  label: "OpenAI: GPT-5.5",
  defaultReasoningEffort: "medium",
  supportedReasoningEfforts: ["low", "medium", "high", "xhigh"],
  isDefault: true
};

export const coderPermissionModes: CoderPermissionMode[] = [
  "default",
  "auto-review",
  "full-access"
];

export function permissionModeToRequestOverrides(mode: CoderPermissionMode): {
  sandbox?: "read-only" | "workspace-write" | "danger-full-access";
  approvalPolicy?: "untrusted" | "on-request" | "never";
} {
  if (mode === "auto-review") {
    return { sandbox: "workspace-write", approvalPolicy: "on-request" };
  }
  if (mode === "full-access") {
    return { sandbox: "danger-full-access", approvalPolicy: "never" };
  }
  return {};
}

export type ComposerSessionInput = {
  threadId?: string;
  model?: string | null;
  reasoningEffort?: string | null;
};

export type ComposerTokenUsageInput = {
  total?: { totalTokens?: number };
  last?: { totalTokens?: number; inputTokens?: number };
  modelContextWindow?: number | null;
};

export type CoderComposerAction =
  | { type: "setPrompt"; prompt: string }
  | { type: "clearPrompt" }
  | { type: "addAttachments"; attachments: CoderComposerAttachment[] }
  | { type: "removeAttachment"; attachmentId: string }
  | { type: "clearAttachments" }
  | { type: "hydrateModels"; models: CoderModelItem[] }
  | { type: "hydrateConfig"; model?: string | null; reasoningEffort?: string | null }
  | { type: "hydrateSession"; session: ComposerSessionInput }
  | { type: "selectModel"; model: string }
  | { type: "selectReasoningEffort"; reasoningEffort: CoderReasoningEffort }
  | { type: "selectPermissionMode"; permissionMode: CoderPermissionMode }
  | { type: "updateTokenUsage"; tokenUsage?: ComposerTokenUsageInput }
  | { type: "modelRerouted"; fromModel: string; toModel: string };

export function createInitialCoderComposerState(): CoderComposerState {
  return reconcileComposerState({
    prompt: "",
    attachments: [],
    models: [fallbackComposerModel],
    selectedModel: fallbackComposerModel.id,
    selectedReasoningEffort: "medium",
    selectedPermissionMode: "default",
    configDefaults: {},
    activeThread: {},
    userSelection: {}
  });
}

export function coderComposerReducer(
  state: CoderComposerState,
  action: CoderComposerAction
): CoderComposerState {
  switch (action.type) {
    case "setPrompt":
      return { ...state, prompt: action.prompt };
    case "clearPrompt":
      return { ...state, prompt: "" };
    case "addAttachments":
      return { ...state, attachments: [...state.attachments, ...action.attachments] };
    case "removeAttachment":
      return {
        ...state,
        attachments: state.attachments.filter((attachment) => attachment.id !== action.attachmentId)
      };
    case "clearAttachments":
      return { ...state, attachments: [] };
    case "hydrateModels":
      return reconcileComposerState({ ...state, models: normalizeModels(action.models) });
    case "hydrateConfig":
      return reconcileComposerState({
        ...state,
        configDefaults: {
          model: action.model,
          reasoningEffort: normalizeReasoningEffort(action.reasoningEffort)
        }
      });
    case "hydrateSession":
      return reconcileComposerState({
        ...state,
        activeThread: {
          threadId: action.session.threadId,
          model: action.session.model,
          reasoningEffort: normalizeReasoningEffort(action.session.reasoningEffort)
        }
      });
    case "selectModel":
      return reconcileComposerState({
        ...state,
        userSelection: {
          model: action.model,
          reasoningEffort: state.userSelection.reasoningEffort
        }
      });
    case "selectReasoningEffort":
      return reconcileComposerState({
        ...state,
        userSelection: {
          ...state.userSelection,
          reasoningEffort: action.reasoningEffort
        }
      });
    case "selectPermissionMode":
      return { ...state, selectedPermissionMode: action.permissionMode };
    case "updateTokenUsage":
      return {
        ...state,
        contextUsage: contextUsageFromTokenUsage(action.tokenUsage)
      };
    case "modelRerouted":
      return reconcileComposerState({
        ...state,
        userSelection: { ...state.userSelection, model: undefined },
        activeThread: { ...state.activeThread, model: action.toModel },
        modelReroute: {
          fromModel: action.fromModel,
          toModel: action.toModel
        }
      });
    default:
      return state;
  }
}

export function normalizeReasoningEffort(value: string | null | undefined): CoderReasoningEffort | undefined {
  return coderReasoningEfforts.includes(value as CoderReasoningEffort)
    ? value as CoderReasoningEffort
    : undefined;
}

export function supportedEffortsForModel(
  models: CoderModelItem[],
  modelId: string
): CoderReasoningEffort[] {
  const model = models.find((candidate) => candidate.id === modelId);
  const efforts = model?.supportedReasoningEfforts?.filter(Boolean) ?? [];
  return efforts.length > 0 ? efforts : fallbackComposerModel.supportedReasoningEfforts!;
}

function reconcileComposerState(state: CoderComposerState): CoderComposerState {
  const models = normalizeModels(state.models);
  const model = firstString(
    state.userSelection.model,
    state.activeThread.model,
    state.configDefaults.model,
    models.find((candidate) => candidate.isDefault)?.id,
    models[0]?.id,
    fallbackComposerModel.id
  );
  const modelEfforts = supportedEffortsForModel(models, model);
  const preferredEffort = firstReasoningEffort(
    state.userSelection.reasoningEffort,
    state.activeThread.reasoningEffort,
    state.configDefaults.reasoningEffort,
    models.find((candidate) => candidate.id === model)?.defaultReasoningEffort,
    fallbackComposerModel.defaultReasoningEffort,
    "medium"
  );
  const selectedReasoningEffort = modelEfforts.includes(preferredEffort)
    ? preferredEffort
    : modelEfforts[0] ?? "medium";

  return {
    ...state,
    models,
    selectedModel: model,
    selectedReasoningEffort
  };
}

function normalizeModels(models: CoderModelItem[]): CoderModelItem[] {
  const normalized = models.filter((model) => model.id);
  return normalized.length > 0 ? normalized : [fallbackComposerModel];
}

function firstString(...values: Array<string | null | undefined>): string {
  return values.find((value): value is string => typeof value === "string" && value.length > 0) ?? fallbackComposerModel.id;
}

function firstReasoningEffort(...values: Array<CoderReasoningEffort | null | undefined>): CoderReasoningEffort {
  return values.find((value): value is CoderReasoningEffort => Boolean(value)) ?? "medium";
}

function contextUsageFromTokenUsage(input: ComposerTokenUsageInput | undefined): CoderContextUsage | undefined {
  const cumulativeTokens = input?.total?.totalTokens;
  const lastTokens = input?.last?.totalTokens;
  const activeInputTokens = input?.last?.inputTokens;
  const contextWindow = input?.modelContextWindow;
  if (
    typeof cumulativeTokens !== "number" ||
    typeof lastTokens !== "number" ||
    typeof activeInputTokens !== "number" ||
    typeof contextWindow !== "number" ||
    contextWindow <= 0
  ) {
    return undefined;
  }
  const activeTokens = Math.min(activeInputTokens, contextWindow);
  const usedPercent = Math.min(100, Math.max(0, Math.round((activeTokens / contextWindow) * 100)));
  return {
    activeTokens,
    activeInputTokens,
    lastTokens,
    cumulativeTokens,
    contextWindow,
    usedPercent,
    remainingPercent: Math.max(0, 100 - usedPercent),
    remainingTokens: Math.max(0, contextWindow - activeTokens),
    activeTokensLabel: formatCompactNumber(activeTokens),
    cumulativeTokensLabel: formatCompactNumber(cumulativeTokens),
    contextWindowLabel: formatCompactNumber(contextWindow),
    ringDegrees: usedPercent * 3.6
  };
}

function formatCompactNumber(value: number) {
  if (value >= 1_000_000) {
    return `${Math.round(value / 100_000) / 10}m`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}k`;
  }
  return String(value);
}
