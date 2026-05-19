import type { ExperimentDefinition } from '@taylordb/learning-backend';

export const gasLawsExperimentDefinition: ExperimentDefinition = {
  id: 'demo-gas-laws',
  title: 'Gas Laws',
  domainContext: 'A chemistry simulation demonstrating gas laws.',
  observations: [
    {
      id: 'heat_motion',
      name: 'Heat is Motion',
      criteria: 'User notices that increasing temperature makes particles move faster.',
      hint: 'Try changing the temperature slider and watch the particles.',
    },
  ],
};

