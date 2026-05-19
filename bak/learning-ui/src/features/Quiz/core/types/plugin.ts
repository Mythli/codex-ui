import { ComponentType } from 'react';
import { AnswerStatus, PublicQuizQuestion } from './models';
import { QuestionState } from './state';

export interface QuestionTypePlugin<TAnswer = unknown> {
  /** The unique string identifier for this question type (e.g., 'multiple-choice') */
  type: string;

  /**
   * Determines if the current answer state should be considered "empty" or "blank".
   * Used by the QuizPage to calculate if a user has started drafting an answer.
   */
  isEmpty: (answer: TAnswer | null | undefined) => boolean;

  /** Renders a backend-provided public question definition. */
  Renderer?: ComponentType<QuizQuestionRendererProps<TAnswer>>;
}

export type QuizQuestionRenderMode = 'practice' | 'exam' | 'review' | 'locked';

export interface QuizQuestionChrome {
  displayLabel?: string;
  mode: QuizQuestionRenderMode;
  status: AnswerStatus;
  feedbackStatus?: AnswerStatus;
  isRevealed: boolean;
  apiError: boolean;
  earnedPoints: number;
  showFeedback: boolean;
  showActions: boolean;
  showScoreBadge: boolean;
  interactionDisabled: boolean;
}

export interface QuizQuestionCollectorResult<TAnswer = unknown> {
  answer?: TAnswer | null;
  pluginState?: unknown;
  submission?: Record<string, unknown>;
}

export type QuizQuestionCollector<TAnswer = unknown> = () =>
  QuizQuestionCollectorResult<TAnswer> | Promise<QuizQuestionCollectorResult<TAnswer>>;

export interface QuizQuestionRendererProps<TAnswer = unknown> {
  question: PublicQuizQuestion;
  state?: QuestionState;
  answer: TAnswer | null;
  isChecking: boolean;
  disabled?: boolean;
  mode?: QuizQuestionRenderMode;
  chrome: QuizQuestionChrome;
  setAnswer: (answer: TAnswer | null, pluginState?: unknown) => void;
  submit: (submission?: Record<string, unknown>, answerOverride?: TAnswer | null) => void | Promise<void>;
  giveUp: () => void | Promise<void>;
  markCorrect: () => void | Promise<void>;
  registerQuestionCollector?: (
    questionId: string,
    collector: QuizQuestionCollector<TAnswer> | null
  ) => void;
}
