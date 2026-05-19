import { defaultQuizPlugins } from '@taylordb/learning-backend';
import { sliderPlugin } from './sliderPlugin';

export const demoQuizPlugins = [
  ...defaultQuizPlugins,
  sliderPlugin,
] as const;

