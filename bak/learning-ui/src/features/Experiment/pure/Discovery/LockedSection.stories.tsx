import type { Story } from '@ladle/react';
import { PureLockedSection } from "./PureLockedSection";
import { ConceptSection } from "../../../Lesson/pure/ConceptSection/ConceptSection";

export default {
  title: 'Features/Experiment/Pure/Discovery/LockedSection',
};

interface LockedSectionArgs {
  isUnlocked: boolean;
  isManuallyRevealed: boolean;
}

export const Interactive: Story<LockedSectionArgs> = ({ isUnlocked, isManuallyRevealed }) => {
  return (
    <div style={{ padding: '40px', maxWidth: '800px', background: '#f5f5f5', minHeight: '100vh' }}>
      <p style={{ marginBottom: '20px', color: '#666' }}>
        Use the Controls panel to toggle the states of this section.
      </p>
      <PureLockedSection
        isUnlocked={isUnlocked}
        isManuallyRevealed={isManuallyRevealed}
        onPeekClick={() => alert('Peek clicked! Parent app should show ConfirmModal.')}
      >
        <ConceptSection>
          <ConceptSection.Header stepNumber={1}>The Secret Answer</ConceptSection.Header>
          <ConceptSection.Body>
            <p>This is the highly classified scientific explanation that students must discover.</p>
            <p>If you can read this clearly, the section is unlocked or revealed!</p>
          </ConceptSection.Body>
        </ConceptSection>
      </PureLockedSection>
    </div>
  );
};

Interactive.args = {
  isUnlocked: false,
  isManuallyRevealed: false,
};
