import { useState } from 'react';
import type { Story } from '@ladle/react';
import { PureQuestion } from "./PureQuestionShell";
import { PureMultipleChoiceQuestion } from '../../plugins/MultipleChoice/PureMultipleChoiceQuestion';
import { PureFreeTextQuestion } from '../../plugins/FreeText/PureFreeTextQuestion';

export default {
  title: 'Features/Quiz/Pure/Quiz',
};

export const MultipleChoice: Story = () => {
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState<'building' | 'success' | 'failed'>('building');
  const [isChecking, setIsChecking] = useState(false);

  const handleCheck = () => {
    setIsChecking(true);
    setTimeout(() => {
      setIsChecking(false);
      setStatus(selected.includes('b') && selected.length === 1 ? 'success' : 'failed');
    }, 800);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', background: '#f5f5f5', minHeight: '100vh' }}>
      <PureMultipleChoiceQuestion
        difficulty="easy"
        status={status}
        choices={[
          { id: 'a', text: 'Ag' },
          { id: 'b', text: 'Au' },
          { id: 'c', text: 'Fe' },
        ]}
        selectedIds={selected}
        onChange={(ids) => { setSelected(ids); setStatus('building'); }}
        isChecking={isChecking}
        maxPoints={1}
        earnedPoints={status === 'success' ? 1 : 0}
        feedback={status === 'failed' ? 'Incorrect choice.' : null}
        onCheck={handleCheck}
        onGiveUp={() => setStatus('failed')}
        statusMap={status === 'success' ? { b: 'correct' } : status === 'failed' ? selected.reduce((acc, id) => ({...acc, [id]: 'incorrect'}), {}) : {}}
      >
        <PureQuestion.Header
          questionNumber={1}
          difficulty="easy"
          maxPoints={1}
          earnedPoints={status === 'success' ? 1 : 0}
          showScore={status !== 'building'}
        />
        <PureQuestion.Title>Basic Chemistry</PureQuestion.Title>
        <PureQuestion.Body>
          <p>Which of the following is the chemical symbol for Gold?</p>
        </PureQuestion.Body>
      </PureMultipleChoiceQuestion>
    </div>
  );
};

export const FreeText: Story = () => {
  const [val, setVal] = useState('');
  const [status, setStatus] = useState<'building' | 'success' | 'failed'>('building');
  const [isChecking, setIsChecking] = useState(false);

  const handleCheck = () => {
    setIsChecking(true);
    setTimeout(() => {
      setIsChecking(false);
      setStatus(val.toLowerCase() === 'paris' ? 'success' : 'failed');
    }, 800);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', background: '#f5f5f5', minHeight: '100vh' }}>
      <PureFreeTextQuestion
        difficulty="medium"
        status={status}
        value={val}
        onChange={(v) => { setVal(v); setStatus('building'); }}
        isChecking={isChecking}
        maxPoints={2}
        earnedPoints={status === 'success' ? 2 : 0}
        feedback={status === 'failed' ? 'Think about the Eiffel Tower.' : null}
        inputStatus={status === 'success' ? 'correct' : status === 'failed' ? 'error' : 'default'}
        onCheck={handleCheck}
        onGiveUp={() => setStatus('failed')}
      >
        <PureQuestion.Header
          questionNumber={2}
          difficulty="medium"
          maxPoints={2}
          earnedPoints={status === 'success' ? 2 : 0}
          showScore={status !== 'building'}
        />
        <PureQuestion.Title>What is the capital of France?</PureQuestion.Title>
        <PureQuestion.Body>
          <p>Please provide the name of the capital city.</p>
        </PureQuestion.Body>
      </PureFreeTextQuestion>
    </div>
  );
};

export const DisabledDuringExamSubmit: Story = () => (
  <div style={{ padding: '20px', maxWidth: '800px', background: '#f5f5f5', minHeight: '100vh' }}>
    <PureMultipleChoiceQuestion
      difficulty="easy"
      status="building"
      choices={[
        { id: 'a', text: 'Frontend only' },
        { id: 'b', text: 'Full-stack' },
        { id: 'c', text: 'Backend only' },
      ]}
      selectedIds={['b']}
      onChange={() => undefined}
      disabled
      isChecking
      maxPoints={1}
      earnedPoints={0}
      feedback={null}
      onCheck={() => undefined}
      onGiveUp={() => undefined}
    >
      <PureQuestion.Header questionNumber={1} difficulty="easy" maxPoints={1} />
      <PureQuestion.Title>Exam submission lock</PureQuestion.Title>
      <PureQuestion.Body>
        <p>All inputs and actions are disabled while the final exam submission is being graded.</p>
      </PureQuestion.Body>
    </PureMultipleChoiceQuestion>
  </div>
);
