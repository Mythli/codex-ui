import { Hono } from 'hono';
import { z } from 'zod';
import { getDependencies } from '../../core/dependencies';

const quizRouter = new Hono();
const generateQuestionsSchema = z.object({
  count: z.number().int().min(1).max(10),
});

const quizContext = { userId: 'demo-user' };

quizRouter.get('/:quizId', async (c) => {
  try {
    const { quizService } = getDependencies();
    const quizId = c.req.param('quizId');
    const session = await quizService.getQuiz(quizContext, quizId);
    return c.json(session);
  } catch (error: any) {
    console.error('Error in /:quizId GET:', error);
    const status = error.message?.includes('not found') ? 404 : 500;
    return c.json({ error: error.message }, status);
  }
});

quizRouter.get('/:quizId/exam', async (c) => {
  try {
    const { quizService } = getDependencies();
    const session = await quizService.getExam(quizContext, c.req.param('quizId'));
    return c.json(session);
  } catch (error: any) {
    console.error('Error in exam GET:', error);
    const status = error.message?.includes('not found') ? 404 : 500;
    return c.json({ error: error.message }, status);
  }
});

quizRouter.post('/:quizId/exam/start', async (c) => {
  try {
    const { quizService } = getDependencies();
    const session = await quizService.startExam(quizContext, c.req.param('quizId'));
    return c.json(session);
  } catch (error: any) {
    console.error('Error in exam start POST:', error);
    return c.json({ error: error.message }, 400);
  }
});

quizRouter.post('/:quizId/exam/questions/:questionId/draft', async (c) => {
  try {
    const body = await c.req.json();
    const { quizService } = getDependencies();
    const attempt = await quizService.saveExamDraft(quizContext, {
      quizId: c.req.param('quizId'),
      questionId: c.req.param('questionId'),
      answer: body?.answer ?? null,
      pluginState: body?.pluginState,
    });

    return c.json(attempt);
  } catch (error: any) {
    console.error('Error in exam draft POST:', error);
    return c.json({ error: error.message }, 400);
  }
});

quizRouter.post('/:quizId/exam/submit', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { quizService } = getDependencies();
    const attempt = await quizService.submitExam(quizContext, {
      quizId: c.req.param('quizId'),
      questions: body?.questions,
    });

    return c.json(attempt);
  } catch (error: any) {
    console.error('Error in exam submit POST:', error);
    return c.json({ error: error.message }, 400);
  }
});

quizRouter.post('/:quizId/exam/reset', async (c) => {
  try {
    const { quizService } = getDependencies();
    const session = await quizService.resetExam(quizContext, c.req.param('quizId'));
    return c.json(session);
  } catch (error: any) {
    console.error('Error in exam reset POST:', error);
    return c.json({ error: error.message }, 500);
  }
});

quizRouter.post('/:quizId/questions/:questionId/draft', async (c) => {
  try {
    const body = await c.req.json();
    const { quizService } = getDependencies();
    const questionState = await quizService.saveDraft(quizContext, {
      quizId: c.req.param('quizId'),
      questionId: c.req.param('questionId'),
      answer: body?.answer ?? null,
      pluginState: body?.pluginState,
    });

    return c.json(questionState);
  } catch (error: any) {
    console.error('Error in draft POST:', error);
    return c.json({ error: error.message }, 400);
  }
});

quizRouter.post('/:quizId/questions/:questionId/submit', async (c) => {
  try {
    const body = await c.req.json();
    const { quizService } = getDependencies();
    const questionState = await quizService.submitAnswer(quizContext, {
      quizId: c.req.param('quizId'),
      questionId: c.req.param('questionId'),
      answer: body?.answer ?? null,
      pluginState: body?.pluginState,
      submission: body?.submission,
    });

    return c.json(questionState);
  } catch (error: any) {
    console.error('Error in submit POST:', error);
    const isClientError = error.message?.includes('Invalid') || error.message?.includes('Unsupported');
    const status = isClientError ? 400 : 500;
    return c.json({ error: error.message }, status);
  }
});

quizRouter.post('/:quizId/questions/generate', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = generateQuestionsSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.message }, 400);
    }

    const { quizService } = getDependencies();
    const session = await quizService.generateMoreQuestions(quizContext, {
      quizId: c.req.param('quizId'),
      count: parsed.data.count,
    });

    return c.json(session);
  } catch (error: any) {
    console.error('Error in generate questions POST:', error);
    return c.json({ error: error.message }, 500);
  }
});

quizRouter.post('/:quizId/questions/:questionId/give-up', async (c) => {
  try {
    const { quizService } = getDependencies();
    const questionState = await quizService.giveUp(
      quizContext,
      c.req.param('quizId'),
      c.req.param('questionId')
    );
    return c.json(questionState);
  } catch (error: any) {
    console.error('Error in give-up POST:', error);
    return c.json({ error: error.message }, 500);
  }
});

quizRouter.post('/:quizId/questions/:questionId/mark-correct', async (c) => {
  try {
    const { quizService } = getDependencies();
    const questionState = await quizService.markCorrect(
      quizContext,
      c.req.param('quizId'),
      c.req.param('questionId')
    );
    return c.json(questionState);
  } catch (error: any) {
    console.error('Error in mark-correct POST:', error);
    return c.json({ error: error.message }, 500);
  }
});

quizRouter.post('/:quizId/reset', async (c) => {
  try {
    const { quizService } = getDependencies();
    const session = await quizService.reset(quizContext, c.req.param('quizId'));
    return c.json(session);
  } catch (error: any) {
    console.error('Error in reset POST:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default quizRouter;
