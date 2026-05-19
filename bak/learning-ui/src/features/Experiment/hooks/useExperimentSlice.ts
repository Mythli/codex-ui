import { useCallback } from 'react';
import { useExperiment } from '../store/ExperimentContext';

/**
 * Hook for persisting experiment-specific state (like WebGL canvas state) 
 * as a "slice" within the global experiment context.
 * 
 * The slice will be:
 * - Auto-loaded from localStorage on mount
 * - Auto-saved to localStorage on changes
 * - Cleared when the experiment is reset
 * 
 * @param key - Unique key for this slice (e.g., 'bond_builder', 'gas_sim')
 * @param initialValue - Default value if no persisted state exists
 * @returns Tuple of [state, setState] exactly like React.useState
 */
export function useExperimentSlice<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const { getSlice, setSlice } = useExperiment();
  
  // Get current value (fallback to initialValue if not yet registered)
  const value = getSlice<T>(key, initialValue);
  
  // Setter function that mirrors useState's setter
  const setValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      // Pass initialValue so functional updates work even if the slice was just cleared
      setSlice(key, newValue, initialValue);
    },
    [key, setSlice, initialValue]
  );
  
  return [value, setValue];
}
