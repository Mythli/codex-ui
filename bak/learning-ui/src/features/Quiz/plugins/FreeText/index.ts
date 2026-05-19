import { QuestionTypePlugin } from '../../core/types/plugin';

export type FreeTextAnswer = string;

export type PureFreeTextInputStatus = 'default' | 'correct' | 'error' | 'partial' | 'revealed';

export const freeTextPlugin: QuestionTypePlugin<FreeTextAnswer> = {
  type: 'free-text',
  isEmpty: (answer) => !answer || answer.trim() === '',
};

export * from './PureFreeTextInput';
export * from './PureFreeTextQuestion';
