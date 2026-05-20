import type { CoderInitialData } from "../features/conversation/state/initialData";
import { hydrateCoderInitialData } from "../features/conversation/state/hydrateInitialData";
import { createCoderStore, type AppStore } from "./configureStore";

export function createCoderStoreFromInitialData(initialData?: CoderInitialData): AppStore {
  const store = createCoderStore();
  if (initialData) {
    hydrateCoderInitialData(store.dispatch, initialData);
  }
  return store;
}
