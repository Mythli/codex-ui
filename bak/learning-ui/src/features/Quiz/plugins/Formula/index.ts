import { QuestionTypePlugin } from '../../core/types/plugin';

export type FormulaAnswer = {
  formula: string;
  scratchpad?: string;
  computedResult?: string;
};

export type PureFormulaInputStatus = 'default' | 'correct' | 'error' | 'partial' | 'revealed';

export const formulaPlugin: QuestionTypePlugin<FormulaAnswer> = {
  type: 'formula',
  isEmpty: (answer) => {
    if (!answer) return true;
    const hasFormula = answer.formula && answer.formula.trim() !== '';
    const hasScratchpad = answer.scratchpad && answer.scratchpad.trim() !== '';
    return !hasFormula && !hasScratchpad;
  },
};

export * from './PureFormulaInput';
export * from './PureFormulaQuestion';
