import { z } from 'zod';
import { LayoutStorageAdapter, LayoutState } from "../types/adapters";

const STORAGE_KEY = 'lui_layout_state';

const layoutStateSchema = z.object({
  isSidebarOpen: z.boolean(),
});

export const layoutLocalStorageAdapter: LayoutStorageAdapter = {
  load: async () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return null;
      
      const parsedJson = JSON.parse(data);
      const result = layoutStateSchema.safeParse(parsedJson);

      if (!result.success) {
        console.warn('Layout local storage data is corrupted. Resetting state.', result.error);
        return null;
      }

      return result.data;
    } catch (e) {
      console.error('Failed to load layout state', e);
      return null;
    }
  },
  save: async (state: LayoutState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save layout state', e);
    }
  }
};
