import type { Story } from '@ladle/react';
import { PureObservationsSection } from "./PureObservationsSection";

export default {
  title: 'Features/Experiment/Pure/Discovery/ObservationsSection',
};

interface ObservationsArgs {
  text: string;
  isLoading: boolean;
  showFeedback: boolean;
  confirmedCount: number;
}

export const Interactive: Story<ObservationsArgs> = ({ text, isLoading, showFeedback, confirmedCount }) => {
  return (
    <div style={{ padding: '40px', maxWidth: '800px', background: '#f5f5f5', minHeight: '100vh' }}>
      <PureObservationsSection
        title="What Did You Discover?"
        stepNumber={3}
        totalObservations={3}
        confirmedCount={confirmedCount}
        observationsText={text}
        onTextChange={() => {}}
        onSubmit={() => alert('Submit clicked!')}
        isLoading={isLoading}
        feedback={showFeedback ? "Great observation! You noticed the pattern." : null}
        hints={showFeedback ? [{ id: '1', content: 'Look at the outer rings for the next pattern.' }] : []}
        placeholder="Describe the patterns you noticed during the experiment..."
      />
    </div>
  );
};

Interactive.args = {
  text: 'I noticed that the atoms in the same column have the same number of dots.',
  isLoading: false,
  showFeedback: true,
  confirmedCount: 1,
};

Interactive.argTypes = {
  confirmedCount: {
    control: { type: 'range', min: 0, max: 3, step: 1 },
  },
};
