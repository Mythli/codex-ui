import { AnswerStatus, AnswerValue } from './models';
import { QuestionState } from './state';
import { QuizExamAttempt, QuizExamSession, QuizSession } from './models';

export type { AnswerValue };

export type GradingRequest = {
  questionId: string;
  questionType: string;
  maxPoints: number;
  question?: string;
  aiMode?: 'always' | 'if-wrong' | 'never';
  /** 
   * Flexible payload to support any custom plugin properties 
   * (e.g., userAnswer, image, plugin-specific draft metadata)
   */
  [key: string]: unknown;
};

export interface GradingResponse {
  status: AnswerStatus;
  points: number;
  reason: string | null;
  discovery?: string | null;
}

export interface QuizBackendAdapter {
  /** Evaluates an answer. Can be an API call, local logic, or mock. */
  gradeAnswer: (request: GradingRequest) => Promise<GradingResponse>;
}

export interface QuizAdapter {
  loadQuiz: (quizId: string) => Promise<QuizSession>;
  saveDraft: (quizId: string, questionId: string, answer: unknown, pluginState?: unknown) => Promise<QuestionState>;
  submitAnswer: (
    quizId: string,
    questionId: string,
    answer: unknown,
    options?: { pluginState?: unknown; submission?: Record<string, unknown> }
  ) => Promise<QuestionState>;
  giveUp: (quizId: string, questionId: string) => Promise<QuestionState>;
  markCorrect: (quizId: string, questionId: string) => Promise<QuestionState>;
  generateMoreQuestions: (quizId: string, count: number) => Promise<QuizSession>;
  reset: (quizId: string) => Promise<QuizSession>;
}

export interface QuizExamFinalQuestionPayload {
  answer?: unknown;
  pluginState?: unknown;
  submission?: Record<string, unknown>;
}

export interface QuizExamAdapter {
  loadExam: (quizId: string) => Promise<QuizExamSession>;
  startExam: (quizId: string) => Promise<QuizExamSession>;
  saveDraft: (
    quizId: string,
    questionId: string,
    answer: unknown,
    options?: { pluginState?: unknown }
  ) => Promise<QuizExamAttempt>;
  submitExam: (
    quizId: string,
    questions: Record<string, QuizExamFinalQuestionPayload>
  ) => Promise<QuizExamAttempt>;
  resetExam: (quizId: string) => Promise<QuizExamSession>;
}
