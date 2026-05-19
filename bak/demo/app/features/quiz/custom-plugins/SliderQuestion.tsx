import React, { useMemo } from 'react';
import { QuestionTypePlugin, QuizQuestionRendererProps, PureQuestion } from '@taylordb/learning-ui';

// ==========================================
// 1. Define the Plugin Contract
// ==========================================
export type SliderAnswer = number;

// 2. MAGIC: Inject the custom type into the library's registry!
declare module '@taylordb/learning-ui' {
  interface QuizPluginRegistry {
    'custom-slider': SliderAnswer;
  }
}

export const sliderPlugin: QuestionTypePlugin<SliderAnswer> = {
  type: 'custom-slider',
  isEmpty: (answer) => answer === undefined || answer === null,
  Renderer: SliderQuestion,
};

// ==========================================
// 3. Build the UI Component
// ==========================================
export interface SliderPublicConfig {
  title?: string;
  questionText: string;
  min?: number;
  max?: number;
  defaultValue?: number;
}

export function SliderQuestion({
  question,
  state,
  answer,
  isChecking,
  disabled = false,
  chrome,
  setAnswer,
  submit,
  giveUp,
}: QuizQuestionRendererProps<SliderAnswer>) {
  return useMemo(() => {
    const config = question.public as SliderPublicConfig;
    const min = config.min ?? 0;
    const max = config.max ?? 100;
    const answerVal = answer ?? config.defaultValue ?? 50;
    const reveal = state?.revealPayload as { answer?: number } | undefined;

    return (
      // Wrap it in the library's PureQuestion shell for consistent styling
      <PureQuestion status={chrome.status} difficulty="easy">
        <PureQuestion.Header
          questionNumber="Bonus"
          difficulty="easy"
          maxPoints={question.maxPoints}
          earnedPoints={chrome.earnedPoints}
          showScore={chrome.showScoreBadge}
        />
        <PureQuestion.Title>{config.title || 'Custom Plugin Demo'}</PureQuestion.Title>
        <PureQuestion.Body>
          <p>{config.questionText}</p>
        </PureQuestion.Body>
        
        {/* Custom UI specific to this plugin */}
        <div style={{ padding: '20px', background: 'var(--lui-color-bg-alt)', borderRadius: '8px', marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span>{min}</span>
            <span style={{ fontWeight: 'bold', color: 'var(--lui-color-primary)', fontSize: '1.2rem' }}>{answerVal}</span>
            <span>{max}</span>
          </div>
          <input 
            type="range" 
            min={min}
            max={max}
            value={answerVal} 
            onChange={(e) => setAnswer(Number(e.target.value))}
            disabled={chrome.interactionDisabled}
            style={{ width: '100%', cursor: chrome.interactionDisabled ? 'not-allowed' : 'pointer' }}
          />
        </div>

        {chrome.showFeedback && (
          <PureQuestion.Feedback
            status={chrome.feedbackStatus || chrome.status}
            isRevealed={chrome.isRevealed}
            apiError={chrome.apiError}
            feedback={state?.feedback || null}
            earnedPoints={chrome.earnedPoints}
            maxPoints={question.maxPoints}
            revealedAnswer={reveal?.answer !== undefined ? <p>The exact value is {reveal.answer}.</p> : undefined}
          />
        )}

        {chrome.showActions && (
          <PureQuestion.Actions
            isChecking={isChecking}
            isSuccess={chrome.feedbackStatus === 'success'}
            isRevealed={chrome.isRevealed}
            apiError={chrome.apiError}
            earnedPoints={chrome.earnedPoints}
            maxPoints={question.maxPoints}
            checkDisabled={chrome.interactionDisabled}
            disabled={disabled}
            onCheck={() => submit(undefined, answerVal)}
            onGiveUp={giveUp}
          />
        )}
      </PureQuestion>
    );
  }, [question, state, answer, isChecking, disabled, chrome, setAnswer, submit, giveUp]);
}
