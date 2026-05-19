import { useCallback, useMemo, useEffect, ReactNode } from 'react';
import { useExperiment } from '../store/ExperimentContext';
import { useChallengeHistory } from './useChallengeHistory';

export interface ChallengeRenderContext<TSlices = Record<string, unknown>> {
  slices: TSlices;
  setSlice: <T>(key: string, value: T | ((prev: T) => T), defaultValue?: T) => void;
  restoreCheckpoint: () => void;
  submitAndAdvance: (snapshot?: TSlices) => void;
  isLastChallenge: boolean;
  isCompleted: boolean;
}

export interface ChallengeDef<TSlices = Record<string, unknown>> {
  id: string;
  /** The type of step. 'explore' steps typically have no success criteria. */
  type?: 'challenge' | 'explore';
  
  /** The question or instruction text for this challenge */
  question?: ReactNode;

  /** 
   * Optional pure function to modify the state when entering this challenge.
   * The engine automatically provides the `baseState` (either the saved history 
   * snapshot if reviewing, or the live canvas state if playing for the first time).
   */
  onRestore?: (baseState: TSlices) => TSlices;
  
  /** Evaluates the live state and returns true if the challenge is completed */
  isSuccess?: (ctx: ChallengeRenderContext<TSlices>) => boolean;
  
  /** Renders the feedback zone (success/building messages and buttons) at the bottom of the canvas */
  renderFeedback?: (ctx: ChallengeRenderContext<TSlices>) => ReactNode;
  
  /** Renders custom controls for this challenge in the header */
  renderControls?: (ctx: ChallengeRenderContext<TSlices>) => ReactNode;

  /** Renders custom sidebar content (charts, stats) for this challenge */
  renderSidebar?: (ctx: ChallengeRenderContext<TSlices>) => ReactNode;
}

export interface UseExperimentChallengesOptions {
  /**
   * The key used to store history snapshots. Required if you want `restoreCheckpoint`
   * to automatically look up the correct checkpoint.
   */
  historyKey?: string;
}

/**
 * Hook for managing challenge navigation within an experiment.
 * Uses the ExperimentContext to persist completed challenges and the active challenge ID.
 * 
 * @param challenges - Array of challenge definition objects
 * @param options - Configuration options
 */
