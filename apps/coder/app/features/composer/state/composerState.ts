import type {
  CodexModelReroute,
  CodexRuntimeSessionSettings,
  CodexThreadTokenUsage
} from "@coder/types";
import type { CodexAppServerModel } from "@coder/types";
import type {
  CoderComposerAttachment,
  CoderComposerState,
  CoderPermissionMode,
  CoderReasoningEffort
} from "@coder/types";

export const coderReasoningEfforts: CoderReasoningEffort[] = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh"
];

export const fallbackComposerModel: CodexAppServerModel = {
  id: "gpt-5.5",
  model: "gpt-5.5",
  upgrade: null,
  upgradeInfo: null,
  availabilityNux: null,
  displayName: "OpenAI: GPT-5.5",
  description: "",
  hidden: false,
  defaultReasoningEffort: "medium",
  supportedReasoningEfforts: [
    { reasoningEffort: "low", description: "" },
    { reasoningEffort: "medium", description: "" },
    { reasoningEffort: "high", description: "" },
    { reasoningEffort: "xhigh", description: "" }
  ],
  inputModalities: ["text", "image"],
  supportsPersonality: false,
  additionalSpeedTiers: [],
  serviceTiers: [],
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

export type ComposerSessionInput = CodexRuntimeSessionSettings & {
  threadId?: string;
};

export type ComposerTokenUsageInput = CodexThreadTokenUsage;

export type CoderComposerAction =
  | { type: "setPrompt"; prompt: string }
  | { type: "clearPrompt" }
  | { type: "addAttachments"; attachments: CoderComposerAttachment[] }
  | { type: "removeAttachment"; attachmentId: string }
  | { type: "clearAttachments" }
  | { type: "hydrateModels"; models: CodexAppServerModel[] }
  | { type: "hydrateConfig"; model?: string | null; reasoningEffort?: string | null }
  | { type: "hydrateSession"; session: ComposerSessionInput }
  | { type: "selectModel"; model: string }
  | { type: "selectReasoningEffort"; reasoningEffort: CoderReasoningEffort }
  | { type: "selectPermissionMode"; permissionMode: CoderPermissionMode }
  | { type: "updateTokenUsage"; tokenUsage?: ComposerTokenUsageInput }
  | { type: "modelRerouted"; reroute: CodexModelReroute };

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
        tokenUsage: action.tokenUsage
      };
    case "modelRerouted":
      return reconcileComposerState({
        ...state,
        userSelection: { ...state.userSelection, model: undefined },
        activeThread: { ...state.activeThread, model: action.reroute.toModel },
        modelReroute: action.reroute
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
  models: CodexAppServerModel[],
  modelId: string
): CoderReasoningEffort[] {
  const model = models.find((candidate) => candidate.id === modelId);
  const efforts = model?.supportedReasoningEfforts
    .map((option) => normalizeReasoningEffort(option.reasoningEffort))
    .filter((value): value is CoderReasoningEffort => Boolean(value)) ?? [];
  const fallbackEfforts = fallbackComposerModel.supportedReasoningEfforts.map((option) => option.reasoningEffort);
  return efforts.length > 0 ? efforts : fallbackEfforts;
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

function normalizeModels(models: CodexAppServerModel[]): CodexAppServerModel[] {
  const normalized = models.filter((model) => model.id);
  return normalized.length > 0 ? normalized : [fallbackComposerModel];
}

function firstString(...values: Array<string | null | undefined>): string {
  return values.find((value): value is string => typeof value === "string" && value.length > 0) ?? fallbackComposerModel.id;
}

function firstReasoningEffort(...values: Array<CoderReasoningEffort | null | undefined>): CoderReasoningEffort {
  return values.find((value): value is CoderReasoningEffort => Boolean(value)) ?? "medium";
}
