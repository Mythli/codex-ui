import React, { useMemo } from 'react';
import { PureObservationsSection } from "../pure/Discovery/PureObservationsSection";
import { useExperiment } from '../store/ExperimentContext';
import { LearningMarkdown } from '../../../common/Markdown';

export interface ObservationsSectionProps {
  /** The title of the section. Defaults to 'What Did You Discover?' */
  title?: string;
  /** Optional step number to display next to the title */
  stepNumber?: number | string;
  /** Placeholder text for the textarea */
  placeholder?: string;
  /** Text for the submit button */
  buttonText?: string;
}

/**
 * A smart wrapper for the ObservationsSection.
 * Automatically connects to the ExperimentContext to handle text state, 
 * submission to the backend adapter, and displaying AI feedback/hints.
 */
export function ObservationsSection({
  title,
  stepNumber,
  placeholder,
  buttonText
}: ObservationsSectionProps) {
  const { 
    state, 
    possibleObservations, 
    setObservationsText, 
    parseObservations 
  } = useExperiment();

  return useMemo(() => (
    <PureObservationsSection
      title={title}
      stepNumber={stepNumber}
      placeholder={placeholder}
      buttonText={buttonText}
      totalObservations={possibleObservations.length}
      confirmedCount={state.confirmedObservations.length}
      observationsText={state.observationsText}
      onTextChange={setObservationsText}
      onSubmit={parseObservations}
      isLoading={state.isParsingObservations}
      feedback={state.observationFeedback ? (
        <LearningMarkdown>{state.observationFeedback}</LearningMarkdown>
      ) : null}
      hints={state.observationHints.map(hint => ({
        id: hint.observationId,
        content: <LearningMarkdown>{hint.hint}</LearningMarkdown>
      }))}
    />
  ), [
    title, stepNumber, placeholder, buttonText,
    possibleObservations.length,
    state.confirmedObservations.length,
    state.observationsText,
    state.isParsingObservations,
    state.observationFeedback,
    state.observationHints,
    setObservationsText,
    parseObservations
  ]);
}
