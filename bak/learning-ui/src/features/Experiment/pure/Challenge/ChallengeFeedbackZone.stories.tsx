import type { Story } from '@ladle/react';
import { ChallengeFeedbackZone, ChallengeStatus } from "./ChallengeFeedbackZone";

export default {
  title: 'Features/Experiment/Pure/Challenge/ChallengeFeedbackZone',
};

interface FeedbackZoneArgs {
  status: ChallengeStatus;
  message: string;
  hint: string;
  isLoading: boolean;
}

export const Interactive: Story<FeedbackZoneArgs> = ({ status, message, hint, isLoading }) => {
  return (
    <div style={{ padding: '40px', background: '#1a1a2e', minHeight: '100vh', position: 'relative' }}>
      <h2 style={{ color: 'white', textAlign: 'center', marginTop: '100px' }}>
        [ Canvas Area ]
      </h2>
      <p style={{ color: '#888', textAlign: 'center' }}>
        The feedback zone is pinned to the bottom of its relative container.
      </p>
      
      <ChallengeFeedbackZone
        status={status}
        message={message}
        hint={hint}
        isLoading={isLoading}
        onSubmitAndAdvance={() => alert('Next challenge triggered!')}
      />
    </div>
  );
};

Interactive.args = {
  status: 'explore',
  message: 'Take your time to explore the simulation. Click Next Step when you are ready.',
  hint: 'Try increasing the heat a little more.',
  isLoading: false,
};

Interactive.argTypes = {
  status: {
    options: ['explore', 'building', 'success', 'partial', 'failed'],
    control: { type: 'radio' },
  },
};
