import { requestCodex } from "../../adapters/codexClient";
import { DEFAULT_CODEX_CWD } from "../../adapters/codexTransport";
import type { AppThunk } from "../index";
import { composerConfigHydrated, composerModelsHydrated } from "../slices/composerSlice";

export function loadModels(): AppThunk<Promise<void>> {
  return async (dispatch) => {
    const response = await requestCodex(dispatch, "model/list", {
      limit: 100,
      includeHidden: false
    }, { prefix: "model-list" });
    dispatch(composerModelsHydrated((response.data ?? []).map((model) => ({
      id: model.id ?? model.model,
      model: model.model ?? model.id ?? "",
      displayName: model.displayName ?? model.model ?? "Model",
      defaultReasoningEffort: model.defaultReasoningEffort,
      supportedReasoningEfforts: model.supportedReasoningEfforts,
      isDefault: model.isDefault
    }))));
  };
}

export function loadConfig(cwd = DEFAULT_CODEX_CWD): AppThunk<Promise<void>> {
  return async (dispatch) => {
    const response = await requestCodex(dispatch, "config/read", {
      cwd,
      includeLayers: false
    }, { prefix: "config-read" });
    dispatch(composerConfigHydrated({
      model: response.config.model,
      reasoningEffort: response.config.model_reasoning_effort
    }));
  };
}
