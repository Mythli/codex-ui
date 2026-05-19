import { createExperimentAdapter } from '@taylordb/learning-ui';

export const apiExperimentBackend = createExperimentAdapter({ baseUrl: '/api/experiment' });
