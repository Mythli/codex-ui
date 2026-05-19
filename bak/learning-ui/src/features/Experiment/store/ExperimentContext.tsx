import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { ExperimentBackendAdapter, ExperimentStorageAdapter } from '../types/adapters';
import { ExperimentState, ObservationDefinition } from '../types/state';
import { toast } from '../../../common/Toast/Toaster';

export interface ExperimentContextValue {
  state: ExperimentState;
  isLoaded: boolean;
  possibleObservations: ObservationDefinition[];
  
  // Actions
  setObservationsText: (text: string) => void;
  parseObservations: () => Promise<void>;
  revealSection: (sectionId: string) => void;
  markChallengeComplete: (challengeId: string) => void;
  setActiveChallenge: (challengeId: string) => void;
  setSlice: <T>(key: string, value: T | ((prev: T) => T), defaultValue?: T) => void;
  getSlice: <T>(key: string, defaultValue: T) => T;
  setHistory: (key: string, value: unknown) => void;
  getHistory: <T>(key: string, defaultValue: T) => T;
  resetExperiment: () => void;
  restoreCheckpoint: (checkpoint?: Record<string, unknown>) => void;
}

const ExperimentContext = createContext<ExperimentContextValue | null>(null);

export function useExperiment() {
  const context = useContext(ExperimentContext);
  if (!context) {
    throw new Error('useExperiment must be used within an ExperimentProvider');
  }
  return context;
}

export interface ExperimentProviderProps {
  experimentId: string;
  backend: ExperimentBackendAdapter;
  storage: ExperimentStorageAdapter;
  possibleObservations?: ObservationDefinition[];
  children: ReactNode;
}

const defaultState: ExperimentState = {
  observationsText: '',
  confirmedObservations: [],
  manuallyRevealedSections: [],
  completedChallenges: [],
  activeChallengeId: null,
  slices: {},
  history: {},
  isParsingObservations: false,
  observationFeedback: null,
  observationHints: [],
  checkpointResetKey: 0,
};

export function ExperimentProvider({
  experimentId,
  backend,
  storage,
  possibleObservations = [],
  children
}: ExperimentProviderProps) {
  const [state, setState] = useState<ExperimentState>(defaultState);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load initial state
  useEffect(() => {
    let mounted = true;
    storage.load(experimentId).then((loadedState) => {
      if (mounted) {
        if (loadedState) {
          setState((prev) => ({ ...prev, ...loadedState, isParsingObservations: false }));
        }
        setIsLoaded(true);
      }
    });
    return () => { mounted = false; };
  }, [experimentId, storage]);

  // Save state whenever it changes (after initial load), debounced to prevent performance issues
  useEffect(() => {
    if (isLoaded) {
      const timeoutId = setTimeout(() => {
        storage.save(experimentId, state);
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [state, isLoaded, experimentId, storage]);

  const setObservationsText = useCallback((text: string) => {
    setState((prev) => ({ ...prev, observationsText: text }));
  }, []);

  const parseObservations = useCallback(async () => {
    if (state.isParsingObservations || possibleObservations.length === 0) return;

    setState((prev) => ({ ...prev, isParsingObservations: true, observationFeedback: null }));

    try {
      const result = await backend.parseObservations({
        experimentId,
        userText: state.observationsText,
      });

      setState((prev) => {
        const newConfirmed = Array.from(new Set([...prev.confirmedObservations, ...result.confirmed]));
        return {
          ...prev,
          isParsingObservations: false,
          confirmedObservations: newConfirmed,
          observationFeedback: result.feedback,
          observationHints: result.hints
        };
      });
    } catch (error) {
      console.error('Failed to parse observations:', error);
      toast.error('Connection failed. Please try again.');
      setState((prev) => ({
        ...prev,
        isParsingObservations: false,
      }));
    }
  }, [state.isParsingObservations, state.observationsText, experimentId, possibleObservations.length, backend]);

  const revealSection = useCallback((sectionId: string) => {
    setState((prev) => {
      if (prev.manuallyRevealedSections.includes(sectionId)) return prev;
      return {
        ...prev,
        manuallyRevealedSections: [...prev.manuallyRevealedSections, sectionId]
      };
    });
  }, []);

  const markChallengeComplete = useCallback((challengeId: string) => {
    setState((prev) => {
      if (prev.completedChallenges.includes(challengeId)) return prev;
      return {
        ...prev,
        completedChallenges: [...prev.completedChallenges, challengeId]
      };
    });
  }, []);

  const setActiveChallenge = useCallback((challengeId: string) => {
    setState((prev) => {
      if (prev.activeChallengeId === challengeId) return prev;
      return { ...prev, activeChallengeId: challengeId };
    });
  }, []);

  const setSlice = useCallback(<T,>(key: string, value: T | ((prev: T) => T), defaultValue?: T) => {
    setState((prev) => {
      const currentValue = prev.slices[key] !== undefined ? prev.slices[key] : defaultValue;
      const newValue = typeof value === 'function' ? (value as (prev: T) => T)(currentValue as T) : value;
      
      return {
        ...prev,
        slices: {
          ...prev.slices,
          [key]: newValue
        }
      };
    });
  }, []);

  const getSlice = useCallback(<T,>(key: string, defaultValue: T): T => {
    return state.slices[key] !== undefined ? (state.slices[key] as T) : defaultValue;
  }, [state.slices]);

  const setHistory = useCallback((key: string, value: unknown) => {
    setState((prev) => ({
      ...prev,
      history: {
        ...prev.history,
        [key]: value
      }
    }));
  }, []);

  const getHistory = useCallback(<T,>(key: string, defaultValue: T): T => {
    return state.history[key] !== undefined ? (state.history[key] as T) : defaultValue;
  }, [state.history]);

  const resetExperiment = useCallback(() => {
    setState(prev => {
      const newState = { ...defaultState, checkpointResetKey: prev.checkpointResetKey + 1 };
      storage.save(experimentId, newState);
      return newState;
    });
  }, [experimentId, storage]);

  const restoreCheckpoint = useCallback((checkpoint?: Record<string, unknown>) => {
    setState((prev) => ({
      ...prev,
      slices: checkpoint ? { ...checkpoint } : {}, 
      checkpointResetKey: prev.checkpointResetKey + 1
    }));
  }, []);

  const contextValue: ExperimentContextValue = {
    state,
    isLoaded,
    possibleObservations,
    setObservationsText,
    parseObservations,
    revealSection,
    markChallengeComplete,
    setActiveChallenge,
    setSlice,
    getSlice,
    setHistory,
    getHistory,
    resetExperiment,
    restoreCheckpoint
  };

  return (
    <ExperimentContext.Provider value={contextValue}>
      {children}
    </ExperimentContext.Provider>
  );
}
