import React, { ReactNode, useMemo } from 'react';
import { PureLockedSection } from "../pure/Discovery/PureLockedSection";
import { useExperiment } from '../store/ExperimentContext';

export interface LockedSectionProps {
  /** The ID of the observation pattern that must be discovered to unlock this section */
  requiredObservationId: string;
  /** The content to hide/reveal (usually a `<ConceptSection />`) */
  children: ReactNode;
}

/**
 * A smart wrapper for the LockedSection.
 * Automatically checks the ExperimentContext to see if the required observation
 * has been discovered, and unlocks itself without any manual state wiring.
 */
export function LockedSection({ requiredObservationId, children }: LockedSectionProps) {
  const { state, revealSection } = useExperiment();

  return useMemo(() => {
    const isUnlocked = state.confirmedObservations.includes(requiredObservationId);
    const isManuallyRevealed = state.manuallyRevealedSections.includes(requiredObservationId);

    return (
      <PureLockedSection
        isUnlocked={isUnlocked}
        isManuallyRevealed={isManuallyRevealed}
        onPeekClick={() => revealSection(requiredObservationId)}
      >
        {children}
      </PureLockedSection>
    );
  }, [
    requiredObservationId, children,
    state.confirmedObservations,
    state.manuallyRevealedSections,
    revealSection
  ]);
}
