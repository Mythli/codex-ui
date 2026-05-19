import { Hono } from 'hono';
import { z } from 'zod';
import { getDependencies } from '../../core/dependencies';

const vocabRouter = new Hono();

vocabRouter.get('/cards', async (c) => {
  try {
    const { srsService } = getDependencies();
    const cards = await srsService.getAllCards({});
    return c.json(cards);
  } catch (error: any) {
    console.error('Error in /cards GET:', error);
    return c.json({ error: 'Internal Server Error', details: error.message }, 500);
  }
});

const querySchema = z.object({
  sourceIds: z.array(z.string())
});

vocabRouter.post('/cards/query', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = querySchema.safeParse(body);
    
    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.format() }, 400);
    }

    const { srsService } = getDependencies();
    const cards = await srsService.getCardsBySourceIds({}, parsed.data.sourceIds);
      
    return c.json(cards);
  } catch (error: any) {
    console.error('Error in /cards/query POST:', error);
    return c.json({ error: 'Internal Server Error', details: error.message }, 500);
  }
});

const createCardSchema = z.object({
  sourceId: z.string().min(1, "sourceId is required"),
  payload: z.any(),
  tags: z.array(z.string()).optional()
});

vocabRouter.post('/cards', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = createCardSchema.safeParse(body);
    
    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.format() }, 400);
    }

    const { srsService } = getDependencies();
    const card = await srsService.createCard({}, parsed.data as { sourceId: string; payload: any; tags?: string[] });

    return c.json(card);
  } catch (error: any) {
    console.error('Error in /cards POST:', error);
    return c.json({ error: 'Internal Server Error', details: error.message }, 500);
  }
});

const updateCardSchema = z.object({
  payload: z.any().optional(),
  tags: z.array(z.string()).optional()
});

vocabRouter.put('/cards/:id', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = updateCardSchema.safeParse(body);
    
    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.format() }, 400);
    }

    const { srsService } = getDependencies();
    const id = c.req.param('id');
    
    const updated = await srsService.updateCard({}, id, parsed.data);
    return c.json(updated);
  } catch (error: any) {
    console.error('Error in /cards/:id PUT:', error);
    if (error.message?.includes('not found')) {
      return c.json({ error: 'Not found' }, 404);
    }
    return c.json({ error: 'Internal Server Error', details: error.message }, 500);
  }
});

const deleteCardsSchema = z.object({
  ids: z.array(z.string())
});

vocabRouter.delete('/cards', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = deleteCardsSchema.safeParse(body);
    
    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.format() }, 400);
    }

    const { srsService } = getDependencies();
    await srsService.deleteCards({}, parsed.data.ids);
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error in /cards DELETE:', error);
    return c.json({ error: 'Internal Server Error', details: error.message }, 500);
  }
});

const reviewBatchSchema = z.object({
  tags: z.array(z.string()).optional(),
  cardIds: z.array(z.string()).optional()
});

vocabRouter.post('/review/batch', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = reviewBatchSchema.safeParse(body);
    
    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.format() }, 400);
    }

    const { srsService } = getDependencies();
    
    const filters = {
      tagsAny: parsed.data.tags,
      cardIds: parsed.data.cardIds,
    };

    const dueCards = await srsService.getReviewBatch({}, filters, 20);
    return c.json(dueCards);
  } catch (error: any) {
    console.error('Error in /review/batch POST:', error);
    return c.json({ error: 'Internal Server Error', details: error.message }, 500);
  }
});

const reviewSubmitSchema = z.object({
  cardId: z.string(),
  rating: z.enum(['again', 'hard', 'good', 'easy'])
});

vocabRouter.post('/review/submit', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = reviewSubmitSchema.safeParse(body);
    
    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.format() }, 400);
    }

    const { srsService } = getDependencies();
    
    await srsService.submitReviews({}, [parsed.data]);

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error in /review/submit POST:', error);
    return c.json({ error: 'Internal Server Error', details: error.message }, 500);
  }
});

vocabRouter.get('/tags', async (c) => {
  try {
    const { srsService } = getDependencies();
    const tags = await srsService.getAvailableTags({});
    // Map to the format expected by the UI
    const formattedTags = tags.map((tag: string) => ({ id: tag, label: tag }));
    return c.json(formattedTags);
  } catch (error: any) {
    console.error('Error in /tags GET:', error);
    return c.json({ error: 'Internal Server Error', details: error.message }, 500);
  }
});

export default vocabRouter;
