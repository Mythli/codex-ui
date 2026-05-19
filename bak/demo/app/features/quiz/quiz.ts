import { createQuizAdapter, createQuizExamAdapter, defaultQuizPlugins, QuestionTypePlugin } from '@taylordb/learning-ui';
import { sliderPlugin } from './custom-plugins/SliderQuestion';

export const quizPlugins = [...defaultQuizPlugins, sliderPlugin] as QuestionTypePlugin<unknown>[];

export const apiQuizAdapter = createQuizAdapter({
  baseUrl: '/api/quiz',
});

export const apiQuizExamAdapter = createQuizExamAdapter({
  baseUrl: '/api/quiz',
});
