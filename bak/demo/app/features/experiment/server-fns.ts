import { createServerFn } from '@tanstack/react-start';

export const fetchExperimentFn = createServerFn({ method: 'GET', strict: false })
  .inputValidator((experimentId: string) => experimentId)
  .handler(async ({ data: experimentId }) => {
    const { getDependencies } = await import('../../../api/core/dependencies');
    const { experimentService } = getDependencies();

    return experimentService.getExperiment({}, experimentId);
  });

