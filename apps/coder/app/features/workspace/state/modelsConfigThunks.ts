import { composerConfigHydrated, composerModelsHydrated } from "../../composer/state/composerSlice";
import { requestCodex } from "@coder/client";
import { DEFAULT_CODEX_CWD } from "@coder/client";
import type { AppThunk } from "../../../store/configureStore";

export function loadModels(): AppThunk<Promise<void>> {
  return async (dispatch) => {
    const response = await requestCodex(dispatch, "model/list", {
      limit: 100,
      includeHidden: false
    }, { prefix: "model-list" });
    dispatch(composerModelsHydrated(response.data ?? []));
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
      model_reasoning_effort: response.config.model_reasoning_effort
    }));
  };
}
