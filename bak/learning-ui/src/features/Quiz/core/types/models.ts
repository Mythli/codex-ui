export type AnswerStatus = 'building' | 'success' | 'partial' | 'failed' | 'error';
export type QuestionDifficulty = 'easy' | 'medium' | 'hard' | 'boss';
export interface QuizQuestionMetadata {
  source?: 'base' | 'generated';
  title?: string;
  practiceFocus?: string;
  conceptTags?: string[];
  generatedAt?: string;
}

/**
 * A strict mapping of plugin IDs to their exact answer shapes.
 * This enables perfect type inference across the entire Quiz feature.
 * 
 * Consumers can inject their own custom plugins into this registry using Module Augmentation:
 * 
 * declare module '@taylordb/learning-ui' {
 *   interface QuizPluginRegistry {
 *     'my-custom-plugin': MyCustomAnswerType;
 *   }
 * }
 */
export interface QuizPluginRegistry {
  'multiple-choice': string[];
  'free-text': string;
  'formula': { formula: string; scratchpad?: string };
  'drawing': Record<string, unknown>;
  'fill-in-the-blanks': Record<string, string>;
}

export type AnswerValue = QuizPluginRegistry[keyof QuizPluginRegistry] | null;

export interface PublicQuizQuestion<TPublic = unknown> {
  id: string;
  questionType: string;
  maxPoints: number;
  difficulty?: QuestionDifficulty;
  metadata?: QuizQuestionMetadata;
  public: TPublic;
}

export interface PublicQuizDefinition {
  id: string;
  title: string;
  questions: PublicQuizQuestion[];
}

export interface QuizSession {
  quiz: PublicQuizDefinition;
  state: Record<string, import('./state').QuestionState>;
}

export interface QuizExamConfig {
  timeLimitSeconds: number;
  instructions?: string;
}

export type QuizExamStatus = 'not-started' | 'in-progress' | 'submitted';
export type QuizExamSubmitReason = 'student' | 'timeout';

export interface QuizExamEvaluation {
  questionGrades: Array<{
    questionId: string;
    status: 'success' | 'partial' | 'failed';
    points: number;
    feedback: string;
  }>;
  computedPoints: number;
  teacherAwardedPoints: number;
  maxPoints: number;
  percentage: number;
  gradeLabel?: string;
  teacherReport: string;
}

export interface QuizExamAttempt {
  quizId: string;
  status: QuizExamStatus;
  startedAt?: string;
  endsAt?: string;
  submittedAt?: string;
  submitReason?: QuizExamSubmitReason;
  answers: Record<string, unknown>;
  pluginState: Record<string, unknown>;
  submissions: Record<string, Record<string, unknown>>;
  computedQuestionResults?: Record<string, import('./state').QuestionState>;
  questionResults?: Record<string, import('./state').QuestionState>;
  finalEvaluation?: QuizExamEvaluation;
}

export interface QuizExamSession {
  quiz: PublicQuizDefinition;
  exam: QuizExamConfig;
  attempt: QuizExamAttempt;
}
