import { useState } from 'react';
import type { Story } from '@ladle/react';
import { PureFlashcard } from "./PureFlashcard";
import { PureMarkdownFlashcard } from "./PureMarkdownFlashcard";
import { FlashcardConveyor } from "./FlashcardConveyor";
import { PureVocabEmptyState } from "./PureVocabEmptyState";
import { PureSessionSummary } from "./PureSessionSummary";
import { MOCK_TAGS } from "../../mocks";
import { ReviewRating } from "../../types";

export default {
  title: 'Features/Flashcard/Pure/Flashcard',
};

export const CustomFlashcard: Story = () => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', background: 'var(--lui-color-bg-alt)', minHeight: '100vh' }}>
      <div style={{ width: '100%', maxWidth: '320px', height: '400px' }}>
        <PureFlashcard 
          isFlipped={isFlipped}
          tags={[{ id: '1', label: 'Custom Tag', color: 'accent' }]}
        >
          <PureFlashcard.Front>
            <h2 style={{ margin: 0, color: 'var(--lui-color-text-main)' }}>Custom Front</h2>
            <p style={{ color: 'var(--lui-color-text-muted)' }}>You can put <strong>anything</strong> here.</p>
            <div style={{ width: '120px', height: '120px', background: 'var(--lui-color-primary)', borderRadius: '50%', margin: '20px auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
              React Node
            </div>
          </PureFlashcard.Front>
          <PureFlashcard.Back>
            <h2 style={{ margin: 0, color: 'var(--lui-color-text-main)' }}>Custom Back</h2>
            <p style={{ color: 'var(--lui-color-text-muted)' }}>Formulas, images, interactive elements...</p>
            <button 
              onClick={(e) => { e.stopPropagation(); alert('Interactive element clicked!'); }}
              style={{ padding: '8px 16px', background: 'var(--lui-color-success)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '20px' }}
            >
              Interactive Button
            </button>
          </PureFlashcard.Back>
        </PureFlashcard>
      </div>
      
      <button 
        onClick={() => setIsFlipped(!isFlipped)}
        style={{ padding: '12px 24px', cursor: 'pointer', fontSize: '16px', background: 'var(--lui-color-bg-main)', border: '2px solid var(--lui-color-border-dark)', borderRadius: '8px', fontWeight: 'bold' }}
      >
        Flip Card
      </button>
    </div>
  );
};

export const MarkdownFlashcard: Story = () => {
  const [isFlipped, setIsFlipped] = useState(false);

  const frontMd = `
# Mitochondria
What is the primary function of the mitochondria?
  `;

  const backMd = `
**The powerhouse of the cell.**

It generates most of the chemical energy needed to power the cell's biochemical reactions.

\`ATP Production\`
  `;

  return (
    <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', background: 'var(--lui-color-bg-alt)', minHeight: '100vh' }}>
      <div style={{ width: '100%', maxWidth: '320px', height: '400px' }}>
        <PureMarkdownFlashcard 
          isFlipped={isFlipped}
          frontMarkdown={frontMd}
          backMarkdown={backMd}
        />
      </div>
      
      <button 
        onClick={() => setIsFlipped(!isFlipped)}
        style={{ padding: '12px 24px', cursor: 'pointer', fontSize: '16px', background: 'var(--lui-color-bg-main)', border: '2px solid var(--lui-color-border-dark)', borderRadius: '8px', fontWeight: 'bold' }}
      >
        Flip Card
      </button>
    </div>
  );
};

export const FlashcardWithTags: Story = () => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', background: 'var(--lui-color-bg-alt)', minHeight: '100vh' }}>
      <div style={{ width: '100%', maxWidth: '320px', height: '400px' }}>
        <PureFlashcard 
          word="Photosynthesis"
          definition="The process by which green plants and some other organisms use sunlight to synthesize foods from carbon dioxide and water."
          isFlipped={isFlipped}
          onFlip={() => setIsFlipped(!isFlipped)}
          tags={[
            { id: 'bio', label: 'Biology 101', color: 'success' },
            { id: 'ch1', label: 'Chapter 1', color: 'default' }
          ]}
        />
      </div>
    </div>
  );
};

export const VocabEmptyState: Story = () => {
  return (
    <div style={{ padding: '40px', background: 'var(--lui-color-bg-alt)', minHeight: '100vh' }}>
      <PureVocabEmptyState 
        activeTags={[MOCK_TAGS[0]]}
        onClearFilters={() => alert('Filters cleared!')}
      />
    </div>
  );
};

export const SessionSummaryWithTags: Story = () => {
  return (
    <div style={{ padding: '40px', background: 'var(--lui-color-bg-alt)', minHeight: '100vh' }}>
      <PureSessionSummary 
        cardsReviewed={42}
        accuracy={85}
        timeSpent="12:30"
        onFinish={() => alert('Finished!')}
        activeTags={[MOCK_TAGS[0], MOCK_TAGS[1]]}
      />
    </div>
  );
};

export const ConveyorBelt: Story = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const items = [
    { id: '1', front: '# Card 1\nThis is the first card.', back: '**Back 1**' },
    { id: '2', front: '# Card 2\nThis is the second card.', back: '**Back 2**' },
    { id: '3', front: '# Card 3\nThis is the third card.', back: '**Back 3**' },
    { id: '4', front: '# Card 4\nThis is the fourth card.', back: '**Back 4**' },
    { id: '5', front: '# Card 5\nThis is the fifth card.', back: '**Back 5**' },
  ];

  const mockRatings: Record<string, ReviewRating> = {
    '1': 'good',
    '2': 'hard',
    '3': 'again',
    '4': 'easy',
    '5': 'good'
  };

  return (
    <div className="lui-theme-dark" style={{ padding: '40px', background: 'var(--lui-color-bg-main)', minHeight: '100vh', overflow: 'hidden' }}>
      <h2 style={{ textAlign: 'center', color: 'var(--lui-color-text-main)', marginBottom: '40px', fontFamily: 'var(--lui-font-family)' }}>Conveyor Belt UI</h2>
      
      <FlashcardConveyor
        items={items}
        currentIndex={currentIndex}
        getItemId={(item) => item.id}
        getItemRating={(item) => mockRatings[item.id]}
        renderCard={(item, _isCurrent) => (
          <PureMarkdownFlashcard
            isFlipped={false}
            frontMarkdown={item.front}
            backMarkdown={item.back}
          />
        )}
      />
      
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '40px' }}>
        <button 
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          style={{ padding: '12px 24px', cursor: 'pointer', fontSize: '16px', background: 'var(--lui-color-primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}
        >
          Previous
        </button>
        <button 
          onClick={() => setCurrentIndex(Math.min(items.length - 1, currentIndex + 1))}
          style={{ padding: '12px 24px', cursor: 'pointer', fontSize: '16px', background: 'var(--lui-color-primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}
        >
          Next
        </button>
      </div>
    </div>
  );
};
