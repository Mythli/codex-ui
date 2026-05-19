import { useState } from 'react';
import type { Story } from '@ladle/react';
import { PureMultipleChoiceInput } from "./PureMultipleChoiceInput";

export default {
  title: 'Features/Quiz/Pure/MultipleChoiceInput',
};

const CHOICES = [
  { id: 'a', text: 'Oxygen' },
  { id: 'b', text: 'Carbon' },
  { id: 'c', text: 'Hydrogen' },
  { id: 'd', text: 'Nitrogen' },
];

export const Default: Story = () => {
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <div style={{ padding: '20px', maxWidth: '600px' }}>
      <h3>Select an element:</h3>
      <PureMultipleChoiceInput
        choices={CHOICES}
        selectedIds={selected}
        onChange={setSelected}
      />
    </div>
  );
};

export const MultiSelect: Story = () => {
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <div style={{ padding: '20px', maxWidth: '600px' }}>
      <h3>Select all that apply:</h3>
      <PureMultipleChoiceInput
        choices={CHOICES}
        selectedIds={selected}
        onChange={setSelected}
        multiSelect={true}
      />
    </div>
  );
};

export const Graded: Story = () => {
  return (
    <div style={{ padding: '20px', maxWidth: '600px' }}>
      <h3>Graded State (Read-Only):</h3>
      <PureMultipleChoiceInput
        choices={CHOICES}
        selectedIds={['b']}
        onChange={() => {}}
        disabled={true}
        statusMap={{
          a: 'default',
          b: 'incorrect',
          c: 'correct',
          d: 'default',
        }}
      />
    </div>
  );
};
