import type { CoderInitialData } from "@coder/types";
import { hydrateCoderInitialData } from "../features/threads/hydrateInitialData";
import { createCoderStore, type AppStore } from "./configureStore";

export function createCoderStoreFromInitialData(initialData?: CoderInitialData): AppStore {
  const store = createCoderStore();
  if (initialData) {
    hydrateCoderInitialData(store.dispatch, initialData);
  }
  return store;
}
