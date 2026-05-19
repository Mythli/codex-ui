import React from 'react';
import { QuizPluginRegistry, PublicQuizQuestion } from '../types/models';
import { QuestionTypePlugin, QuizQuestionChrome, QuizQuestionCollector, QuizQuestionRenderMode } from '../types/plugin';
import { QuestionState } from '../types/state';

export interface QuizQuestionRendererComponentProps {
  question: PublicQuizQuestion;
  state?: QuestionState;
  plugins: QuestionTypePlugin<unknown>[];
  isChecking?: boolean;
  disabled?: boolean;
  mode?: QuizQuestionRenderMode;
  setAnswer: (
    questionId: string,
    answer: QuizPluginRegistry[keyof QuizPluginRegistry] | null,
    questionType: keyof QuizPluginRegistry,
    pluginState?: unknown
  ) => void;
  submit: (
    questionId: string,
    submission?: Record<string, unknown>,
    answerOverride?: QuizPluginRegistry[keyof QuizPluginRegistry] | null
  ) => void | Promise<void>;
  giveUp: (questionId: string, questionType: keyof QuizPluginRegistry) => void | Promise<void>;
  markCorrect: (
    questionId: string,
    questionType: keyof QuizPluginRegistry,
    maxPoints: number
  ) => void | Promise<void>;
  displayLabel?: string;
  registerQuestionCollector?: (
    questionId: string,
    collector: QuizQuestionCollector | null
  ) => void;
}

const answersEqual = (a: unknown, b: unknown) => {
  if (Object.is(a, b)) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

export function createQuestionChrome({
  state,
  isChecking,
  disabled,
  mode,
  displayLabel,
}: {
  state?: QuestionState;
  isChecking: boolean;
  disabled: boolean;
  mode: QuizQuestionRenderMode;
  displayLabel?: string;
}): QuizQuestionChrome {
  const status = state?.status || 'building';
  const isEditing = state
    ? !answersEqual(state.answer ?? null, state.lastSubmittedAnswer ?? null)
    : false;
  const displayStatus = isEditing && status !== 'success' ? 'building' : status;
  const hasResult = status === 'success' || status === 'partial' || status === 'failed' || status === 'error';
  const isRevealed = Boolean(state?.revealed);
  const isLocked = mode === 'locked';

  return {
    displayLabel,
    mode,
    status: displayStatus,
    feedbackStatus: status,
    isRevealed,
    apiError: status === 'error',
    earnedPoints: state?.earnedPoints || 0,
    showFeedback: !isLocked && mode !== 'exam',
    showActions: mode === 'practice',
    showScoreBadge: !isLocked && (mode === 'review' || isRevealed || (hasResult && !isEditing)),
    interactionDisabled: isLocked || disabled || isChecking || status === 'success' || isRevealed,
  };
}

export function QuizQuestionRenderer({
  question,
  state,
  plugins,
  isChecking = false,
  disabled = false,
  mode = 'practice',
  setAnswer,
  submit,
  giveUp,
  markCorrect,
  displayLabel,
  registerQuestionCollector,
}: QuizQuestionRendererComponentProps) {
  const plugin = plugins.find((item) => item.type === question.questionType);
  const Renderer = plugin?.Renderer;

  if (!Renderer) {
    return (
      <div>
        Unsupported question type: {question.questionType}
      </div>
    );
  }

  const questionType = question.questionType as keyof QuizPluginRegistry;
  const chrome = createQuestionChrome({ state, isChecking, disabled, mode, displayLabel });

  return (
    <Renderer
      question={question}
      state={state}
      answer={(state?.answer ?? null) as never}
      isChecking={isChecking}
      disabled={disabled}
      mode={mode}
      chrome={chrome}
      setAnswer={(answer, pluginState) => setAnswer(
        question.id,
        answer as QuizPluginRegistry[keyof QuizPluginRegistry] | null,
        questionType,
        pluginState
      )}
      submit={(submission, answerOverride) => submit(
        question.id,
        submission,
        answerOverride as QuizPluginRegistry[keyof QuizPluginRegistry] | null
      )}
      giveUp={() => giveUp(question.id, questionType)}
      markCorrect={() => markCorrect(question.id, questionType, question.maxPoints)}
      registerQuestionCollector={registerQuestionCollector}
    />
  );
}
