import { Hono } from 'hono';
import { z } from 'zod';
import { getDependencies } from '../../core/dependencies';

const experimentRouter = new Hono();

const parseSchema = z.object({
  userText: z.string(),
});

experimentRouter.get('/:experimentId', async (c) => {
  try {
    const { experimentService } = getDependencies();
    const session = await experimentService.getExperiment({}, c.req.param('experimentId'));
    return c.json(session);
  } catch (error: any) {
    console.error('Error in experiment GET:', error);
    const status = error.message?.includes('not found') ? 404 : 500;
    return c.json({ error: error.message }, status);
  }
});

experimentRouter.post('/:experimentId/observations/parse', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = parseSchema.safeParse(body);
    
    if (!parsed.success) {
      return c.json({ error: 'Invalid request body', details: parsed.error.format() }, 400);
    }

    const { experimentService } = getDependencies();
    const result = await experimentService.parseObservations({}, {
      experimentId: c.req.param('experimentId'),
      userText: parsed.data.userText,
    });

    return c.json(result);
  } catch (error: any) {
    console.error('Error in /parse-observations:', error);
    return c.json({ error: 'Internal Server Error', details: error.message }, 500);
  }
});

export default experimentRouter;
