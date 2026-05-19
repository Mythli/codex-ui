export interface LayoutState {
  isSidebarOpen: boolean;
}

export interface LayoutStorageAdapter {
  /** Loads the saved layout state */
  load: () => Promise<LayoutState | null>;
  /** Persists the current layout state */
  save: (state: LayoutState) => Promise<void>;
}
