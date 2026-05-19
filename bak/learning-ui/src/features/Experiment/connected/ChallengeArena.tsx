import React, { ReactNode, useState, isValidElement } from 'react';
import { Experiment } from '../pure/Layout/ExperimentShell';
import { ChallengeHeader } from '../pure/Challenge/ChallengeHeader';
import { useExperiment } from '../store/ExperimentContext';
import { useExperimentChallenges, ChallengeDef, ChallengeRenderContext } from '../hooks/useExperimentChallenges';
import { LearningMarkdown } from '../../../common/Markdown';

export type ChallengeProps<TSlices = Record<string, unknown>, TExtra = Record<string, unknown>> = Omit<ChallengeDef<TSlices>, 'id'> & { id: string } & TExtra;

/**
 * A dummy component used to define challenges declaratively within the JSX tree.
 * It does not render anything itself; its props are extracted by the parent ChallengeArena.
 */
export function Challenge<TSlices = Record<string, unknown>, TExtra = Record<string, unknown>>(_props: ChallengeProps<TSlices, TExtra>) {
  return null;
}

export interface ChallengeArenaProps {
  /** The key used to store history snapshots for this arena */
  historyKey?: string;
  /** The title displayed in the header */
  title?: string;
  /** Optional step number displayed next to the title */
  stepNumber?: number | string;
  /** If true, applies the dark theme to the canvas */
  dark?: boolean;
  /** The challenges (<ChallengeArena.Challenge>) and the persistent canvas content */
  children: ReactNode;
}

/**
 * A smart wrapper that orchestrates the entire Experiment shell.
 * It extracts `<ChallengeArena.Challenge>` components from its children to build the logic,
 * and renders the remaining children as the persistent canvas.
 */
export function ChallengeArena<TSlices = Record<string, unknown>>({
  historyKey = 'challenge_history',
  title = 'Experiment',
  stepNumber,
  dark = false,
  children
}: ChallengeArenaProps) {
  const { state, setSlice } = useExperiment();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const challengeDefs: ChallengeDef<TSlices>[] = [];
  const canvasChildren: ReactNode[] = [];

  // Extract challenges vs canvas content
  React.Children.forEach(children, (child) => {
    if (isValidElement(child) && (child.type === ChallengeArena.Challenge || child.type === Challenge)) {
      challengeDefs.push(child.props as ChallengeDef<TSlices>);
    } else {
      canvasChildren.push(child);
    }
  });

  const nav = useExperimentChallenges<TSlices>(challengeDefs, { historyKey });

  const renderCtx: ChallengeRenderContext<TSlices> = {
    slices: state.slices as TSlices,
    setSlice,
    restoreCheckpoint: nav.restoreCheckpoint,
    submitAndAdvance: nav.submitAndAdvance,
    isLastChallenge: nav.isLastChallenge,
    isCompleted: nav.isCompleted
  };

  const currentChallenge = nav.currentChallenge;
  const currentQuestion = typeof currentChallenge?.question === 'string'
    ? <LearningMarkdown>{currentChallenge.question}</LearningMarkdown>
    : currentChallenge?.question;
  const sidebarContent = currentChallenge?.renderSidebar?.(renderCtx);

  return (
    <Experiment isActive isFullscreen={isFullscreen}>
      <Experiment.Header 
        title={title} 
        stepNumber={stepNumber}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {currentChallenge?.renderControls?.(renderCtx)}
        </div>
      </Experiment.Header>

      <Experiment.Canvas dark={dark}>
        <div key={state.checkpointResetKey} style={{ display: 'contents' }}>
          <ChallengeHeader
            activeChallengeIndex={nav.activeChallengeIndex}
            totalCount={nav.totalCount}
            question={currentQuestion}
            canViewPrevious={nav.canViewPrevious}
            canViewNext={nav.canViewNext}
            onViewPrevious={nav.viewPrevious}
            onViewNext={nav.viewNext}
          />
          
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {canvasChildren}
          </div>

          {currentChallenge?.renderFeedback?.(renderCtx)}
        </div>
      </Experiment.Canvas>

      {sidebarContent && (
        <Experiment.Sidebar>
          {sidebarContent}
        </Experiment.Sidebar>
      )}
    </Experiment>
  );
}

ChallengeArena.Challenge = Challenge;
