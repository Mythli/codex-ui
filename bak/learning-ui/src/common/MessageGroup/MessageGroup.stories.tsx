import type { Story } from '@ladle/react';
import type { ReactNode } from 'react';
import { MessageGroup } from './MessageGroup';

export default {
  title: 'Common/MessageGroup',
};

const Frame = ({ children }: { children: ReactNode }) => (
  <div style={{ maxWidth: 760, minHeight: '100vh', padding: 24, background: 'var(--lui-color-bg-alt)' }}>
    {children}
  </div>
);

export const GroupedReviewMessages: Story = () => (
  <Frame>
    <MessageGroup
      items={[
        {
          type: 'error',
          title: 'No valid answer submitted',
          content: 'The submitted formula was blank, so no points were awarded.',
        },
        {
          type: 'error',
          title: 'No points awarded',
          content: 'This question earned **0 / 4 points**.',
        },
        {
          type: 'info',
          title: 'Answer',
          content: 'Use `(3.7 * 10^24 / 6.022e23) * 23` to convert atoms to grams.',
        },
      ]}
    />
  </Frame>
);

export const MixedMarkdown: Story = () => (
  <Frame>
    <MessageGroup
      items={[
        {
          type: 'success',
          title: 'Correct',
          content: 'You selected the full-stack option and earned **1 point**.',
        },
        {
          type: 'warning',
          title: 'Partial credit',
          content: 'The explanation identifies density but misses the link to particle spacing.',
        },
        {
          type: 'info',
          title: 'Reference',
          content: '- Mass stays constant\n- Volume changes\n- Density follows `mass / volume`',
        },
      ]}
    />
  </Frame>
);
