import { createServerFn } from '@tanstack/react-start';

export const fetchQuizFn = createServerFn({ method: 'GET', strict: false })
  .inputValidator((quizId: string) => quizId)
  .handler(async ({ data: quizId }) => {
    const { getDependencies } = await import('../../../api/core/dependencies');
    const { quizService } = getDependencies();

    return quizService.getQuiz({ userId: 'demo-user' }, quizId);
  });

export const fetchQuizExamFn = createServerFn({ method: 'GET', strict: false })
  .inputValidator((quizId: string) => quizId)
  .handler(async ({ data: quizId }) => {
    const { getDependencies } = await import('../../../api/core/dependencies');
    const { quizService } = getDependencies();

    return quizService.getExam({ userId: 'demo-user' }, quizId);
  });
