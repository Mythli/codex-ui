import { bondsQuizDefinition } from './routes/bonds/quiz';
import { gasLawsExperimentDefinition } from './routes/thermo/gas-laws';

export const routeDefinitions = {
  quizzes: [
    bondsQuizDefinition,
  ],
  experiments: [
    gasLawsExperimentDefinition,
  ],
};

export const quizDefinitions = [
  ...routeDefinitions.quizzes,
];

export const experimentDefinitions = [
  ...routeDefinitions.experiments,
];