export function useExperimentChallenges<TSlices = Record<string, unknown>, T extends ChallengeDef<TSlices> = ChallengeDef<TSlices>>(
  challenges: T[],
  options?: UseExperimentChallengesOptions
) {
  const { state, isLoaded, markChallengeComplete, setActiveChallenge, restoreCheckpoint: contextRestoreCheckpoint } = useExperiment();
  const { historyKey = 'challenge_history' } = options || {};
  
  const { getChallengeState, saveChallenge } = useChallengeHistory<TSlices>(historyKey);

  // 1. Derive the Frontier (The furthest unsolved challenge)
  const frontierChallengeId = useMemo(() => {
    if (challenges.length === 0) return null;
    const uncompleted = challenges.find(c => !state.completedChallenges.includes(c.id));
    return uncompleted ? uncompleted.id : challenges[challenges.length - 1].id;
  }, [challenges, state.completedChallenges]);

  // 2. Auto-initialize active challenge if missing (Wait for storage to load first!)
  useEffect(() => {
    if (isLoaded && !state.activeChallengeId && challenges.length > 0 && frontierChallengeId) {
      setActiveChallenge(frontierChallengeId);
    }
  }, [isLoaded, state.activeChallengeId, challenges.length, frontierChallengeId, setActiveChallenge]);

  // 3. Derive Active State safely
  const activeChallengeIndex = useMemo(() => {
    const idx = challenges.findIndex(c => c.id === state.activeChallengeId);
    return idx >= 0 ? idx : 0;
  }, [challenges, state.activeChallengeId]);

  const currentChallenge = challenges[activeChallengeIndex];
  const activeChallengeId = currentChallenge?.id || null;
  const isLastChallenge = activeChallengeIndex === challenges.length - 1;

  const frontierIndex = useMemo(() => {
    const idx = challenges.findIndex(c => c.id === frontierChallengeId);
    return idx >= 0 ? idx : challenges.length - 1;
  }, [challenges, frontierChallengeId]);

  const isCompleted = currentChallenge 
    ? state.completedChallenges.includes(currentChallenge.id) 
    : false;

  // 4. Navigation & State Resolution Logic
  const navigateTo = useCallback((targetChallenge: T) => {
    const historyState = getChallengeState(targetChallenge.id);
    
    let finalState: TSlices;
    
    if (historyState) {
      // If history exists, we are reviewing a completed challenge.
      // Do NOT run onRestore, just load the exact saved snapshot.
      finalState = historyState;
    } else {
      // If no history exists, we are entering for the first time.
      // Run onRestore to set up initial conditions.
      const baseState = state.slices as TSlices;
      finalState = targetChallenge.onRestore ? targetChallenge.onRestore(baseState) : baseState;
    }
    
    // Bulk update the canvas and change the active ID
    contextRestoreCheckpoint(finalState as Record<string, unknown>);
    setActiveChallenge(targetChallenge.id);
  }, [getChallengeState, state.slices, contextRestoreCheckpoint, setActiveChallenge]);

  // 5. Progression Logic
  const submitAndAdvance = useCallback((snapshot?: TSlices) => {
    if (!currentChallenge) return;

    const finalSnapshot = snapshot || (state.slices as TSlices);
    saveChallenge(currentChallenge.id, finalSnapshot);
    markChallengeComplete(currentChallenge.id);
    
    // Advance if not at the end
    if (activeChallengeIndex < challenges.length - 1) {
      navigateTo(challenges[activeChallengeIndex + 1]);
    }
  }, [currentChallenge, state.slices, markChallengeComplete, saveChallenge, activeChallengeIndex, challenges, navigateTo]);

  // 6. View Navigation Logic
  const isAtFrontier = activeChallengeIndex === frontierIndex;
  const canSkipCurrent = currentChallenge?.type === 'explore';

  const canViewNext = activeChallengeIndex < frontierIndex || (isAtFrontier && canSkipCurrent && activeChallengeIndex < challenges.length - 1);
  const canViewPrevious = activeChallengeIndex > 0;

  const viewNext = useCallback(() => {
    if (canViewNext) {
      if (isAtFrontier && canSkipCurrent) {
        // Auto-complete the explore step to advance the frontier
        submitAndAdvance();
      } else {
        navigateTo(challenges[activeChallengeIndex + 1]);
      }
    }
  }, [canViewNext, isAtFrontier, canSkipCurrent, submitAndAdvance, activeChallengeIndex, challenges, navigateTo]);

  const viewPrevious = useCallback(() => {
    if (canViewPrevious) {
      navigateTo(challenges[activeChallengeIndex - 1]);
    }
  }, [canViewPrevious, challenges, activeChallengeIndex, navigateTo]);

  const goTo = useCallback((id: string) => {
    const nextIdx = challenges.findIndex(c => c.id === id);
    if (nextIdx >= 0 && nextIdx <= frontierIndex && challenges[nextIdx].id !== currentChallenge?.id) {
      navigateTo(challenges[nextIdx]);
    }
  }, [challenges, frontierIndex, currentChallenge, navigateTo]);

  // 7. Checkpoint Logic
  const restoreCheckpoint = useCallback(() => {
    if (!currentChallenge) return;
    
    const prevIndex = activeChallengeIndex - 1;
    let baseState = {} as TSlices;
    
    // The "start" of the current challenge is the snapshot of the previous challenge
    if (prevIndex >= 0) {
      const prevChallenge = challenges[prevIndex];
      baseState = getChallengeState(prevChallenge.id) || ({} as TSlices);
    }
    
    // Explicitly calling restoreCheckpoint ALWAYS runs onRestore to guarantee a clean slate
    const finalState = currentChallenge.onRestore ? currentChallenge.onRestore(baseState) : baseState;
    contextRestoreCheckpoint(finalState as Record<string, unknown>);
  }, [activeChallengeIndex, challenges, currentChallenge, getChallengeState, contextRestoreCheckpoint]);

  return {
    isLoaded,
    currentChallenge,
    activeChallengeId,
    frontierChallengeId,
    activeChallengeIndex,
    isLastChallenge,
    totalCount: challenges.length,
    isCompleted,
    canViewNext,
    canViewPrevious,
    viewNext,
    viewPrevious,
    goTo,
    submitAndAdvance,
    restoreCheckpoint
  };
}
