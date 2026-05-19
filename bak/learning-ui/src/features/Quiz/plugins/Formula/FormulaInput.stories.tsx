import { useState } from 'react';
import type { Story } from '@ladle/react';
import { PureFormulaInput } from "./PureFormulaInput";

export default {
  title: 'Features/Quiz/Pure/FormulaInput',
};

export const Default: Story = () => {
  const [formula, setFormula] = useState('3.7 * 10^24 / 6.022e23 * 23');
  const [scratchpad, setScratchpad] = useState('Molar mass = 23g/mol');

  // Mocking the mathjs evaluation that the parent app would normally do
  const mockPreview = <span style={{ color: '#3498db' }}>= 141.3151777</span>;

  return (
    <div style={{ padding: '20px', maxWidth: '600px' }}>
      <PureFormulaInput
        formulaValue={formula}
        onFormulaChange={setFormula}
        previewNode={mockPreview}
        scratchpadValue={scratchpad}
        onScratchpadChange={setScratchpad}
      />
    </div>
  );
};

export const ErrorState: Story = () => {
  const mockPreview = <span style={{ color: '#e74c3c' }}>Invalid Formula</span>;

  return (
    <div style={{ padding: '20px', maxWidth: '600px' }}>
      <PureFormulaInput
        formulaValue="3.7 * 10^24 / "
        onFormulaChange={() => {}}
        previewNode={mockPreview}
        status="error"
      />
    </div>
  );
};
