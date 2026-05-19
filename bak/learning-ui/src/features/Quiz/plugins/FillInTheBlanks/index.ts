import { QuestionTypePlugin } from '../../core/types/plugin';

export type FillInTheBlanksAnswer = Record<string, string>;

export type PureFillInTheBlanksPart = 
  | { type: 'text'; value: string }
  | { type: 'gap'; id: string; placeholder?: string };

export type PureFillInTheBlanksStatus = 'default' | 'correct' | 'error' | 'partial' | 'revealed';

export const fillInTheBlanksPlugin: QuestionTypePlugin<FillInTheBlanksAnswer> = {
  type: 'fill-in-the-blanks',
  isEmpty: (answer) => {
    if (!answer) return true;
    // It's empty if ALL values are empty strings
    return !Object.values(answer).some(v => typeof v === 'string' && v.trim() !== '');
  },
};

export * from './PureFillInTheBlanksInput';
export * from './PureFillInTheBlanksQuestion';
