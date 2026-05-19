import { useState } from 'react';
import type { Story } from '@ladle/react';
import { PureFreeTextInput } from "./PureFreeTextInput";

export default {
  title: 'Features/Quiz/Pure/FreeTextInput',
};

export const Default: Story = () => {
  const [shortVal, setShortVal] = useState('');
  const [longVal, setLongVal] = useState('');

  return (
    <div style={{ padding: '20px', maxWidth: '600px' }}>
      <h3>Short Input</h3>
      <PureFreeTextInput value={shortVal} onChange={setShortVal} inputType="short" />
      
      <h3>Long Input</h3>
      <PureFreeTextInput value={longVal} onChange={setLongVal} inputType="long" />
    </div>
  );
};

export const States: Story = () => {
  return (
    <div style={{ padding: '20px', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <PureFreeTextInput value="Correct Answer" onChange={() => {}} status="correct" />
      <PureFreeTextInput value="Wrong Answer" onChange={() => {}} status="error" />
      <PureFreeTextInput value="Almost there" onChange={() => {}} status="partial" />
      <PureFreeTextInput value="Revealed Answer" onChange={() => {}} status="revealed" disabled />
    </div>
  );
};
