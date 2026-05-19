import { QuestionTypePlugin } from '../../core/types/plugin';

export type MultipleChoiceAnswer = string[];

export interface ChoiceItem {
  id: string;
  text: string;
}

export const multipleChoicePlugin: QuestionTypePlugin<MultipleChoiceAnswer> = {
  type: 'multiple-choice',
  isEmpty: (answer) => !answer || answer.length === 0,
};

export * from './PureMultipleChoiceInput';
export * from './PureMultipleChoiceQuestion';
