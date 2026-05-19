import { Hono } from 'hono';
import quizRouter from '../features/quiz/router';
import vocabRouter from '../features/flashcard/router';
import experimentRouter from '../features/experiment/router';

// Set the base path so Hono knows it's mounted under /api
const apiRouter = new Hono().basePath('/api');

// Mount sub-routers
apiRouter.route('/quiz', quizRouter);
apiRouter.route('/vocab', vocabRouter);
apiRouter.route('/experiment', experimentRouter);

export default apiRouter;
