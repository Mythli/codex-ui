import { useCallback } from 'react';
import { useExperiment } from '../store/ExperimentContext';

export interface ChallengeSubmission<T> {
  timestamp: number;
  snapshot: T;
}

export type ChallengeHistory<T> = Record<string, ChallengeSubmission<T>>;

/**
 * Hook to manage a history of saved states (snapshots) for completed challenges.
 * Automatically persists to the ExperimentContext's dedicated history object.
 * 
 * @param historyKey - Unique key for storage in the context history (default: 'challenge_history')
 */
export function useChallengeHistory<T>(historyKey: string = 'challenge_history') {
  const { getHistory, setHistory } = useExperiment();

  const history = getHistory<ChallengeHistory<T>>(historyKey, {});

  const saveChallenge = useCallback((challengeId: string, snapshot: T) => {
    setHistory(historyKey, {
      ...history,
      [challengeId]: {
        timestamp: Date.now(),
        snapshot
      }
    });
  }, [historyKey, history, setHistory]);

  const getChallengeState = useCallback((challengeId: string): T | null => {
    const entry = history[challengeId];
    return entry ? entry.snapshot : null;
  }, [history]);

  return {
    history,
    saveChallenge,
    getChallengeState
  };
}
