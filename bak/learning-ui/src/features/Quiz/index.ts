export * from './core/types/models';
export * from './core/types/adapters';
export * from './core/types/state';
export * from './core/types/plugin';
export * from './core/adapters/apiBackend';
export * from './core/adapters/mockBackend';
export * from './core/adapters/createQuizAdapter';
export * from './core/store/QuizContext';
export * from './core/components/PureQuestionShell';
export * from './core/components/QuizPage';
export * from './core/components/QuizQuestionRenderer';
export * from './core/components/ExamQuizPage';

export * from './plugins/MultipleChoice';
export * from './plugins/FreeText';
export * from './plugins/Formula';
export * from './plugins/Drawing';
export * from './plugins/FillInTheBlanks';

import { multipleChoicePlugin } from './plugins/MultipleChoice';
import { freeTextPlugin } from './plugins/FreeText';
import { formulaPlugin } from './plugins/Formula';
import { drawingPlugin } from './plugins/Drawing';
import { fillInTheBlanksPlugin } from './plugins/FillInTheBlanks';
import {
  DrawingRenderer,
  FillInTheBlanksRenderer,
  FormulaRenderer,
  FreeTextRenderer,
  MultipleChoiceRenderer,
} from './core/components/defaultRenderers';

/**
 * A convenience array containing all built-in question type plugins.
 * Pass this to your QuizProvider or createQuizAdapter to enable all standard question types.
 */
export const defaultQuizPlugins = [
  { ...multipleChoicePlugin, Renderer: MultipleChoiceRenderer },
  { ...freeTextPlugin, Renderer: FreeTextRenderer },
  { ...formulaPlugin, Renderer: FormulaRenderer },
  { ...drawingPlugin, Renderer: DrawingRenderer },
  { ...fillInTheBlanksPlugin, Renderer: FillInTheBlanksRenderer }
];
