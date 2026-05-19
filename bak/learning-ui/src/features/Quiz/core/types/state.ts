import { AnswerStatus, QuizPluginRegistry } from './models';

/**
 * A Discriminated Union that strictly links the `questionType` to its corresponding `answer` shape.
 * This allows TypeScript to automatically narrow the answer type when you check the questionType.
 */
export type QuestionState<T extends keyof QuizPluginRegistry = keyof QuizPluginRegistry> = {
  [K in T]: {
    questionId?: string;
    questionType: K;
    answer: QuizPluginRegistry[K] | null;
    lastSubmittedAnswer: QuizPluginRegistry[K] | null;
    status: AnswerStatus;
    isChecking: boolean;
    feedback: string | null;
    discovery?: string | null;
    earnedPoints: number;
    revealed: boolean;
    revealPayload?: unknown;
    pluginState?: unknown;
    version?: number;
  }
}[T];
