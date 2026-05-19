import React, { ReactNode } from 'react';
import { PageShell } from "../../Layout/pure/PageShell";
import { Header } from "../../../common/Header";
import { BurgerButton } from "../../Layout/connected/BurgerButton";
import { PageFooterNav } from "../../Layout/pure/PageFooterNav";
import { Stack } from "../../../common/Stack/Stack";
import { ExperimentProvider, ExperimentProviderProps, useExperiment } from '../store/ExperimentContext';
import {
  requireLearningUIDependency,
  useLearningUIConfig
} from '../../../system/LocaleContext';

export interface ExperimentPageProps extends Omit<ExperimentProviderProps, 'children' | 'backend' | 'storage'> {
  /** The title of the experiment, displayed in the header */
  title: string;
  /** The label for the previous page button */
  prevLabel?: string;
  /** Callback fired when the previous button is clicked */
  onPrev?: () => void;
  /** The label for the next page button and the footer card */
  nextLabel?: string;
  /** Callback fired when the next button or footer card is clicked */
  onNext?: () => void;
  /** The content of the experiment page */
  children: ReactNode;
}

/**
 * Internal content wrapper that consumes the ExperimentContext to drive the Header.
 */
function ExperimentPageContent({
  title,
  prevLabel,
  onPrev,
  nextLabel,
  onNext,
  children,
}: Omit<ExperimentPageProps, keyof ExperimentProviderProps | 'children'> & { children: ReactNode }) {
  const { state, possibleObservations, resetExperiment } = useExperiment();

  const done = state.confirmedObservations.length;
  const total = possibleObservations.length;
  
  // Determine if there is any progress to warrant showing the reset button
  const hasProgress = 
    done > 0 || 
    state.observationsText.length > 0 || 
    Object.keys(state.slices).length > 0 ||
    state.completedChallenges.length > 0;

  return (
    <PageShell
      header={
        <Header>
          <Header.Left>
            <BurgerButton />
            {onPrev && (
              <Header.NavButton direction="prev" label={prevLabel} onClick={onPrev} />
            )}
          </Header.Left>
          <Header.Center>
            <Header.Title
              title={title}
              actions={(
                hasProgress ? <Header.ResetButton onReset={resetExperiment} /> : undefined
              )}
            >
              <Header.Progress value={done} max={total} label="Discoveries" />
            </Header.Title>
          </Header.Center>
          <Header.Right>
            {onNext && (
              <Header.NavButton direction="next" label={nextLabel} onClick={onNext} />
            )}
          </Header.Right>
        </Header>
      }
      footer={
        onNext && nextLabel ? (
          <PageFooterNav>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onNext();
              }}
              style={{ textDecoration: 'none', display: 'contents' }}
            >
              <PageFooterNav.Card title={nextLabel} />
            </a>
          </PageFooterNav>
        ) : undefined
      }
    >
      <Stack gap={6}>
        {children}
      </Stack>
    </PageShell>
  );
}

/**
 * The root provider and layout wrapper for an Experiment Page.
 * Automatically wires up the global layout, progress header, and state management.
 */
export function ExperimentPage({
  experimentId,
  possibleObservations,
  title,
  prevLabel,
  onPrev,
  nextLabel,
  onNext,
  children,
}: ExperimentPageProps) {
  const learningUI = useLearningUIConfig();
  const resolvedBackend = requireLearningUIDependency(
    learningUI.adapters?.experiment,
    'ExperimentPage backend'
  );
  const resolvedStorage = requireLearningUIDependency(
    learningUI.adapters?.experimentStorage,
    'ExperimentPage storage'
  );

  return (
    <ExperimentProvider
      experimentId={experimentId}
      backend={resolvedBackend}
      storage={resolvedStorage}
      possibleObservations={possibleObservations}
    >
      <ExperimentPageContent
        title={title}
        prevLabel={prevLabel}
        onPrev={onPrev}
        nextLabel={nextLabel}
        onNext={onNext}
      >
        {children}
      </ExperimentPageContent>
    </ExperimentProvider>
  );
}
