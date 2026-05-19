import { ExperimentStorageAdapter } from '../types/adapters';
import { experimentStateSchema } from '../types/state';

/**
 * A storage adapter that persists experiment progress to the browser's localStorage.
 * Uses Zod to validate the loaded state to prevent crashes from corrupted data.
 */
export const experimentLocalStorageAdapter: ExperimentStorageAdapter = {
  load: async (experimentId: string) => {
    try {
      const data = localStorage.getItem(`exp_state_${experimentId}`);
      if (!data) return null;

      const parsedJson = JSON.parse(data);
      const result = experimentStateSchema.safeParse(parsedJson);

      if (!result.success) {
        console.warn('Local storage data is corrupted or outdated. Resetting state.', result.error);
        return null;
      }

      return result.data;
    } catch (e) {
      console.error('Failed to load experiment state', e);
      return null;
    }
  },
  save: async (experimentId: string, state: Record<string, unknown>) => {
    try {
      localStorage.setItem(`exp_state_${experimentId}`, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save experiment state', e);
    }
  }
};
